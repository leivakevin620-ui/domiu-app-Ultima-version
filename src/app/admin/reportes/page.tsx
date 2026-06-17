'use client';

import React, { useEffect, useState } from 'react';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { Card } from '@/components/ui/card';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table } from 'lucide-react';

import { adminService } from '@/services/admin';
import type { SalesReport, TopBusiness, TopCourier } from '@/services/admin';

const formatCurrency = (n: number) => '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });

function MiniBarChart({ data, color = 'var(--color-primary)' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-t bg-primary/10" style={{ height: `${(d.value / max) * 100}%`, backgroundColor: color }} />
          <span className="text-[9px] text-muted-foreground truncate max-w-full">{d.label.slice(-5)}</span>
        </div>
      ))}
    </div>
  );
}

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

  useEffect(() => {
    (async () => {
      try {
        const [sales, biz, couriers, dist, regs] = await Promise.all([
          adminService.getSalesReport(14),
          adminService.getTopBusinesses(5),
          adminService.getTopCouriers(5),
          adminService.getStatusDistribution(),
          adminService.getUserRegistrationStats(),
        ]);
        setSalesData(sales);
        setTopBusinesses(biz);
        setTopCouriers(couriers);
        setStatusDist(dist);
        setUserRegs(regs);
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <PageContainer>
      <PageTitle title="Reportes" description="Estadísticas y análisis de la plataforma" />
      <p className="text-muted-foreground">Cargando reportes...</p>
    </PageContainer>
  );

  const totalRevenue = salesData.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = salesData.reduce((s, d) => s + d.orders, 0);

  return (
    <PageContainer>
      <div className="flex items-center justify-between">
        <PageTitle title="Reportes" description="Estadísticas y análisis de la plataforma" />
        <Button variant="outline" size="sm" onClick={() => exportCSV('ventas.csv', ['Fecha', 'Pedidos', 'Ingresos'], salesData.map(d => [d.date, String(d.orders), formatCurrency(d.revenue)]))}>
          <Table className="mr-1.5 h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-muted-foreground">Ingresos (14 días)</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{totalOrders}</p>
          <p className="text-xs text-muted-foreground">Pedidos (14 días)</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{topBusinesses.length}</p>
          <p className="text-xs text-muted-foreground">Top Negocios</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{topCouriers.length}</p>
          <p className="text-xs text-muted-foreground">Top Repartidores</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCard title="Ventas (últimos 14 días)" className="max-h-72">
          <MiniBarChart data={salesData.map(d => ({ label: d.date.slice(-5), value: d.revenue }))} color="var(--color-primary)" />
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span>Total: {formatCurrency(totalRevenue)}</span>
            <span className="text-right">Pedidos: {totalOrders}</span>
          </div>
        </DashboardCard>

        <DashboardCard title="Pedidos por Estado" className="max-h-72">
          {statusDist.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {statusDist.map(s => {
                const total = statusDist.reduce((a, b) => a + b.count, 0);
                const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                return (
                  <div key={s.status} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-muted-foreground capitalize">{s.status.replace('_', ' ')}</span>
                    <div className="flex-1 h-4 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-16 text-right text-xs text-foreground">{s.count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="Top Negocios">
          {topBusinesses.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos</p> : (
            <div className="space-y-3">
              {topBusinesses.map((b, i) => (
                <div key={b.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                    <span className="text-sm font-medium">{b.name}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{b.order_count} pedidos</span>
                    <span>{formatCurrency(b.total_revenue)}</span>
                    <span>{b.avg_rating} ⭐</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="Top Repartidores">
          {topCouriers.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos</p> : (
            <div className="space-y-3">
              {topCouriers.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                    <span className="text-sm font-medium">{c.name}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{c.deliveries} entregas</span>
                    <span>{c.rating} ⭐</span>
                    <span>{formatCurrency(c.earnings)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>
      </div>

      <div className="mt-6">
        <DashboardCard title="Registro de Usuarios (últimos 30 días)">
          {userRegs.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos</p> : (
            <MiniBarChart data={userRegs.map(d => ({ label: d.date.slice(-5), value: d.count }))} color="var(--color-success)" />
          )}
        </DashboardCard>
      </div>
    </PageContainer>
  );
}
