'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bike,
  Building2,
  CheckCircle2,
  Clock3,
  DollarSign,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
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

function formatCurrency(value: number) {
  return `$${value.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

const quickActions = [
  {
    title: 'Revisar solicitudes',
    description: 'Aprueba negocios y repartidores pendientes.',
    href: '/admin/solicitudes',
    icon: ShieldCheck,
  },
  {
    title: 'Crear negocio',
    description: 'Registra un nuevo aliado comercial.',
    href: '/admin/negocios/crear',
    icon: Building2,
  },
  {
    title: 'Gestionar pedidos',
    description: 'Supervisa pedidos activos y manuales.',
    href: '/admin/pedidos',
    icon: ShoppingBag,
  },
];

export function AdminLiveDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [couriers, setCouriers] = useState<CourierDriver[]>([]);
  const [activity, setActivity] = useState<AuditLog[]>([]);
  const [salesReport, setSalesReport] = useState<Array<{ date: string; revenue?: number; orders?: number }>>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);

    try {
      const [dashboardStats, availableOrders, activeCouriers, recentActivity, report] = await Promise.all([
        adminService.getDashboardStats(),
        orderService.getAvailableOrders(),
        assignmentService.getCouriers(),
        adminService.getRecentActivity(8),
        adminService.getSalesReport(14).catch(() => []),
      ]);

      setStats(dashboardStats);
      setOrders(availableOrders || []);
      setCouriers(activeCouriers || []);
      setActivity(recentActivity || []);
      setSalesReport(report || []);
      setError(null);
    } catch (cause) {
      console.error('[AdminLiveDashboard] Error loading data:', cause);
      setError('No fue posible actualizar la información operativa.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    const interval = window.setInterval(() => refreshData(), 30000);
    return () => window.clearInterval(interval);
  }, [refreshData]);

  const onlineCouriers = useMemo(
    () => couriers.filter((courier) => courier.is_available).length,
    [couriers],
  );

  const inTransitOrders = useMemo(
    () => orders.filter((order) => order.status === 'in_transit').length,
    [orders],
  );

  const kpis = [
    {
      icon: <ShoppingBag className="h-5 w-5" />,
      label: 'Pedidos de hoy',
      value: loading ? '...' : String(stats?.todayOrders ?? 0),
      subtitle: 'Actividad registrada hoy',
      colorClass: 'bg-violet-600',
    },
    {
      icon: <Bike className="h-5 w-5" />,
      label: 'Repartidores en línea',
      value: loading ? '...' : String(onlineCouriers),
      subtitle: 'Disponibles ahora',
      colorClass: 'bg-emerald-600',
    },
    {
      icon: <CheckCircle2 className="h-5 w-5" />,
      label: 'Entregas completadas',
      value: loading ? '...' : String(stats?.completedOrders ?? 0),
      subtitle: 'Completadas hoy',
      colorClass: 'bg-sky-600',
    },
    {
      icon: <DollarSign className="h-5 w-5" />,
      label: 'Ingresos del día',
      value: loading ? '...' : formatCurrency(stats?.todayRevenue ?? 0),
      subtitle: 'Venta bruta estimada',
      colorClass: 'bg-amber-500',
    },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 px-6 py-7 text-white shadow-xl sm:px-8 sm:py-9">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-violet-100 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Centro de control DomiU
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              Todo lo importante, sin ruido.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Supervisa la operación, atiende pendientes y toma decisiones desde una vista más clara y ejecutiva.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
              Sistema operativo
            </div>
            <button
              type="button"
              onClick={() => refreshData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <LiveKpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {quickActions.map(({ title, description, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-3xl border border-border/70 bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
            </div>
            <h2 className="mt-5 font-bold text-foreground">{title}</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <ChartCard title="Rendimiento de los últimos 14 días">
          <RevenueLineChart data={salesReport.map((item) => ({ ...item, date: item.date }))} />
        </ChartCard>

        <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Operación actual</p>
              <h2 className="mt-1 text-lg font-bold text-foreground">Pulso de la plataforma</h2>
            </div>
            <Clock3 className="h-5 w-5 text-primary" />
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
              <span className="text-sm text-muted-foreground">Pedidos disponibles</span>
              <strong className="text-foreground">{loading ? '...' : orders.length}</strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
              <span className="text-sm text-muted-foreground">Pedidos en camino</span>
              <strong className="text-foreground">{loading ? '...' : inTransitOrders}</strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
              <span className="text-sm text-muted-foreground">Repartidores registrados</span>
              <strong className="text-foreground">{loading ? '...' : couriers.length}</strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
              <span className="text-sm text-muted-foreground">Clientes registrados</span>
              <strong className="text-foreground">{loading ? '...' : stats?.totalCustomers ?? 0}</strong>
            </div>
          </div>

          <Link
            href="/admin/reportes"
            className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
          >
            Ver reportes completos
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <LiveOrdersPanel
          orders={orders}
          loading={loading}
          selectedOrderId={selectedOrderId}
          onSelectOrder={(id) => setSelectedOrderId((current) => current === id ? null : id)}
        />
        <RealtimeActivityCard activities={activity} loading={loading} />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-border/70 bg-card p-5">
          <Users className="h-5 w-5 text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Clientes registrados</p>
          <p className="mt-1 text-2xl font-black text-foreground">{loading ? '...' : stats?.totalCustomers ?? 0}</p>
        </div>
        <div className="rounded-3xl border border-border/70 bg-card p-5">
          <Building2 className="h-5 w-5 text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Negocios activos</p>
          <p className="mt-1 text-2xl font-black text-foreground">{loading ? '...' : stats?.activeBusinesses ?? 0}</p>
        </div>
        <div className="rounded-3xl border border-border/70 bg-card p-5">
          <Bike className="h-5 w-5 text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Repartidores disponibles</p>
          <p className="mt-1 text-2xl font-black text-foreground">{loading ? '...' : onlineCouriers}</p>
        </div>
      </section>
    </div>
  );
}
