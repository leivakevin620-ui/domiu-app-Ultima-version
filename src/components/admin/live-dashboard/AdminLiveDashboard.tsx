'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bike,
  Building2,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  RefreshCw,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UnlockKeyhole,
  Users,
  WalletCards,
} from 'lucide-react';
import { adminService } from '@/services/admin';
import { orderService } from '@/services/orders';
import { assignmentService, type CourierDriver } from '@/services/assignment';
import type { OrderData } from '@/services/orders';
import type { AuditLog, DashboardStats } from '@/services/admin';
import { LiveKpiCard } from './LiveKpiCard';
import { LiveOrdersPanel } from './LiveOrdersPanel';
import { RealtimeActivityCard } from './RealtimeActivityCard';
import { ChartCard, RevenueLineChart } from '@/components/admin/dashboard-charts';
import { getBrowserClient } from '@/lib/db/supabase';
import { formatCOP } from '@/lib/money';

const quickActions = [
  { title: 'Liquidaciones', description: 'Concilia saldos de repartidores y comercios.', href: '/admin/liquidaciones', icon: Scale },
  { title: 'Revisar solicitudes', description: 'Aprueba negocios y repartidores pendientes.', href: '/admin/solicitudes', icon: ShieldCheck },
  { title: 'Gestionar pedidos', description: 'Supervisa pedidos activos y manuales.', href: '/admin/pedidos', icon: ShoppingBag },
  { title: 'Crear negocio', description: 'Registra un nuevo aliado comercial.', href: '/admin/negocios/crear', icon: Building2 },
];

function bogotaDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function AdminLiveDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [couriers, setCouriers] = useState<CourierDriver[]>([]);
  const [activity, setActivity] = useState<AuditLog[]>([]);
  const [salesReport, setSalesReport] = useState<Array<{ date: string; revenue?: number; orders?: number }>>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [platformToday, setPlatformToday] = useState(0);
  const [platformMonth, setPlatformMonth] = useState(0);
  const [operationOpen, setOperationOpen] = useState(false);
  const [operationSince, setOperationSince] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [changingOperation, setChangingOperation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    const supabase = getBrowserClient();
    const today = bogotaDate();
    const monthStart = `${today.slice(0, 7)}-01`;

    try {
      const [dashboardStats, availableOrders, activeCouriers, recentActivity, report, todayFinance, monthFinance, operation] = await Promise.all([
        adminService.getDashboardStats(),
        orderService.getAvailableOrders(),
        assignmentService.getCouriers(),
        adminService.getRecentActivity(8),
        adminService.getSalesReport(14).catch(() => []),
        supabase.from('daily_platform_financial_report').select('platform_revenue').eq('operation_date', today).maybeSingle(),
        supabase.from('daily_platform_financial_report').select('platform_revenue').gte('operation_date', monthStart).lte('operation_date', today),
        supabase.from('operations_days').select('id,status,opened_at').eq('status', 'open').maybeSingle(),
      ]);

      setStats(dashboardStats);
      setOrders(availableOrders || []);
      setCouriers(activeCouriers || []);
      setActivity(recentActivity || []);
      setSalesReport(report || []);
      setPlatformToday(Number(todayFinance.data?.platform_revenue ?? 0));
      setPlatformMonth((monthFinance.data ?? []).reduce((sum, row) => sum + Number(row.platform_revenue ?? 0), 0));
      setOperationOpen(Boolean(operation.data));
      setOperationSince(operation.data?.opened_at ?? null);
      setError(null);
    } catch (cause) {
      console.error('[AdminLiveDashboard] Error loading data:', cause);
      setError('No fue posible actualizar toda la información operativa.');
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

  const toggleOperation = async () => {
    if (changingOperation) return;
    setChangingOperation(true);
    setError(null);
    const supabase = getBrowserClient();
    try {
      const { error: rpcError } = await supabase.rpc(operationOpen ? 'close_platform_operation' : 'open_platform_operation', {
        p_notes: operationOpen ? 'Cierre desde el panel administrativo' : 'Apertura desde el panel administrativo',
      });
      if (rpcError) throw new Error(rpcError.message);
      await refreshData(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el estado de operaciones');
    } finally {
      setChangingOperation(false);
    }
  };

  const onlineCouriers = useMemo(() => couriers.filter((courier) => courier.is_available).length, [couriers]);
  const inTransitOrders = useMemo(() => orders.filter((order) => ['accepted', 'picked_up', 'in_transit'].includes(order.status)).length, [orders]);

  const kpis = [
    { icon: <ShoppingBag className="h-5 w-5" />, label: 'Pedidos de hoy', value: loading ? '...' : String(stats?.todayOrders ?? 0), subtitle: 'Pedidos creados', colorClass: 'bg-violet-600' },
    { icon: <Bike className="h-5 w-5" />, label: 'Repartidores disponibles', value: loading ? '...' : String(onlineCouriers), subtitle: 'Conectados ahora', colorClass: 'bg-emerald-600' },
    { icon: <CheckCircle2 className="h-5 w-5" />, label: 'Entregas completadas', value: loading ? '...' : String(stats?.completedOrders ?? 0), subtitle: 'Completadas hoy', colorClass: 'bg-sky-600' },
    { icon: <WalletCards className="h-5 w-5" />, label: 'Ganancia DomiU hoy', value: loading ? '...' : formatCOP(platformToday), subtitle: 'Servicio + comisión del domicilio', colorClass: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 px-6 py-7 text-white shadow-xl sm:px-8 sm:py-9">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-violet-100"><Sparkles className="h-3.5 w-3.5" />Centro de control DomiU</div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Operación y dinero, en una sola vista.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">Seguimiento en vivo, ingresos reales de DomiU, jornadas y liquidaciones con trazabilidad por pedido.</p>
            <div className="mt-5 flex flex-wrap gap-3 text-xs">
              <span className="rounded-full bg-white/10 px-3 py-2">Mes DomiU: <strong>{formatCOP(platformMonth)}</strong></span>
              <span className="rounded-full bg-white/10 px-3 py-2">En reparto: <strong>{inTransitOrders}</strong></span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void toggleOperation()} disabled={changingOperation} className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition disabled:opacity-60 ${operationOpen ? 'border border-red-300/20 bg-red-400/10 text-red-100 hover:bg-red-400/20' : 'bg-[#FFD400] text-[#17191F] hover:bg-[#FFE25A]'}`}>
              {operationOpen ? <LockKeyhole className="h-4 w-4" /> : <UnlockKeyhole className="h-4 w-4" />}
              {changingOperation ? 'Procesando…' : operationOpen ? 'Cerrar operaciones' : 'Abrir operaciones'}
            </button>
            <button type="button" onClick={() => void refreshData(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/15 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Actualizar</button>
          </div>
        </div>
      </section>

      <div className={`flex items-center justify-between rounded-2xl border px-5 py-4 ${operationOpen ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
        <div><p className="font-black">{operationOpen ? 'Operaciones abiertas' : 'Operaciones cerradas'}</p><p className="text-xs">{operationOpen && operationSince ? `Jornada iniciada ${new Date(operationSince).toLocaleString('es-CO')}` : 'No se permiten jornadas nuevas hasta abrir la operación.'}</p></div>
        <span className={`h-3 w-3 rounded-full ${operationOpen ? 'animate-pulse bg-emerald-500' : 'bg-amber-500'}`} />
      </div>

      {error && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">{error}</div>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map((kpi) => <LiveKpiCard key={kpi.label} {...kpi} />)}</section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {quickActions.map(({ title, description, href, icon: Icon }) => (
          <Link key={href} href={href} className="group rounded-3xl border border-border/70 bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg">
            <div className="flex items-start justify-between gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" /></div>
            <h2 className="mt-5 font-bold">{title}</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <ChartCard title="Actividad de los últimos 14 días"><RevenueLineChart data={salesReport.map((item) => ({ ...item, date: item.date }))} /></ChartCard>
        <div className="rounded-3xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Operación actual</p><h2 className="mt-1 text-lg font-bold">Pulso de la plataforma</h2></div><Clock3 className="h-5 w-5 text-primary" /></div>
          <div className="mt-6 space-y-3">
            <div className="flex justify-between rounded-2xl bg-muted/50 px-4 py-3"><span className="text-sm text-muted-foreground">Pedidos disponibles</span><strong>{loading ? '...' : orders.length}</strong></div>
            <div className="flex justify-between rounded-2xl bg-muted/50 px-4 py-3"><span className="text-sm text-muted-foreground">Pedidos en reparto</span><strong>{loading ? '...' : inTransitOrders}</strong></div>
            <div className="flex justify-between rounded-2xl bg-muted/50 px-4 py-3"><span className="text-sm text-muted-foreground">Clientes registrados</span><strong>{loading ? '...' : stats?.totalCustomers ?? 0}</strong></div>
          </div>
          <Link href="/admin/reportes" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">Ver reportes completos <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <LiveOrdersPanel orders={orders} loading={loading} selectedOrderId={selectedOrderId} onSelectOrder={(id) => setSelectedOrderId((current) => current === id ? null : id)} />
        <RealtimeActivityCard activities={activity} loading={loading} />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border bg-card p-5"><Users className="h-5 w-5 text-primary" /><p className="mt-4 text-sm text-muted-foreground">Clientes registrados</p><p className="mt-1 text-2xl font-black">{loading ? '...' : stats?.totalCustomers ?? 0}</p></div>
        <div className="rounded-3xl border bg-card p-5"><Building2 className="h-5 w-5 text-primary" /><p className="mt-4 text-sm text-muted-foreground">Negocios activos</p><p className="mt-1 text-2xl font-black">{loading ? '...' : stats?.activeBusinesses ?? 0}</p></div>
        <div className="rounded-3xl border bg-card p-5"><Bike className="h-5 w-5 text-primary" /><p className="mt-4 text-sm text-muted-foreground">Repartidores disponibles</p><p className="mt-1 text-2xl font-black">{loading ? '...' : onlineCouriers}</p></div>
      </section>
    </div>
  );
}
