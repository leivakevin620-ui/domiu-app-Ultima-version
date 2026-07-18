'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Loader2, ReceiptText, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { financeService, type OperationalShift, type SettlementBalance, type SettlementEntry } from '@/services/finance';
import { formatCOP } from '@/lib/formatters/currency';
import { downloadSettlementExcel, downloadSettlementPdf, type SettlementExportData } from '@/lib/exports/settlement';

function reasonLabel(reason: SettlementEntry['reason']) {
  if (reason === 'courier_earning') return 'Ganancia neta del domicilio';
  if (reason === 'cash_remittance') return 'Efectivo por entregar a DomiU';
  if (reason === 'adjustment') return 'Ajuste administrativo';
  return 'Movimiento financiero';
}

export default function RepartidorLiquidacionesPage() {
  const { profile } = useAuth();
  const [balance, setBalance] = useState<SettlementBalance | null>(null);
  const [entries, setEntries] = useState<SettlementEntry[]>([]);
  const [shifts, setShifts] = useState<OperationalShift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile?.id) return;
    setLoading(true);
    Promise.all([
      financeService.getBalance('courier', profile.id),
      financeService.getEntries('courier', profile.id),
      financeService.getShiftHistory('courier', profile.id, 100),
    ]).then(([balanceRow, entryRows, shiftRows]) => {
      setBalance(balanceRow);
      setEntries(entryRows);
      setShifts(shiftRows);
      setError('');
    }).catch((cause) => setError(cause instanceof Error ? cause.message : 'No se pudo cargar tu liquidación')).finally(() => setLoading(false));
  }, [profile?.id]);

  const selectedShift = shifts.find((shift) => shift.id === selectedShiftId) ?? null;
  const filteredEntries = useMemo(() => selectedShiftId === 'all' ? entries : entries.filter((entry) => entry.shift_id === selectedShiftId), [entries, selectedShiftId]);

  const exportData = useMemo<SettlementExportData | null>(() => {
    if (!profile) return null;
    const companyOwes = filteredEntries.filter((entry) => entry.status !== 'void' && entry.direction === 'company_owes_participant').reduce((sum, entry) => sum + entry.amount, 0);
    const participantOwes = filteredEntries.filter((entry) => entry.status !== 'void' && entry.direction === 'participant_owes_company').reduce((sum, entry) => sum + entry.amount, 0);
    const orders = new Set(filteredEntries.map((entry) => entry.order_id));
    return {
      title: 'Desprendible de pago DomiU',
      participantName: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email || 'Repartidor DomiU',
      participantType: 'courier',
      periodStart: selectedShift?.opened_at || filteredEntries.at(-1)?.created_at || new Date().toISOString(),
      periodEnd: selectedShift?.closed_at || filteredEntries[0]?.created_at || new Date().toISOString(),
      openedAt: selectedShift?.opened_at,
      closedAt: selectedShift?.closed_at,
      onlineSeconds: selectedShift?.online_seconds ?? 0,
      ordersCount: selectedShift?.orders_count ?? orders.size,
      deliveryFees: selectedShift?.delivery_fees ?? 0,
      productSales: 0,
      serviceFees: selectedShift?.service_fees ?? 0,
      courierEarnings: selectedShift?.courier_earnings ?? filteredEntries.filter((entry) => entry.reason === 'courier_earning').reduce((sum, entry) => sum + entry.amount, 0),
      companyOwesParticipant: companyOwes,
      participantOwesCompany: participantOwes,
      netBalance: companyOwes - participantOwes,
      rows: filteredEntries.map((entry) => ({
        date: entry.created_at,
        orderNumber: String(entry.metadata?.order_number || entry.order_id.slice(0, 8)),
        concept: reasonLabel(entry.reason),
        direction: entry.direction === 'company_owes_participant' ? 'DomiU te debe' : 'Debes entregar a DomiU',
        amount: entry.amount,
        status: entry.status,
      })),
    };
  }, [filteredEntries, profile, selectedShift]);

  if (loading) return <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const net = balance?.net_balance ?? 0;
  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-3xl bg-gradient-to-br from-[#17191F] to-[#2C3138] p-6 text-white shadow-xl"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#FFD400]">Documentos de trabajo</p><h1 className="mt-2 text-3xl font-black">Liquidaciones y desprendibles</h1><p className="mt-2 max-w-2xl text-sm text-white/65">Consulta horas en línea, domicilios realizados, ganancias netas, efectivo recaudado y saldo con DomiU.</p></section>
      {error && <p className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}

      <section className="grid gap-4 sm:grid-cols-3"><article className="rounded-2xl border bg-card p-5 shadow-sm"><p className="text-xs font-bold text-muted-foreground">DomiU te debe</p><p className="mt-2 text-2xl font-black text-emerald-600">{formatCOP(balance?.company_owes_participant ?? 0)}</p></article><article className="rounded-2xl border bg-card p-5 shadow-sm"><p className="text-xs font-bold text-muted-foreground">Debes entregar a DomiU</p><p className="mt-2 text-2xl font-black text-amber-600">{formatCOP(balance?.participant_owes_company ?? 0)}</p></article><article className="rounded-2xl border bg-primary/5 p-5 shadow-sm"><p className="text-xs font-bold text-muted-foreground">Saldo neto</p><p className="mt-2 text-2xl font-black text-primary">{formatCOP(net)}</p><p className="mt-2 text-[11px] text-muted-foreground">{net > 0 ? 'DomiU debe pagarte' : net < 0 ? 'Debes consignar a DomiU' : 'Cuenta al día'}</p></article></section>

      <section className="rounded-3xl border bg-card p-5 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-4"><label className="min-w-72 flex-1 text-xs font-bold text-muted-foreground">Seleccionar jornada<select value={selectedShiftId} onChange={(event) => setSelectedShiftId(event.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm text-foreground"><option value="all">Todos los movimientos</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{new Date(shift.opened_at).toLocaleString('es-CO')} · {shift.status}</option>)}</select></label><div className="flex gap-2"><button type="button" disabled={!exportData} onClick={() => exportData && downloadSettlementPdf(exportData)} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-black"><FileText className="h-4 w-4" />Descargar PDF</button><button type="button" disabled={!exportData} onClick={() => exportData && downloadSettlementExcel(exportData)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-black text-primary-foreground"><FileSpreadsheet className="h-4 w-4" />Descargar Excel</button></div></div></section>

      {selectedShift && <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><article className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">Inicio</p><p className="mt-1 font-black">{new Date(selectedShift.opened_at).toLocaleString('es-CO')}</p></article><article className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">Fin</p><p className="mt-1 font-black">{selectedShift.closed_at ? new Date(selectedShift.closed_at).toLocaleString('es-CO') : 'Jornada abierta'}</p></article><article className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">Tiempo en línea</p><p className="mt-1 font-black">{Math.floor(selectedShift.online_seconds / 3600)} h {Math.floor((selectedShift.online_seconds % 3600) / 60)} min</p></article><article className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">Domicilios</p><p className="mt-1 font-black">{selectedShift.orders_count}</p></article></section>}

      <section className="overflow-hidden rounded-3xl border bg-card shadow-sm"><div className="flex items-center justify-between border-b p-5"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Detalle</p><h2 className="mt-1 text-xl font-black">Movimientos de la jornada</h2></div><ReceiptText className="h-6 w-6 text-primary" /></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Pedido</th><th className="px-4 py-3">Concepto</th><th className="px-4 py-3">Responsabilidad</th><th className="px-4 py-3 text-right">Valor</th></tr></thead><tbody>{filteredEntries.map((entry) => <tr key={entry.id} className="border-t"><td className="px-4 py-3 text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString('es-CO')}</td><td className="px-4 py-3 font-mono text-xs">{String(entry.metadata?.order_number || entry.order_id.slice(0, 8))}</td><td className="px-4 py-3 font-medium">{reasonLabel(entry.reason)}</td><td className="px-4 py-3 text-xs">{entry.direction === 'company_owes_participant' ? 'DomiU te debe' : 'Debes entregar a DomiU'}</td><td className="px-4 py-3 text-right font-black">{formatCOP(entry.amount)}</td></tr>)}</tbody></table>{!filteredEntries.length && <div className="flex min-h-48 flex-col items-center justify-center p-8 text-center"><Wallet className="h-8 w-8 text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground">No hay movimientos en esta selección.</p></div>}</div></section>
    </div>
  );
}
