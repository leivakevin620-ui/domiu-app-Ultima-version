'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPinned,
  Package,
  Power,
  ReceiptText,
  ShoppingCart,
  Store,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { businessService, type BusinessDashboardStats } from '@/services/business';
import { dashboardFinanceService, type BusinessFinancialSummary } from '@/services/dashboard-finance';
import { financeService } from '@/services/finance';
import { formatCOP } from '@/lib/formatters/currency';
import { SkeletonStats } from '@/components/ui/skeleton';
import { BusinessLiveOperationsMap } from '@/components/business/BusinessLiveOperationsMap';

export default function NegocioDashboard() {
  const { profile } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [legacyStats, setLegacyStats] = useState<BusinessDashboardStats | null>(null);
  const [finance, setFinance] = useState<BusinessFinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingShift, setChangingShift] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const id = await businessService.getBusinessId(profile.id);
      if (!id) throw new Error('No encontramos un comercio asociado a esta cuenta.');
      setBusinessId(id);
      const [stats, financialSummary] = await Promise.all([
        businessService.getDashboardStats(id),
        dashboardFinanceService.getBusinessSummary(id),
      ]);
      setLegacyStats(stats);
      setFinance(financialSummary);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el panel');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleOperation = async () => {
    if (!businessId || changingShift) return;
    setChangingShift(true);
    setError('');
    try {
      if (finance?.currentShift) await financeService.closeBusinessShift(businessId, 'Cierre desde el panel del comercio');
      else await financeService.openBusinessShift(businessId, 'Apertura desde el panel del comercio');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el estado operativo');
    } finally {
      setChangingShift(false);
    }
  };

  const shiftDuration = useMemo(() => {
    if (!finance?.currentShift) return 'Sin jornada activa';
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(finance.currentShift.opened_at).getTime()) / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} h ${minutes} min en operación`;
  }, [finance?.currentShift]);

  if (loading) return <SkeletonStats />;

  const isOpen = Boolean(finance?.currentShift);
  const balance = finance?.balance.net_balance ?? 0;
  const balanceLabel = balance > 0
    ? `DomiU debe pagar al comercio ${formatCOP(balance)}`
    : balance < 0
      ? `El comercio debe a DomiU ${formatCOP(Math.abs(balance))}`
      : 'Liquidación al día';

  const cards = [
    { label: 'Ventas de productos hoy', value: formatCOP(finance?.todaySales ?? 0), icon: TrendingUp, help: 'Solo productos, sin domicilio ni tarifa DomiU' },
    { label: 'Ventas de productos mes', value: formatCOP(finance?.monthSales ?? 0), icon: BarChart3, help: 'Valor neto del comercio' },
    { label: 'Pedidos activos', value: String(finance?.activeOrders ?? 0), icon: ShoppingCart, help: 'En preparación o entrega' },
    { label: 'Entregados', value: String(finance?.deliveredOrders ?? 0), icon: CheckCircle2, help: 'Histórico confirmado' },
    { label: 'Ticket medio productos', value: formatCOP(finance?.averageProductTicket ?? 0), icon: ReceiptText, help: 'Promedio sin domicilio' },
    { label: 'Saldo por liquidar', value: formatCOP(Math.abs(balance)), icon: Wallet, help: balanceLabel },
    { label: 'Productos cargados', value: String(legacyStats?.totalProducts ?? 0), icon: Package, help: 'Catálogo del comercio' },
    { label: 'Cancelaciones', value: String(finance?.cancelledOrders ?? 0), icon: XCircle, help: 'Pedidos cancelados o reembolsados' },
  ];

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-[#17191F] via-[#24282E] to-[#101216] p-6 text-white shadow-xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FFD400]">Centro operativo del comercio</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Panel de {profile?.first_name || 'Negocio'}</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/65">Ventas, jornada, liquidación y seguimiento de domicilios desde una sola pantalla.</p>
          </div>
          <button type="button" onClick={() => void toggleOperation()} disabled={changingShift} className={`flex min-w-64 items-center justify-center gap-3 rounded-2xl px-5 py-4 text-sm font-black shadow-lg transition active:scale-[0.99] disabled:opacity-60 ${isOpen ? 'bg-white text-[#17191F]' : 'bg-[#FFD400] text-[#17191F]'}`}>
            {changingShift ? <Loader2 className="h-5 w-5 animate-spin" /> : <Power className="h-5 w-5" />}
            {isOpen ? 'Cerrar operación' : 'Abrir operación'}
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2"><span className={`h-3 w-3 rounded-full ${isOpen ? 'animate-pulse bg-emerald-400' : 'bg-slate-500'}`} /><span className="text-xs font-bold uppercase tracking-wide text-white/60">Estado</span></div><p className="mt-2 text-xl font-black">{isOpen ? 'Abierto y recibiendo pedidos' : 'Cerrado'}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#FFD400]" /><span className="text-xs font-bold uppercase tracking-wide text-white/60">Jornada</span></div><p className="mt-2 text-xl font-black">{shiftDuration}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-[#FFD400]" /><span className="text-xs font-bold uppercase tracking-wide text-white/60">Liquidación</span></div><p className="mt-2 text-sm font-black leading-snug">{balanceLabel}</p></div>
        </div>
      </section>

      {error && <p className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm font-medium text-destructive">{error}</p>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, help }) => (
          <article key={label} className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-black tracking-tight">{value}</p></div><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></span></div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{help}</p>
          </article>
        ))}
      </section>

      {businessId && <BusinessLiveOperationsMap businessId={businessId} />}

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-3xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-primary">Catálogo</p><h2 className="mt-1 text-xl font-black">Productos más vendidos</h2></div><Link href="/negocio/productos" className="rounded-xl border px-3 py-2 text-xs font-bold">Administrar</Link></div>
          {!legacyStats?.topProducts?.length ? <div className="mt-5 rounded-2xl border border-dashed p-8 text-center"><Store className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground">Aún no hay ventas registradas.</p></div> : <div className="mt-4 space-y-2">{legacyStats.topProducts.slice(0, 6).map((product, index) => <div key={product.id} className="flex items-center justify-between rounded-2xl border p-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-black text-primary">{index + 1}</span><span className="truncate text-sm font-bold">{product.name}</span></div><span className="text-xs font-black text-muted-foreground">{product.total} vendidos</span></div>)}</div>}
        </article>

        <article className="rounded-3xl border bg-card p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-primary">Control contable</p><h2 className="mt-1 text-xl font-black">Cómo se calcula tu ingreso</h2>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl bg-muted/50 p-4"><p className="text-xs font-bold text-muted-foreground">Ingreso del comercio</p><p className="mt-1 text-lg font-black">Productos vendidos − descuentos del comercio</p></div>
            <div className="rounded-2xl bg-muted/50 p-4"><p className="text-xs font-bold text-muted-foreground">No se incluye</p><p className="mt-1 text-sm font-semibold">El domicilio y la tarifa de servicio pertenecen a la operación logística de DomiU.</p></div>
            <Link href="/negocio/reportes" className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground"><MapPinned className="h-4 w-4" />Ver reportes y jornadas</Link>
          </div>
        </article>
      </section>
    </div>
  );
}
