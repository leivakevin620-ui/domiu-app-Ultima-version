'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bike,
  Building2,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { adminService, type AuditLog, type DashboardStats } from '@/services/admin';
import { assignmentService, type CourierDriver } from '@/services/assignment';
import { dashboardFinanceService, type AdminFinancialSummary } from '@/services/dashboard-finance';
import { formatCOP } from '@/lib/formatters/currency';
import { LiveKpiCard } from './LiveKpiCard';
import { RealtimeActivityCard } from './RealtimeActivityCard';
import { AdminLiveOperationsMap } from '@/components/admin/AdminLiveOperationsMap';

const quickActions = [
  { title: 'Liquidaciones', description: 'Revisa quién debe a quién y genera desprendibles.', href: '/admin/liquidaciones', icon: FileSpreadsheet },
  { title: 'Revisar solicitudes', description: 'Aprueba negocios y repartidores pendientes.', href: '/admin/solicitudes', icon: ShieldCheck },
  { title: 'Gestionar pedidos', description: 'Supervisa pedidos activos y manuales.', href: '/admin/pedidos', icon: ShoppingBag },
  { title: 'Gestionar comercios', description: 'Controla catálogos, operación y aliados.', href: '/admin/locales', icon: Building2 },
];

export function AdminLiveDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [finance, setFinance] = useState<AdminFinancialSummary | null>(null);
  const [couriers, setCouriers] = useState<CourierDriver[]>([]);
  const [activity, setActivity] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const refreshData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const [dashboardStats, financialSummary, courierRows, recentActivity] = await Promise.all([
        adminService.getDashboardStats(),
        dashboardFinanceService.getAdminSummary(),
        assignmentService.getCouriers(),
        adminService.getRecentActivity(10),
      ]);
      setStats(dashboardStats);
      setFinance(financialSummary);
      setCouriers(courierRows || []);
      setActivity(recentActivity || []);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible actualizar el centro de control.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshData();
    const interval = window.setInterval(() => void refreshData(), 30000);
    return () => window.clearInterval(interval);
  }, [refreshData]);

  const onlineCouriers = useMemo(() => couriers.filter((courier) => courier.is_available).length, [couriers]);

  const kpis = [
    {
      icon: <Wallet className="h-5 w-5" />,
      label: 'Ganancia DomiU hoy',
      value: loading ? '...' : formatCOP(finance?.todayPlatformEarnings ?? 0),
      subtitle: 'Comisión domicilio + tarifa de servicio',
      colorClass: 'bg-amber-500',
    },
    {
      icon: <Sparkles className="h-5 w-5" />,
      label: 'Ganancia DomiU mes',
      value: loading ? '...' : formatCOP(finance?.monthPlatformEarnings ?? 0),
      subtitle: 'Últimos 30 días entregados',
      colorClass: 'bg-violet-600',
    },
    {
      icon: <Bike className="h-5 w-5" />,
      label: 'Repartidores en línea',
      value: loading ? '...' : String(onlineCouriers),
      subtitle: `${couriers.length} registrados`,
      colorClass: 'bg-emerald-600',
    },
    {
      icon: <FileSpreadsheet className="h-5 w-5" />,
      label: 'Movimientos por liquidar',
      value: loading ? '...' : String(finance?.pendingSettlementEntries ?? 0),
      subtitle: 'Obligaciones pendientes de conciliar',
      colorClass: 'bg-sky-600',
    },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 px-6 py-7 text-white shadow-xl sm:px-8 sm:py-9">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-amber-100 backdrop-blur"><Sparkles className="h-3.5 w-3.5" />Centro de control DomiU Magdalena</div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Operación, mapas y dinero en una sola vista.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Los ingresos mostrados corresponden únicamente a DomiU. Las ventas de los comercios y las ganancias de repartidores se mantienen separadas.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />Sistema operativo</div>
            <button type="button" onClick={() => void refreshData(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Actualizar</button>
          </div>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">{error}</div>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map((kpi) => <LiveKpiCard key={kpi.label} {...kpi} />)}</section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {quickActions.map(({ title, description, href, icon: Icon }) => <Link key={href} href={href} className="group rounded-3xl border border-border/70 bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"><div className="flex items-start justify-between gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" /></div><h2 className="mt-5 font-bold">{title}</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p></Link>)}
      </section>

      <AdminLiveOperationsMap />

      <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <article className="rounded-3xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Rentabilidad de plataforma</p><h2 className="mt-1 text-xl font-black">Origen de la ganancia DomiU</h2></div><Wallet className="h-6 w-6 text-primary" /></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-muted/50 p-4"><p className="text-xs font-bold text-muted-foreground">Tarifas de servicio acumuladas</p><p className="mt-2 text-2xl font-black">{formatCOP(finance?.serviceFees ?? 0)}</p></div>
            <div className="rounded-2xl bg-muted/50 p-4"><p className="text-xs font-bold text-muted-foreground">Comisión sobre domicilios</p><p className="mt-2 text-2xl font-black">{formatCOP(finance?.deliveryCommissions ?? 0)}</p></div>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:col-span-2"><p className="text-xs font-bold text-muted-foreground">Ganancia histórica DomiU</p><p className="mt-2 text-3xl font-black text-primary">{formatCOP(finance?.totalPlatformEarnings ?? 0)}</p><p className="mt-2 text-xs text-muted-foreground">No incluye el dinero perteneciente a comercios o repartidores.</p></div>
          </div>
        </article>

        <article className="rounded-3xl border bg-card p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Cuentas por conciliar</p><h2 className="mt-1 text-xl font-black">Quién le debe a quién</h2>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl bg-muted/50 p-4"><p className="text-xs font-bold text-muted-foreground">DomiU debe a comercios</p><p className="mt-1 text-xl font-black">{formatCOP(finance?.businessPayable ?? 0)}</p></div>
            <div className="rounded-2xl bg-muted/50 p-4"><p className="text-xs font-bold text-muted-foreground">DomiU debe a repartidores</p><p className="mt-1 text-xl font-black">{formatCOP(finance?.courierPayable ?? 0)}</p></div>
            <div className="rounded-2xl bg-amber-50 p-4 text-amber-950"><p className="text-xs font-bold">Repartidores deben entregar a DomiU</p><p className="mt-1 text-xl font-black">{formatCOP(finance?.courierReceivable ?? 0)}</p></div>
          </div>
          <Link href="/admin/liquidaciones" className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground"><FileSpreadsheet className="h-4 w-4" />Abrir liquidaciones</Link>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <article className="rounded-3xl border bg-card p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Plataforma</p><h2 className="mt-1 text-xl font-black">Estado general</h2>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3"><span className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" />Clientes</span><strong>{loading ? '...' : stats?.totalCustomers ?? 0}</strong></div>
            <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3"><span className="flex items-center gap-2 text-sm text-muted-foreground"><Building2 className="h-4 w-4" />Negocios activos</span><strong>{loading ? '...' : stats?.activeBusinesses ?? 0}</strong></div>
            <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3"><span className="flex items-center gap-2 text-sm text-muted-foreground"><Bike className="h-4 w-4" />Repartidores disponibles</span><strong>{loading ? '...' : onlineCouriers}</strong></div>
            <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3"><span className="flex items-center gap-2 text-sm text-muted-foreground"><ShoppingBag className="h-4 w-4" />Pedidos de hoy</span><strong>{loading ? '...' : stats?.todayOrders ?? 0}</strong></div>
          </div>
        </article>
        <RealtimeActivityCard activities={activity} loading={loading} />
      </section>
    </div>
  );
}
