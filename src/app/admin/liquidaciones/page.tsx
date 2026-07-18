'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  RefreshCw,
  Scale,
  Truck,
  WalletCards,
} from 'lucide-react';
import { getBrowserClient } from '@/lib/db/supabase';
import { financeService, type SettlementBatch } from '@/services/finance';
import { formatCOP, formatCOPNumber } from '@/lib/money';
import {
  downloadBrandedSettlementPdf,
  pdfCurrency,
  type BrandedSettlementPdfData,
} from '@/lib/reports/branded-settlement-pdf';
import { cn } from '@/lib/utils';

interface CourierBalance {
  courier_id: string;
  name: string;
  delivered_orders: number;
  gross_delivery_value: number;
  platform_commission: number;
  net_earnings: number;
  company_owes_courier: number;
  courier_owes_company: number;
  net_balance: number;
  online_minutes: number;
  shift_started_at: string | null;
  shift_status: string;
}

interface BusinessBalance {
  business_id: string;
  name: string;
  delivered_orders: number;
  product_sales: number;
  company_owes_business: number;
  business_owes_company: number;
  net_balance: number;
}

type Section = 'couriers' | 'businesses' | 'history';

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { start: start.toISOString(), end: now.toISOString() };
}

function slug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'liquidacion';
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function downloadFile(content: string, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function exportExcel(title: string, rows: Array<[string, string | number]>) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif}h1{background:#17191f;color:#ffd400;padding:18px}table{border-collapse:collapse;width:100%}td{border:1px solid #ddd;padding:10px}td:first-child{font-weight:700;background:#fff8d0}</style></head><body><h1>DomiU Magdalena · ${escapeHtml(title)}</h1><table>${rows.map((row) => `<tr><td>${escapeHtml(row[0])}</td><td>${escapeHtml(row[1])}</td></tr>`).join('')}</table></body></html>`;
  downloadFile(html, `${slug(title)}-${new Date().toISOString().slice(0, 10)}.xls`, 'application/vnd.ms-excel;charset=utf-8');
}

function statusLabel(status: SettlementBatch['status']) {
  const labels: Record<SettlementBatch['status'], string> = {
    pending: 'Pendiente',
    approved: 'Aprobada',
    paid: 'Pagada',
    cancelled: 'Cancelada',
  };
  return labels[status];
}

