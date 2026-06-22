'use client';

import React, { useEffect, useState } from 'react';
import { SkeletonCard } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';
const ChartCard = dynamic(() => import('@/components/admin/dashboard-charts').then(m => ({ default: m.ChartCard })), { ssr: false, loading: () => <SkeletonCard /> });
const RevenueLineChart = dynamic(() => import('@/components/admin/dashboard-charts').then(m => ({ default: m.RevenueLineChart })), { ssr: false, loading: () => <SkeletonCard /> });
const OrdersBarChart = dynamic(() => import('@/components/admin/dashboard-charts').then(m => ({ default: m.OrdersBarChart })), { ssr: false, loading: () => <SkeletonCard /> });
const RegistrationAreaChart = dynamic(() => import('@/components/admin/dashboard-charts').then(m => ({ default: m.RegistrationAreaChart })), { ssr: false, loading: () => <SkeletonCard /> });
import { adminService } from '@/services/admin';
import type { SalesReport, TopBusiness, TopCourier } from '@/services/admin';
import { Card } from '@/components/ui/card';
import { Download, DollarSign, ShoppingCart, TrendingUp } from 'lucide-react';

const formatCurrency = (n: number) => '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });

async function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminReports() {
  const [salesData, setSalesData] = useState<SalesReport[]>([]);
  const [topBusinesses, setTopBusinesses] = useState<TopBusiness[]>([]);
  const [topCouriers, setTopCouriers] = useState<TopCourier[]>([]);
  const [statusDist, setStatusDist] = useState<{ status: string; count: number }[]>([]);
  const [userRegs, setUserRegs] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [hourlyOrders, setHourlyOrders] = useState<{ hour: number; count: number }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [sales, biz, couriers, dist, regs, hourly] = await Promise.all([
          adminService.getSalesReport(14),
          adminService.getTopBusinesses(5),
          adminService.getTopCouriers(5),
          adminService.getStatusDistribution(),
          adminService.getUserRegistrationStats(),
          adminService.getHourlyOrders(),
        ]);
        setSalesData(sales);
        setTopBusinesses(biz);
        setTopCouriers(couriers);
        setStatusDist(dist);
        setUserRegs(regs);
        setHourlyOrders(hourly);
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reportes</h1>
      <p className="mt-1 text-sm text-muted-foreground">Cargando reportes...</p>
    </div>
  );

  const totalRevenue = salesData.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = salesData.reduce((s, d) => s + d.orders, 0);
  const statusTotal = statusDist.reduce((a, b) => a + b.count, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reportes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Estadísticas y análisis de la plataforma</p>
        </div>
        <button
          onClick={() => exportCSV('ventas.csv', ['Fecha', 'Pedidos', 'Ingresos'], salesData.map(d => [d.date, String(d.orders), formatCurrency(d.revenue)]))}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="absolute right-3 top-3 text-primary/20">
            <DollarSign className="h-8 w-8" />
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Ingresos (14 días)</p>
        </Card>
        <Card className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="absolute right-3 top-3 text-primary/20">
            <ShoppingCart className="h-8 w-8" />
          </div>
          <p className="text-2xl font-bold text-foreground">{totalOrders}</p>
          <p className="mt-1 text-xs text-muted-foreground">Pedidos (14 días)</p>
        </Card>
        <Card className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="absolute right-3 top-3 text-success/20">
            <TrendingUp className="h-8 w-8" />
          </div>
          <p className="text-2xl font-bold text-foreground">{topBusinesses.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Top Negocios</p>
        </Card>
        <Card className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="absolute right-3 top-3 text-info/20">
            <TrendingUp className="h-8 w-8" />
          </div>
          <p className="text-2xl font-bold text-foreground">{topCouriers.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Top Repartidores</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Ventas (últimos 14 días)">
          <RevenueLineChart data={salesData.map(r => ({ ...r, date: r.date }))} />
        </ChartCard>

        <ChartCard title="Distribución de Estados">
          {statusDist.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {statusDist.map(s => {
                const pct = statusTotal > 0 ? Math.round((s.count / statusTotal) * 100) : 0;
                return (
                  <div key={s.status} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-muted-foreground capitalize truncate">{s.status.replace('_', ' ')}</span>
                    <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-20 text-right text-xs text-foreground font-medium">{s.count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Top Negocios">
          {topBusinesses.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos</p> : (
            <div className="space-y-3">
              {topBusinesses.map((b, i) => (
                <div key={b.id} className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 text-xs font-bold text-primary">
                      {i + 1}
                    </div>
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
          {topCouriers.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos</p> : (
            <div className="space-y-3">
              {topCouriers.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-info/10 to-info/5 text-xs font-bold text-info">
                      {i + 1}
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Pedidos por Hora (Hoy)">
          <OrdersBarChart data={hourlyOrders} />
        </ChartCard>
        <ChartCard title="Registro de Usuarios (30 días)">
          <RegistrationAreaChart data={userRegs} />
        </ChartCard>
      </div>
    </div>
  );
}
