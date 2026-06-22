'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { businessService, type BusinessReport } from '@/services/business';
import { SkeletonStats } from '@/components/ui/skeleton';
import { BarChart3, TrendingUp, Clock, Package, Download } from 'lucide-react';
import dynamic from 'next/dynamic';
const SalesLineChart = dynamic(() => import('@/components/charts/business-report-charts').then(m => ({ default: m.SalesLineChart })), { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-xl bg-muted" /> });
const TopProductsBarChart = dynamic(() => import('@/components/charts/business-report-charts').then(m => ({ default: m.TopProductsBarChart })), { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-xl bg-muted" /> });
const PeakHoursBarChart = dynamic(() => import('@/components/charts/business-report-charts').then(m => ({ default: m.PeakHoursBarChart })), { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-xl bg-muted" /> });

const formatCurrency = (n: number) => '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });

export default function NegocioReportes() {
  const { profile } = useAuth();
  const [report, setReport] = useState<BusinessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sales' | 'products' | 'hours'>('sales');

  useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      const bizId = await businessService.getBusinessId(profile.id);
      if (bizId) setReport(await businessService.getReport(bizId));
      setLoading(false);
    })();
  }, [profile?.id]);

  const exportCSV = () => {
    if (!report) return;
    const rows = report.dailySales.map((d) => `${d.date},${d.revenue},${d.orders}`);
    const csv = 'Fecha,Ingresos,Pedidos\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'reporte-ventas.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <SkeletonStats />;
  if (!report) return <div className="p-12 text-center text-muted-foreground">Sin datos disponibles</div>;

  const totalRevenue = report.dailySales.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = report.dailySales.reduce((s, d) => s + d.orders, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-warning/10 to-warning/5">
            <BarChart3 className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reportes</h1>
            <p className="mt-1 text-sm text-muted-foreground">Últimos 30 días · {formatCurrency(totalRevenue)} ingresos · {totalOrders} pedidos</p>
          </div>
        </div>
        <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
          <Download className="h-4 w-4" /> Exportar CSV
        </button>
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-background/50 p-1 w-fit">
        {[
          { key: 'sales', label: 'Ventas Diarias', icon: TrendingUp },
          { key: 'products', label: 'Productos Top', icon: Package },
          { key: 'hours', label: 'Horas Pico', icon: Clock },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as 'sales' | 'products' | 'hours')} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'sales' && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Ventas Diarias (30 días)</h3>
          <div className="h-72">
            <SalesLineChart data={report.dailySales} />
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Productos Más Vendidos</h3>
          {report.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay datos de productos en este período.</p>
          ) : (
            <div className="h-72">
              <TopProductsBarChart data={report.topProducts} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'hours' && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Horas de Mayor Actividad</h3>
          {report.peakHours.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay datos de horas en este período.</p>
          ) : (
            <div className="h-72">
              <PeakHoursBarChart data={report.peakHours} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