export default function LiquidacionesPage() {
  const [section, setSection] = useState<Section>('couriers');
  const [couriers, setCouriers] = useState<CourierBalance[]>([]);
  const [businesses, setBusinesses] = useState<BusinessBalance[]>([]);
  const [settlements, setSettlements] = useState<SettlementBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [pdfProcessing, setPdfProcessing] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const supabase = getBrowserClient();
    try {
      const [
        courierSummaryResult,
        courierProfilesResult,
        shiftsResult,
        businessSummaryResult,
        businessProfilesResult,
        batches,
      ] = await Promise.all([
        supabase.from('courier_financial_summary').select('*'),
        supabase.from('profiles').select('id,first_name,last_name').eq('role', 'courier'),
        supabase.from('courier_shifts').select('courier_id,status,started_at,ended_at,online_minutes').order('started_at', { ascending: false }),
        supabase.from('business_financial_summary').select('*'),
        supabase.from('businesses').select('id,name').is('deleted_at', null),
        financeService.listSettlements(),
      ]);

      if (courierSummaryResult.error) throw new Error(courierSummaryResult.error.message);
      if (businessSummaryResult.error) throw new Error(businessSummaryResult.error.message);

      const courierNameMap = new Map((courierProfilesResult.data ?? []).map((profile) => [
        profile.id,
        `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Repartidor',
      ]));
      const shiftMap = new Map<string, { status: string; started_at: string; online_minutes: number }>();
      for (const shift of shiftsResult.data ?? []) {
        if (!shiftMap.has(shift.courier_id)) shiftMap.set(shift.courier_id, shift);
      }

      setCouriers((courierSummaryResult.data ?? []).map((row) => {
        const shift = shiftMap.get(row.courier_id);
        const liveMinutes = shift?.status === 'open' && shift.started_at
          ? Math.max(0, Math.floor((Date.now() - new Date(shift.started_at).getTime()) / 60000))
          : Number(shift?.online_minutes ?? 0);
        return {
          courier_id: row.courier_id,
          name: courierNameMap.get(row.courier_id) || 'Repartidor',
          delivered_orders: Number(row.delivered_orders ?? 0),
          gross_delivery_value: Number(row.gross_delivery_value ?? 0),
          platform_commission: Number(row.platform_commission ?? 0),
          net_earnings: Number(row.net_earnings ?? 0),
          company_owes_courier: Number(row.company_owes_courier ?? 0),
          courier_owes_company: Number(row.courier_owes_company ?? 0),
          net_balance: Number(row.net_balance ?? 0),
          online_minutes: liveMinutes,
          shift_started_at: shift?.started_at ?? null,
          shift_status: shift?.status ?? 'closed',
        };
      }));

      const businessNameMap = new Map((businessProfilesResult.data ?? []).map((business) => [business.id, business.name || 'Comercio']));
      setBusinesses((businessSummaryResult.data ?? []).map((row) => ({
        business_id: row.business_id,
        name: businessNameMap.get(row.business_id) || 'Comercio',
        delivered_orders: Number(row.delivered_orders ?? 0),
        product_sales: Number(row.product_sales ?? 0),
        company_owes_business: Number(row.company_owes_business ?? 0),
        business_owes_company: Number(row.business_owes_company ?? 0),
        net_balance: Number(row.net_balance ?? 0),
      })));

      setSettlements(batches);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las liquidaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => {
    const courierTotals = couriers.reduce((result, courier) => ({
      owes: result.owes + courier.company_owes_courier,
      receivable: result.receivable + courier.courier_owes_company,
      net: result.net + courier.net_balance,
    }), { owes: 0, receivable: 0, net: 0 });
    const businessTotals = businesses.reduce((result, business) => ({
      owes: result.owes + business.company_owes_business,
      receivable: result.receivable + business.business_owes_company,
      net: result.net + business.net_balance,
    }), { owes: 0, receivable: 0, net: 0 });
    return {
      owes: courierTotals.owes + businessTotals.owes,
      receivable: courierTotals.receivable + businessTotals.receivable,
      net: courierTotals.net + businessTotals.net,
    };
  }, [businesses, couriers]);

  const participantNames = useMemo(() => {
    const map = new Map<string, string>();
    couriers.forEach((courier) => map.set(courier.courier_id, courier.name));
    businesses.forEach((business) => map.set(business.business_id, business.name));
    return map;
  }, [businesses, couriers]);

  const createSettlement = async (participantType: 'courier' | 'business', participantId: string) => {
    setProcessing(participantId);
    setError('');
    try {
      const range = todayRange();
      await financeService.createSettlement(participantType, participantId, range.start, range.end);
      await load();
      setSection('history');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo generar la liquidación');
    } finally {
      setProcessing(null);
    }
  };

  const pay = async (batch: SettlementBatch) => {
    setProcessing(batch.id);
    setError('');
    try {
      await financeService.markSettlementPaid(batch.id, `DomiU-${Date.now()}`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cerrar el pago');
    } finally {
      setProcessing(null);
    }
  };

  const downloadPdf = async (key: string, data: BrandedSettlementPdfData, fileName: string) => {
    setPdfProcessing(key);
    setError('');
    try {
      await downloadBrandedSettlementPdf(data, fileName);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el PDF');
    } finally {
      setPdfProcessing(null);
    }
  };

  const courierPdf = (courier: CourierBalance): BrandedSettlementPdfData => ({
    documentNumber: `LIQ-R-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${courier.courier_id.slice(0, 6).toUpperCase()}`,
    participantName: courier.name,
    participantType: 'Liquidación de repartidor',
    periodLabel: `Corte ${new Date().toLocaleDateString('es-CO')}`,
    generatedAt: new Date().toLocaleString('es-CO'),
    statusLabel: courier.shift_status === 'open' ? 'Jornada abierta' : 'Corte actual',
    metrics: [
      { label: 'Horas en línea', value: (courier.online_minutes / 60).toFixed(2) },
      { label: 'Domicilios realizados', value: String(courier.delivered_orders) },
      { label: 'Valor bruto domicilios', value: pdfCurrency(courier.gross_delivery_value) },
      { label: 'Comisión DomiU', value: pdfCurrency(courier.platform_commission) },
      { label: 'Ganancia neta', value: pdfCurrency(courier.net_earnings) },
      { label: 'DomiU debe pagar', value: pdfCurrency(courier.company_owes_courier) },
      { label: 'Debe a DomiU', value: pdfCurrency(courier.courier_owes_company) },
      { label: 'Saldo neto', value: pdfCurrency(courier.net_balance) },
    ],
    companyOwes: courier.company_owes_courier,
    participantOwes: courier.courier_owes_company,
    netBalance: courier.net_balance,
  });

  const businessPdf = (business: BusinessBalance): BrandedSettlementPdfData => ({
    documentNumber: `LIQ-N-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${business.business_id.slice(0, 6).toUpperCase()}`,
    participantName: business.name,
    participantType: 'Liquidación de comercio',
    periodLabel: `Corte ${new Date().toLocaleDateString('es-CO')}`,
    generatedAt: new Date().toLocaleString('es-CO'),
    statusLabel: 'Corte actual',
    metrics: [
      { label: 'Pedidos entregados', value: String(business.delivered_orders) },
      { label: 'Ventas de productos', value: pdfCurrency(business.product_sales) },
      { label: 'DomiU debe al comercio', value: pdfCurrency(business.company_owes_business) },
      { label: 'Comercio debe a DomiU', value: pdfCurrency(business.business_owes_company) },
      { label: 'Saldo neto', value: pdfCurrency(business.net_balance) },
      { label: 'Tipo de participante', value: 'Comercio aliado' },
      { label: 'Moneda', value: 'Pesos colombianos' },
      { label: 'Estado', value: 'Por conciliar' },
    ],
    companyOwes: business.company_owes_business,
    participantOwes: business.business_owes_company,
    netBalance: business.net_balance,
  });

  const batchPdf = (batch: SettlementBatch): BrandedSettlementPdfData => ({
    documentNumber: `DOMIU-${batch.id.slice(0, 8).toUpperCase()}`,
    participantName: participantNames.get(batch.participant_id) || `${batch.participant_type === 'courier' ? 'Repartidor' : 'Comercio'} ${batch.participant_id.slice(0, 8)}`,
    participantType: batch.participant_type === 'courier' ? 'Liquidación de repartidor' : 'Liquidación de comercio',
    periodLabel: `${new Date(batch.period_start).toLocaleDateString('es-CO')} - ${new Date(batch.period_end).toLocaleDateString('es-CO')}`,
    generatedAt: new Date(batch.created_at).toLocaleString('es-CO'),
    statusLabel: statusLabel(batch.status),
    metrics: [
      { label: 'Inicio del periodo', value: new Date(batch.period_start).toLocaleDateString('es-CO') },
      { label: 'Fin del periodo', value: new Date(batch.period_end).toLocaleDateString('es-CO') },
      { label: 'DomiU debe pagar', value: pdfCurrency(batch.company_owes_participant) },
      { label: 'Participante debe', value: pdfCurrency(batch.participant_owes_company) },
      { label: 'Saldo neto', value: pdfCurrency(batch.net_balance) },
      { label: 'Estado', value: statusLabel(batch.status) },
      { label: 'Referencia', value: batch.payment_reference || 'Sin referencia' },
      { label: 'Moneda', value: 'Pesos colombianos' },
    ],
    companyOwes: batch.company_owes_participant,
    participantOwes: batch.participant_owes_company,
    netBalance: batch.net_balance,
  });

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 pb-8 sm:space-y-6">
      <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#17191F] text-white shadow-xl sm:rounded-[2rem]">
        <div className="h-1.5 bg-[#FFD400]" />
        <div className="flex flex-col gap-5 p-5 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#FFD400]">Centro financiero DomiU</p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">Liquidación</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">Controla saldos de repartidores y comercios, genera cortes y descarga comprobantes PDF oficiales con la identidad de DomiU Magdalena.</p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold transition hover:bg-white/15 sm:w-auto"><RefreshCw className="h-4 w-4" />Actualizar información</button>
        </div>
      </section>

      {error && <p className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm font-semibold text-destructive">{error}</p>}

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-5"><WalletCards className="h-5 w-5 text-emerald-500" /><p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">DomiU debe pagar</p><p className="mt-1 break-words text-xl font-black sm:text-2xl">{formatCOP(totals.owes)}</p></article>
        <article className="rounded-2xl border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-5"><Download className="h-5 w-5 text-amber-500" /><p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">DomiU debe recibir</p><p className="mt-1 break-words text-xl font-black sm:text-2xl">{formatCOP(totals.receivable)}</p></article>
        <article className="rounded-2xl border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-5"><Scale className="h-5 w-5 text-primary" /><p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Balance neto</p><p className="mt-1 break-words text-xl font-black sm:text-2xl">{formatCOP(totals.net)}</p></article>
      </section>

      <section className="grid grid-cols-3 gap-2 rounded-2xl border bg-card p-2 shadow-sm">
        {[
          { key: 'couriers' as const, label: 'Repartidores', icon: Truck },
          { key: 'businesses' as const, label: 'Comercios', icon: Building2 },
          { key: 'history' as const, label: 'Historial', icon: History },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" onClick={() => setSection(key)} className={cn('flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-black transition sm:flex-row sm:text-sm', section === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
            <Icon className="h-4 w-4 shrink-0" /><span className="w-full truncate sm:w-auto">{label}</span>
          </button>
        ))}
      </section>

      {section === 'couriers' && (
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm sm:rounded-3xl">
          <header className="border-b px-4 py-4 sm:px-5"><h2 className="font-black">Liquidaciones de repartidores</h2><p className="mt-1 text-xs text-muted-foreground">Genera el corte diario, descarga el PDF oficial o conserva una copia en Excel.</p></header>

          <div className="grid gap-3 p-3 lg:hidden">
            {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Cargando movimientos…</p> : couriers.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No hay movimientos financieros entregados.</p> : couriers.map((courier) => (
              <article key={courier.courier_id} className="rounded-2xl border bg-background/40 p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0"><h3 className="truncate font-black">{courier.name}</h3><span className={cn('mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-bold', courier.shift_status === 'open' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted text-muted-foreground')}>{courier.shift_status === 'open' ? 'En jornada' : 'Fuera de línea'}</span></div>
                  <p className={cn('shrink-0 text-right text-base font-black', courier.net_balance < 0 ? 'text-red-500' : 'text-emerald-500')}>{formatCOP(courier.net_balance)}</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-muted/60 p-3"><span className="text-muted-foreground">Entregas</span><strong className="mt-1 block text-sm">{courier.delivered_orders}</strong></div>
                  <div className="rounded-xl bg-muted/60 p-3"><span className="text-muted-foreground">Horas</span><strong className="mt-1 block text-sm">{(courier.online_minutes / 60).toFixed(2)}</strong></div>
                  <div className="rounded-xl bg-muted/60 p-3"><span className="text-muted-foreground">DomiU debe</span><strong className="mt-1 block text-sm text-emerald-500">{formatCOP(courier.company_owes_courier)}</strong></div>
                  <div className="rounded-xl bg-muted/60 p-3"><span className="text-muted-foreground">Debe a DomiU</span><strong className="mt-1 block text-sm text-amber-500">{formatCOP(courier.courier_owes_company)}</strong></div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => void downloadPdf(courier.courier_id, courierPdf(courier), `liquidacion-${slug(courier.name)}-${new Date().toISOString().slice(0, 10)}.pdf`)} disabled={pdfProcessing === courier.courier_id} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 text-xs font-black text-primary disabled:opacity-50"><Download className="h-4 w-4" />{pdfProcessing === courier.courier_id ? 'Creando…' : 'PDF oficial'}</button>
                  <button type="button" onClick={() => exportExcel(`Liquidación ${courier.name}`, [['Repartidor', courier.name], ['Horas en línea', (courier.online_minutes / 60).toFixed(2)], ['Entregas', courier.delivered_orders], ['Ganancia neta', formatCOPNumber(courier.net_earnings)], ['Saldo', formatCOPNumber(courier.net_balance)]])} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black"><FileSpreadsheet className="h-4 w-4" />Excel</button>
                  <button type="button" onClick={() => void createSettlement('courier', courier.courier_id)} disabled={processing === courier.courier_id} className="col-span-2 min-h-11 rounded-xl bg-primary px-3 text-xs font-black text-primary-foreground disabled:opacity-50">{processing === courier.courier_id ? 'Generando corte…' : 'Liquidar hoy'}</button>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-4">Repartidor</th><th className="p-4">Horas</th><th className="p-4">Entregas</th><th className="p-4">Neto ganado</th><th className="p-4">DomiU debe</th><th className="p-4">Debe a DomiU</th><th className="p-4">Saldo</th><th className="p-4">Acciones</th></tr></thead>
              <tbody>{loading ? <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">Cargando movimientos…</td></tr> : couriers.length === 0 ? <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">No hay movimientos financieros entregados.</td></tr> : couriers.map((courier) => <tr key={courier.courier_id} className="border-t"><td className="p-4"><strong>{courier.name}</strong><span className={cn('ml-2 rounded-full px-2 py-1 text-[10px] font-bold', courier.shift_status === 'open' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted text-muted-foreground')}>{courier.shift_status === 'open' ? 'En jornada' : 'Fuera de línea'}</span></td><td className="p-4">{(courier.online_minutes / 60).toFixed(2)}</td><td className="p-4">{courier.delivered_orders}</td><td className="p-4 font-bold">{formatCOP(courier.net_earnings)}</td><td className="p-4 text-emerald-500">{formatCOP(courier.company_owes_courier)}</td><td className="p-4 text-amber-500">{formatCOP(courier.courier_owes_company)}</td><td className={cn('p-4 font-black', courier.net_balance < 0 ? 'text-red-500' : 'text-emerald-500')}>{formatCOP(courier.net_balance)}</td><td className="p-4"><div className="flex gap-2"><button type="button" onClick={() => void downloadPdf(courier.courier_id, courierPdf(courier), `liquidacion-${slug(courier.name)}-${new Date().toISOString().slice(0, 10)}.pdf`)} disabled={pdfProcessing === courier.courier_id} className="rounded-xl border border-primary/25 bg-primary/10 p-2 text-primary" title="Descargar PDF oficial"><Download className="h-4 w-4" /></button><button type="button" onClick={() => exportExcel(`Liquidación ${courier.name}`, [['Repartidor', courier.name], ['Horas en línea', (courier.online_minutes / 60).toFixed(2)], ['Entregas', courier.delivered_orders], ['Ganancia neta', formatCOPNumber(courier.net_earnings)], ['Saldo', formatCOPNumber(courier.net_balance)]])} className="rounded-xl border p-2" title="Descargar Excel"><FileSpreadsheet className="h-4 w-4" /></button><button type="button" onClick={() => void createSettlement('courier', courier.courier_id)} disabled={processing === courier.courier_id} className="rounded-xl bg-primary px-3 py-2 text-xs font-black text-primary-foreground disabled:opacity-50">Liquidar hoy</button></div></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {section === 'businesses' && (
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm sm:rounded-3xl">
          <header className="border-b px-4 py-4 sm:px-5"><h2 className="font-black">Liquidaciones de comercios</h2><p className="mt-1 text-xs text-muted-foreground">Consulta ventas de productos y saldos pendientes con cada aliado comercial.</p></header>
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {loading ? <p className="col-span-full p-8 text-center text-sm text-muted-foreground">Cargando comercios…</p> : businesses.length === 0 ? <p className="col-span-full p-8 text-center text-sm text-muted-foreground">No hay saldos de comercios para liquidar.</p> : businesses.map((business) => (
              <article key={business.business_id} className="rounded-2xl border bg-background/40 p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Building2 className="h-5 w-5 text-primary" /><h3 className="mt-3 truncate font-black">{business.name}</h3><p className="mt-1 text-xs text-muted-foreground">{business.delivered_orders} pedidos entregados</p></div><p className={cn('shrink-0 text-right text-base font-black', business.net_balance < 0 ? 'text-red-500' : 'text-emerald-500')}>{formatCOP(business.net_balance)}</p></div>
                <div className="mt-4 space-y-2 text-xs"><div className="flex justify-between rounded-xl bg-muted/60 px-3 py-2"><span className="text-muted-foreground">Ventas de productos</span><strong>{formatCOP(business.product_sales)}</strong></div><div className="flex justify-between rounded-xl bg-muted/60 px-3 py-2"><span className="text-muted-foreground">DomiU debe</span><strong className="text-emerald-500">{formatCOP(business.company_owes_business)}</strong></div><div className="flex justify-between rounded-xl bg-muted/60 px-3 py-2"><span className="text-muted-foreground">Comercio debe</span><strong className="text-amber-500">{formatCOP(business.business_owes_company)}</strong></div></div>
                <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => void downloadPdf(business.business_id, businessPdf(business), `liquidacion-${slug(business.name)}-${new Date().toISOString().slice(0, 10)}.pdf`)} disabled={pdfProcessing === business.business_id} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 text-xs font-black text-primary disabled:opacity-50"><Download className="h-4 w-4" />{pdfProcessing === business.business_id ? 'Creando…' : 'PDF oficial'}</button><button type="button" onClick={() => exportExcel(`Liquidación ${business.name}`, [['Comercio', business.name], ['Pedidos entregados', business.delivered_orders], ['Ventas de productos', formatCOPNumber(business.product_sales)], ['DomiU debe', formatCOPNumber(business.company_owes_business)], ['Comercio debe', formatCOPNumber(business.business_owes_company)], ['Saldo', formatCOPNumber(business.net_balance)]])} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black"><FileSpreadsheet className="h-4 w-4" />Excel</button><button type="button" onClick={() => void createSettlement('business', business.business_id)} disabled={processing === business.business_id} className="col-span-2 min-h-11 rounded-xl bg-primary px-3 text-xs font-black text-primary-foreground disabled:opacity-50">{processing === business.business_id ? 'Generando corte…' : 'Liquidar hoy'}</button></div>
              </article>
            ))}
          </div>
        </section>
      )}

      {section === 'history' && (
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm sm:rounded-3xl">
          <header className="border-b px-4 py-4 sm:px-5"><h2 className="font-black">Historial de liquidaciones</h2><p className="mt-1 text-xs text-muted-foreground">Cada corte conserva su estado, periodo, referencia y comprobante PDF.</p></header>
          <div className="divide-y">{settlements.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No hay liquidaciones generadas.</p> : settlements.map((batch) => {
            const name = participantNames.get(batch.participant_id) || `${batch.participant_type === 'courier' ? 'Repartidor' : 'Comercio'} ${batch.participant_id.slice(0, 8)}`;
            return <article key={batch.id} className="p-4 sm:p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-black">{name}</p><span className={cn('rounded-full px-2.5 py-1 text-[10px] font-black', batch.status === 'paid' ? 'bg-emerald-500/15 text-emerald-500' : batch.status === 'cancelled' ? 'bg-red-500/15 text-red-500' : 'bg-amber-500/15 text-amber-500')}>{statusLabel(batch.status)}</span></div><p className="mt-1 text-xs text-muted-foreground">{new Date(batch.period_start).toLocaleString('es-CO')} — {new Date(batch.period_end).toLocaleString('es-CO')}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">Documento DOMIU-{batch.id.slice(0, 8).toUpperCase()}</p></div><div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 xl:flex xl:items-center"><div className="rounded-xl bg-muted/60 p-3"><span className="text-muted-foreground">DomiU debe</span><strong className="mt-1 block">{formatCOP(batch.company_owes_participant)}</strong></div><div className="rounded-xl bg-muted/60 p-3"><span className="text-muted-foreground">Debe a DomiU</span><strong className="mt-1 block">{formatCOP(batch.participant_owes_company)}</strong></div><div className="col-span-2 rounded-xl bg-muted/60 p-3 sm:col-span-1"><span className="text-muted-foreground">Saldo</span><strong className="mt-1 block">{formatCOP(batch.net_balance)}</strong></div><button type="button" onClick={() => void downloadPdf(batch.id, batchPdf(batch), `comprobante-${slug(name)}-${batch.id.slice(0, 8)}.pdf`)} disabled={pdfProcessing === batch.id} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 font-black text-primary disabled:opacity-50"><Download className="h-4 w-4" />PDF</button>{batch.status === 'paid' ? <span className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-emerald-500/15 px-3 font-bold text-emerald-500"><CheckCircle2 className="h-4 w-4" />Pagada</span> : <button type="button" onClick={() => void pay(batch)} disabled={processing === batch.id} className="min-h-11 rounded-xl bg-[#17191F] px-4 font-black text-white disabled:opacity-50">Marcar pagada</button>}</div></div></article>;
          })}</div>
        </section>
      )}
    </div>
  );
}
