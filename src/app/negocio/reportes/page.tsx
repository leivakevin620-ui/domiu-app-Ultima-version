'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { businessService, type BusinessReport } from '@/services/business';
import { getBrowserClient } from '@/lib/db/supabase';
import { SkeletonStats } from '@/components/ui/skeleton';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Package,
  Download,
  Wallet,
  ReceiptText,
  CircleDollarSign,
  RefreshCw,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const SalesLineChart = dynamic(
  () =>
    import('@/components/charts/business-report-charts').then((module) => ({
      default: module.SalesLineChart,
    })),
  { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-xl bg-muted" /> },
);
const TopProductsBarChart = dynamic(
  () =>
    import('@/components/charts/business-report-charts').then((module) => ({
      default: module.TopProductsBarChart,
    })),
  { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-xl bg-muted" /> },
);
const PeakHoursBarChart = dynamic(
  () =>
    import('@/components/charts/business-report-charts').then((module) => ({
      default: module.PeakHoursBarChart,
    })),
  { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-xl bg-muted" /> },
);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);

export default function NegocioReportes() {
  const { profile } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [report, setReport] = useState<BusinessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'sales' | 'products' | 'hours'>('sales');

  const loadReport = useCallback(async (showSpinner = false) => {
    if (!profile?.id) return;
    if (showSpinner) setRefreshing(true);
    try {
      const id = businessId || (await businessService.getBusinessId(profile.id));
      if (!id) {
        setReport(null);
        setError('No se encontró el negocio asociado a esta cuenta.');
        return;
      }
      if (!businessId) setBusinessId(id);
      setReport(await businessService.getReport(id));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo generar el reporte.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId, profile?.id]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (!businessId) return;
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`business-reports-${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `business_id=eq.${businessId}`,
        },
        () => void loadReport(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [businessId, loadReport]);

  const exportCSV = () => {
    if (!report) return;
    const rows = report.dailySales.map((day) => `${day.date},${day.revenue},${day.orders}`);
    const summary = [
      '',
      'Resumen,Valor',
      `Valor total de pedidos,${report.summary.totalOrderValue}`,
      `Ingresos cobrados,${report.summary.collectedRevenue}`,
      `Pendiente por cobrar,${report.summary.pendingRevenue}`,
      `Pedidos activos,${report.summary.activeOrders}`,
      `Pedidos entregados,${report.summary.deliveredOrders}`,
      `Pedidos cancelados,${report.summary.cancelledOrders}`,
    ];
    const csv = ['Fecha,Valor de pedidos,Pedidos', ...rows, ...summary].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `reporte-olma-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <SkeletonStats />;
  if (!report) {
    return (
      <div className="rounded-2xl border p-12 text-center text-muted-foreground">
        {error || 'Sin datos disponibles'}
      </div>
    );
  }

  const totalOrders = report.dailySales.reduce((total, day) => total + day.orders, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
            <BarChart3 className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reportes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Información operativa y contable de los últimos 30 días · {totalOrders} pedidos
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadReport(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar
          </button>
          <button
            type="button"
            onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium"
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Valor de pedidos</p>
            <ReceiptText className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(report.summary.totalOrderValue)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Todos los pedidos válidos del período</p>
        </article>
        <article className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Ingresos cobrados</p>
            <Wallet className="h-4 w-4 text-success" />
          </div>
          <p className="mt-2 text-2xl font-bold text-success">
            {formatCurrency(report.summary.collectedRevenue)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Pagados o entregados</p>
        </article>
        <article className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Pendiente por cobrar</p>
            <CircleDollarSign className="h-4 w-4 text-warning" />
          </div>
          <p className="mt-2 text-2xl font-bold text-warning">
            {formatCurrency(report.summary.pendingRevenue)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Pedidos aún no finalizados o sin pago</p>
        </article>
        <article className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Operación</p>
            <Package className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold">{report.summary.activeOrders} activos</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {report.summary.deliveredOrders} entregados · {report.summary.cancelledOrders} cancelados
          </p>
        </article>
      </div>

      <div className="flex w-fit gap-1 rounded-xl border bg-background/50 p-1">
        {[
          { key: 'sales', label: 'Ventas diarias', icon: TrendingUp },
          { key: 'products', label: 'Productos top', icon: Package },
          { key: 'hours', label: 'Horas pico', icon: Clock },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as 'sales' | 'products' | 'hours')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'sales' && (
        <div className="rounded-2xl border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold">Valor diario de pedidos (30 días)</h3>
          <div className="h-72">
            <SalesLineChart data={report.dailySales} />
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="rounded-2xl border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold">Productos más vendidos</h3>
          {report.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay productos vendidos en este período.</p>
          ) : (
            <div className="h-72">
              <TopProductsBarChart data={report.topProducts} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'hours' && (
        <div className="rounded-2xl border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold">Horas de mayor actividad</h3>
          {report.peakHours.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay suficientes pedidos para calcular horas pico.</p>
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
