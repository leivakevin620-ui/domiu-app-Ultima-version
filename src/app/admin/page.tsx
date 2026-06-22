'use client';

import React, { useEffect, useState } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { adminService } from '@/services/admin';
import { adminAuthService } from '@/services/admin-auth';
import type { DashboardStats, AuditLog, HourlyOrders, CityOrders, TopBusiness, TopCourier, TopCustomer, SalesReport } from '@/services/admin';
import type { SystemStatus } from '@/types/admin';
import { SkeletonCard } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';
const ChartCard = dynamic(() => import('@/components/admin/dashboard-charts').then(m => ({ default: m.ChartCard })), { ssr: false, loading: () => <SkeletonCard /> });
const RevenueLineChart = dynamic(() => import('@/components/admin/dashboard-charts').then(m => ({ default: m.RevenueLineChart })), { ssr: false, loading: () => <SkeletonCard /> });
const OrdersBarChart = dynamic(() => import('@/components/admin/dashboard-charts').then(m => ({ default: m.OrdersBarChart })), { ssr: false, loading: () => <SkeletonCard /> });
const StatusPieChart = dynamic(() => import('@/components/admin/dashboard-charts').then(m => ({ default: m.StatusPieChart })), { ssr: false, loading: () => <SkeletonCard /> });
const CityBarChart = dynamic(() => import('@/components/admin/dashboard-charts').then(m => ({ default: m.CityBarChart })), { ssr: false, loading: () => <SkeletonCard /> });
const RegistrationAreaChart = dynamic(() => import('@/components/admin/dashboard-charts').then(m => ({ default: m.RegistrationAreaChart })), { ssr: false, loading: () => <SkeletonCard /> });
const StatusLegend = dynamic(() => import('@/components/admin/dashboard-charts').then(m => ({ default: m.StatusLegend })), { ssr: false, loading: () => <SkeletonCard /> });
import {
  ShoppingCart, PackageCheck, XCircle, Store, Truck, Users, DollarSign, TrendingUp,
  Clock, Award, Server, CheckCircle, XCircle as XIcon, AlertTriangle,
} from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [salesReport, setSalesReport] = useState<SalesReport[]>([]);
  const [hourlyOrders, setHourlyOrders] = useState<HourlyOrders[]>([]);
  const [cityOrders, setCityOrders] = useState<CityOrders[]>([]);
  const [statusDist, setStatusDist] = useState<{ status: string; count: number }[]>([]);
  const [topBusinesses, setTopBusinesses] = useState<TopBusiness[]>([]);
  const [topCouriers, setTopCouriers] = useState<TopCourier[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [registrations, setRegistrations] = useState<{ date: string; count: number }[]>([]);
  const [recentActivity, setRecentActivity] = useState<AuditLog[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [s, report, hourly, cities, dist, biz, cour, cust, reg, logs, status] = await Promise.all([
          adminService.getDashboardStats(),
          adminService.getSalesReport(14),
          adminService.getHourlyOrders(),
          adminService.getOrdersByCity(),
          adminService.getStatusDistribution(),
          adminService.getTopBusinesses(5),
          adminService.getTopCouriers(5),
          adminService.getTopCustomers(5),
          adminService.getUserRegistrationStats(),
          adminService.getRecentActivity(8),
          adminAuthService.getSystemStatus(),
        ]);
        setStats(s); setSalesReport(report); setHourlyOrders(hourly);
        setCityOrders(cities); setStatusDist(dist); setTopBusinesses(biz);
        setTopCouriers(cour); setTopCustomers(cust); setRegistrations(reg);
        setRecentActivity(logs);
        setSystemStatus(status);
      } catch { /* ok */ }
      setLoading(false);
    })();
  }, []);

  const formatCurrency = (n: number) => '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Panel de Administración</h1>
        <p className="mt-1 text-sm text-muted-foreground">Resumen general del sistema DomiU</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-5">
        <StatCard icon={<ShoppingCart className="h-5 w-5" />} label="Pedidos Hoy" value={loading ? '...' : String(stats?.todayOrders ?? 0)} gradient="primary" />
        <StatCard icon={<PackageCheck className="h-5 w-5" />} label="Completados" value={loading ? '...' : String(stats?.completedOrders ?? 0)} gradient="success" />
        <StatCard icon={<XCircle className="h-5 w-5" />} label="Cancelados" value={loading ? '...' : String(stats?.cancelledOrders ?? 0)} gradient="warning" />
        <StatCard icon={<Store className="h-5 w-5" />} label="Negocios Activos" value={loading ? '...' : String(stats?.activeBusinesses ?? 0)} gradient="primary" />
        <StatCard icon={<Truck className="h-5 w-5" />} label="Repartidores" value={loading ? '...' : String(stats?.onlineCouriers ?? 0)} gradient="info" />
        <StatCard icon={<Users className="h-5 w-5" />} label="Clientes" value={loading ? '...' : String(stats?.totalCustomers ?? 0)} gradient="primary" />
        <StatCard icon={<Clock className="h-5 w-5" />} label="Activos" value={loading ? '...' : String(stats?.activeOrders ?? 0)} gradient="warning" />
        <StatCard icon={<DollarSign className="h-5 w-5" />} label="Ingresos Hoy" value={loading ? '...' : formatCurrency(stats?.todayRevenue ?? 0)} gradient="success" />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Ingresos del Mes" value={loading ? '...' : formatCurrency(stats?.monthRevenue ?? 0)} gradient="success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <ChartCard title="Ingresos y Pedidos (14 días)" className="xl:col-span-2">
          <RevenueLineChart data={salesReport.map(r => ({ ...r, date: r.date }))} />
        </ChartCard>
        <ChartCard title="Pedidos por Hora (Hoy)">
          <OrdersBarChart data={hourlyOrders} />
        </ChartCard>
        <ChartCard title="Distribución de Estados">
          <StatusPieChart data={statusDist} />
          <StatusLegend data={statusDist} className="mt-3 justify-center" />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <ChartCard title="Registros de Usuarios (30 días)" className="xl:col-span-2">
          <RegistrationAreaChart data={registrations} />
        </ChartCard>
        <ChartCard title="Pedidos por Ciudad">
          <CityBarChart data={cityOrders} />
        </ChartCard>
        <ChartCard title="Top Clientes">
          {topCustomers.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {topCustomers.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2.5 transition-colors hover:bg-muted/30">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 text-xs font-bold text-primary">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.order_count} pedidos</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-success">{formatCurrency(c.total_spent)}</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Top Negocios">
          {topBusinesses.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {topBusinesses.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2.5 transition-colors hover:bg-muted/30">
                  <div className="flex items-center gap-2.5">
                    <Store className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.order_count} pedidos · ★ {b.avg_rating.toFixed(1)}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(b.total_revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
        <ChartCard title="Top Repartidores">
          {topCouriers.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {topCouriers.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2.5 transition-colors hover:bg-muted/30">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-info/10 to-info/5">
                      <Truck className="h-3.5 w-3.5 text-info" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.deliveries} entregas · ★ {c.rating.toFixed(1)}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(c.earnings)}</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
        <ChartCard title="Actividad Reciente" className="max-h-80 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin actividad reciente.</p>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((log) => (
                <div key={log.id} className="flex items-start gap-3 rounded-xl border border-border/50 p-3 transition-colors hover:bg-muted/30">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
                    <Award className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">{log.admin_name || 'Admin'}</span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-medium text-primary">{log.action}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{log.entity_type}{log.details ? ` — ${log.details}` : ''}</p>
                    <p className="text-[10px] text-muted-foreground/60">{new Date(log.created_at).toLocaleString('es-CO')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <div className="border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Estado del Sistema</h3>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
          {loading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/50 p-3">
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-3 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))
          ) : (
            systemStatus.map((svc) => (
              <div key={svc.service} className="rounded-xl border border-border/50 p-3 transition-colors hover:bg-muted/20">
                <div className="flex items-center gap-2">
                  {svc.status === 'healthy' ? <CheckCircle className="h-3.5 w-3.5 text-success" />
                    : svc.status === 'degraded' ? <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    : <XIcon className="h-3.5 w-3.5 text-destructive" />}
                  <span className="text-xs font-medium text-muted-foreground">{svc.service}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={`text-sm font-semibold ${svc.status === 'healthy' ? 'text-success' : svc.status === 'degraded' ? 'text-warning' : 'text-destructive'}`}>
                    {svc.status === 'healthy' ? 'Saludable' : svc.status === 'degraded' ? 'Degradado' : 'Caído'}
                  </span>
                  {svc.latency !== null && (
                    <span className="text-[10px] text-muted-foreground">{svc.latency}ms</span>
                  )}
                </div>
                {svc.details && <p className="mt-1 text-[10px] text-muted-foreground/60">{svc.details}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
