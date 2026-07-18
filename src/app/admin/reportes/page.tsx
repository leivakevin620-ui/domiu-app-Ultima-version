'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChartCard,
  RevenueLineChart,
  OrdersBarChart,
  RegistrationAreaChart,
} from '@/components/admin/dashboard-charts';
import { adminService } from '@/services/admin';
import type { SalesReport, TopBusiness, TopCourier } from '@/services/admin';
import { Card } from '@/components/ui/card';
import { CalendarDays, Download, DollarSign, ShoppingCart, TrendingUp } from 'lucide-react';

const formatCurrency = (n: number) =>
  '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });

async function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join(
    '\n',
  );
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
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
    void (async () => {
      try {
        const [sales, businesses, couriers, distribution, registrations, hourly] =
          await Promise.all([
            adminService.getSalesReport(14),
            adminService.getTopBusinesses(5),
            adminService.getTopCouriers(5),
            adminService.getStatusDistribution(),
            adminService.getUserRegistrationStats(),
            adminService.getHourlyOrders(),
          ]);
        setSalesData(sales);
        setTopBusinesses(businesses);
        setTopCouriers(couriers);
        setStatusDist(distribution);
        setUserRegs(registrations);
        setHourlyOrders(hourly);
      } catch {
        // El panel conserva los estados vacíos y permite abrir el reporte diario.
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reportes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cargando reportes...</p>
      </div>
    );
  }

  const totalRevenue = salesData.reduce((sum, day) => sum + day.revenue, 0);
  const totalOrders = salesData.reduce((sum, day) => sum + day.orders, 0);
  const statusTotal = statusDist.reduce((sum, status) => sum + status.count, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reportes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Estadísticas y análisis de la plataforma
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/reportes/diario"
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-primary-foreground"
          >
            <CalendarDays className="h-3.5 w-3.5" /> Reporte diario completo
          </Link>
          <button
            onClick={() =>
              exportCSV(
                'ventas.csv',
                ['Fecha', 'Pedidos', 'Ingresos'],
                salesData.map((day) => [
                  day.date,
                  String(day.orders),
                  formatCurrency(day.revenue),
                ]),
              )
            }
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </button>
        </div>
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
          <RevenueLineChart data={salesData.map((row) => ({ ...row, date: row.date }))} />
        </ChartCard>

        <ChartCard title="Distribución de Estados">
          {statusDist.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {statusDist.map((status) => {
                const percentage =
                  statusTotal > 0 ? Math.round((status.count / statusTotal) * 100) : 0;
                return (
                  <div key={status.status} className="flex items-center gap-3">
                    <span className="w-24 truncate text-xs capitalize text-muted-foreground">
                      {status.status.replace('_', ' ')}
                    </span>
                    <div className="h-5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-xs font-medium text-foreground">
                      {status.count} ({percentage}%)
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Top Negocios">
          {topBusinesses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {topBusinesses.map((business, index) => (
                <div
                  key={business.id}
                  className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 text-xs font-bold text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{business.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {business.order_count} pedidos · ★ {business.avg_rating.toFixed(1)}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatCurrency(business.total_revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Top Repartidores">
          {topCouriers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {topCouriers.map((courier, index) => (
                <div
                  key={courier.id}
                  className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-info/10 to-info/5 text-xs font-bold text-info">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{courier.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {courier.deliveries} entregas · ★ {courier.rating.toFixed(1)}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(courier.earnings)}</span>
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
