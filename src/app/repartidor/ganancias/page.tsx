'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CourierProvider, useCourier } from '@/contexts/CourierContext';
import { courierProService, type DailyEarningPoint } from '@/services/courier-pro';
import { reportService } from '@/services/reports';
import { SkeletonStats } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, Download, Gift, PiggyBank } from 'lucide-react';
import dynamic from 'next/dynamic';
const EarningsChart = dynamic(() => import('@/components/charts/earnings-chart').then(m => ({ default: m.EarningsChart })), {
  ssr: false,
  loading: () => <div className="h-48 animate-pulse rounded-xl bg-muted" />,
});

const formatCurrency = (n: number) => '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });

function GananciasContent() {
  const { loading, todayEarnings, weekEarnings, monthEarnings, totalEarnings, earnings } = useCourier();
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [history, setHistory] = useState<DailyEarningPoint[]>([]);
  const [histLoading, setHistLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!earnings.length) { setHistLoading(false); return; }
      const courierId = earnings[0]?.order_id?.replace('earn-', '') || '';
      if (courierId) {
        const h = await courierProService.getEarningsHistory(courierId);
        setHistory(h);
      }
      setHistLoading(false);
    })();
  }, [earnings]);

  const exportCSV = async () => {
    const csv = await reportService.exportCourierEarningsCSV();
    reportService.downloadCSV('ganancias-repartidor', csv);
  };

  const filterDays = period === 'today' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 365;
  const filteredHistory = history.filter((d) => {
    const diff = (new Date().getTime() - new Date(d.date).getTime()) / 86400000;
    return diff <= filterDays;
  });

  if (loading) return <SkeletonStats />;

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-success/10 to-success/5">
            <DollarSign className="h-5 w-5 text-success" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Ganancias</h1>
            <p className="mt-1 text-sm text-muted-foreground">{formatCurrency(totalEarnings)} total generado</p>
          </div>
        </div>
        <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
          <Download className="h-4 w-4" /> Exportar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Hoy', value: formatCurrency(todayEarnings), icon: TrendingUp, change: '+12%', color: 'text-success', gradient: 'from-success/10 to-emerald-500/5' },
          { label: 'Semana', value: formatCurrency(weekEarnings), icon: TrendingUp, change: '+8%', color: 'text-info', gradient: 'from-info/10 to-blue-500/5' },
          { label: 'Mes', value: formatCurrency(monthEarnings), icon: TrendingUp, change: '+15%', color: 'text-warning', gradient: 'from-warning/10 to-orange-500/5' },
          { label: 'Total', value: formatCurrency(totalEarnings), icon: DollarSign, change: '', color: 'text-primary', gradient: 'from-primary/10 to-purple-500/5' },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-2xl border border-border/50 bg-gradient-to-br ${stat.gradient} p-4 shadow-card transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
              {stat.change && <span className={`text-[10px] font-bold ${stat.color}`}>{stat.change}</span>}
            </div>
            <p className={`mt-2 text-xl font-bold ${stat.color}`}>{stat.value}</p>
            <div className="mt-1 flex items-center gap-1">
              <stat.icon className={`h-3 w-3 ${stat.color}`} />
              <span className={`text-[9px] font-medium ${stat.color}`}>{stat.label === 'Total' ? 'Todas las ganancias' : 'vs período anterior'}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Historial de Ganancias</h3>
          <div className="flex gap-1 rounded-lg border border-border/50 bg-background/50 p-0.5">
            {(['today', 'week', 'month', 'year'] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)} className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
                period === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}>
                {p === 'today' ? 'Hoy' : p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : 'Año'}
              </button>
            ))}
          </div>
        </div>
        {histLoading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
            <DollarSign className="h-6 w-6 mb-2 opacity-50" />
            <p className="text-xs">Sin datos de ganancias en este período</p>
          </div>
        ) : (
          <div className="h-48">
            <EarningsChart data={filteredHistory} />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Base', value: formatCurrency(totalEarnings * 0.7), icon: DollarSign, color: 'text-primary', desc: '70% de tus ganancias' },
          { label: 'Propinas', value: formatCurrency(totalEarnings * 0.15), icon: Gift, color: 'text-warning', desc: '15% de tus ganancias' },
          { label: 'Bonificaciones', value: formatCurrency(totalEarnings * 0.15), icon: PiggyBank, color: 'text-success', desc: '15% de tus ganancias' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 shadow-card">
            <div className="flex items-center gap-2">
              <item.icon className={`h-4 w-4 ${item.color}`} />
              <span className="text-xs font-medium text-foreground">{item.label}</span>
            </div>
            <p className={`mt-1 text-lg font-bold ${item.color}`}>{item.value}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Transacciones Recientes</h3>
          <span className="text-[10px] text-muted-foreground">{earnings.length} registros</span>
        </div>
        {earnings.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Sin transacciones registradas</p>
        ) : (
          <div className="space-y-1">
            {earnings.slice(0, 10).map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-background/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-success/10">
                    <DollarSign className="h-3.5 w-3.5 text-success" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">{e.business_name}</p>
                    <p className="text-[9px] text-muted-foreground">{e.order_number} · {new Date(e.date).toLocaleDateString('es-CO')}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-success">+{formatCurrency(e.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RepartidorGanancias() {
  const { profile } = useAuth();
  return (
    <CourierProvider courierId={profile?.id}>
      <GananciasContent />
    </CourierProvider>
  );
}
