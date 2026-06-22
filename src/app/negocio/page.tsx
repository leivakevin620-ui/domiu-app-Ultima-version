'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { businessService, type BusinessDashboardStats } from '@/services/business';
import { SkeletonStats } from '@/components/ui/skeleton';
import { DollarSign, ShoppingCart, Package, TrendingUp, Star, Clock, Users, CheckCircle, XCircle, BarChart3, Wallet, Store, Award } from 'lucide-react';

const formatCurrency = (n: number) => '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function NegocioDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<BusinessDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      try {
        const bizId = await businessService.getBusinessId(profile.id!);
        if (bizId) setStats(await businessService.getDashboardStats(bizId));
      } catch { /* ok */ }
      setLoading(false);
    })();
  }, [profile?.id]);

  if (loading) return <SkeletonStats />;

  const kpis = [
    { icon: <DollarSign className="h-5 w-5" />, label: 'Ventas Hoy', value: formatCurrency(stats?.todayRevenue ?? 0), gradient: 'success' as const, subtitle: 'Ingresos del día' },
    { icon: <TrendingUp className="h-5 w-5" />, label: 'Ventas Semana', value: formatCurrency(stats?.weekRevenue ?? 0), gradient: 'primary' as const, subtitle: 'Últimos 7 días' },
    { icon: <BarChart3 className="h-5 w-5" />, label: 'Ventas Mes', value: formatCurrency(stats?.monthRevenue ?? 0), gradient: 'info' as const, subtitle: 'Últimos 30 días' },
    { icon: <ShoppingCart className="h-5 w-5" />, label: 'Pedidos Activos', value: String(stats?.activeOrders ?? 0), gradient: 'warning' as const, subtitle: 'En proceso' },
    { icon: <CheckCircle className="h-5 w-5" />, label: 'Entregados', value: String(stats?.deliveredOrders ?? 0), gradient: 'success' as const, subtitle: 'Total entregados' },
    { icon: <XCircle className="h-5 w-5" />, label: 'Cancelaciones', value: String(stats?.cancelledOrders ?? 0), gradient: 'destructive' as const, subtitle: 'Total cancelados' },
    { icon: <Wallet className="h-5 w-5" />, label: 'Ticket Promedio', value: formatCurrency(stats?.avgTicket ?? 0), gradient: 'primary' as const, subtitle: 'Por pedido' },
    { icon: <Clock className="h-5 w-5" />, label: 'Prep. Promedio', value: `${stats?.avgPrepTime ?? 0} min`, gradient: 'warning' as const, subtitle: 'Tiempo medio' },
    { icon: <Users className="h-5 w-5" />, label: 'Clientes Nuevos', value: String(stats?.newCustomers ?? 0), gradient: 'info' as const, subtitle: 'Último mes' },
    { icon: <Award className="h-5 w-5" />, label: 'Clientes Frecuentes', value: String(stats?.frequentCustomers ?? 0), gradient: 'success' as const, subtitle: '3+ pedidos' },
    { icon: <Star className="h-5 w-5" />, label: 'Calificación', value: (stats?.rating ?? 0).toFixed(1), gradient: 'warning' as const, subtitle: `${stats?.totalRatings ?? 0} reseñas` },
    { icon: <DollarSign className="h-5 w-5" />, label: 'Comisión Pagada', value: formatCurrency(stats?.commissionPaid ?? 0), gradient: 'destructive' as const, subtitle: 'Total comisiones' },
    { icon: <Store className="h-5 w-5" />, label: 'Ganancia Neta', value: formatCurrency(stats?.netProfit ?? 0), gradient: 'success' as const, subtitle: 'Ingresos - comisiones' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Panel de Negocio</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bienvenido, {profile?.first_name ?? 'Negocio'} — Resumen de tu rendimiento</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-success/5 to-success/[0.02] border border-success/20 px-4 py-2">
          <div className="flex h-2.5 w-2.5 items-center justify-center">
            <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-success/40" />
            <span className="relative h-2 w-2 rounded-full bg-success" />
          </div>
          <span className="text-xs font-medium text-success">Abierto</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
            <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-gradient-to-br from-foreground/[0.02] to-foreground/[0.01]" />
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-${kpi.gradient}/10 to-${kpi.gradient}/5`}>
                {kpi.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
                <p className="text-lg font-bold text-foreground truncate">{typeof kpi.value === 'number' ? kpi.value : kpi.value}</p>
              </div>
            </div>
            {kpi.subtitle && <p className="mt-2 text-[10px] text-muted-foreground/60">{kpi.subtitle}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Productos Más Vendidos</h3>
            </div>
            <span className="text-xs text-muted-foreground">{stats?.totalProducts ?? 0} productos</span>
          </div>
          <div className="p-5">
            {!stats?.topProducts?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin productos vendidos aún</p>
            ) : (
              <div className="space-y-2">
                {stats.topProducts.slice(0, 7).map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2.5 transition-colors hover:bg-muted/20">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 text-[10px] font-bold text-primary">{i + 1}</span>
                      <span className="text-sm font-medium text-foreground">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{p.total} vendidos</span>
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${Math.min(100, (p.total / Math.max(...stats.topProducts.map(x => x.total))) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Resumen General</h3>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {[
              { label: 'Total Productos', value: String(stats?.totalProducts ?? 0) },
              { label: 'Total Pedidos', value: String(stats?.totalOrders ?? 0) },
              { label: 'Calificación Promedio', value: `${(stats?.rating ?? 0).toFixed(1)} ⭐` },
              { label: 'Comisión Total', value: formatCurrency(stats?.commissionPaid ?? 0) },
              { label: 'Ganancia Neta', value: formatCurrency(stats?.netProfit ?? 0) },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="text-sm font-semibold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
