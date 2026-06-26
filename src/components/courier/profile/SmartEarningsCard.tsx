'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, DollarSign, Calendar, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useCourier } from '@/contexts/CourierContext';
import { formatCurrency } from './shared';

function generateWeeklyMock(total: number) {
  const base = total / 7;
  const variance = 0.3;
  return Array.from({ length: 7 }, () => {
    const mult = 1 + (Math.random() - 0.5) * variance * 2;
    return Math.round(base * mult);
  });
}

export function SmartEarningsCard() {
  const { todayEarnings, weekEarnings, monthEarnings, totalEarnings, earnings } = useCourier();

  const weeklyData = React.useMemo(() => {
    if (earnings.length >= 7) {
      const grouped: Record<string, number> = {};
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toDateString();
        grouped[key] = 0;
      }
      for (const e of earnings) {
        const key = new Date(e.date).toDateString();
        if (key in grouped) grouped[key] += e.amount;
      }
      return Object.values(grouped);
    }
    return generateWeeklyMock(weekEarnings || monthEarnings || 50000);
  }, [earnings, weekEarnings, monthEarnings]);

  const maxVal = Math.max(...weeklyData, 1);
  const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const today = new Date().getDay();
  const reordered = [...dayLabels.slice(today + 1), ...dayLabels.slice(0, today + 1)];

  const periods = [
    { label: 'Hoy', value: todayEarnings, icon: DollarSign, color: 'from-emerald-400 to-emerald-600', trend: todayEarnings > weekEarnings / 7 ? 'up' as const : 'down' as const },
    { label: 'Semana', value: weekEarnings, icon: Calendar, color: 'from-blue-400 to-blue-600', trend: weekEarnings > monthEarnings / 4 ? 'up' as const : 'down' as const },
    { label: 'Mes', value: monthEarnings, icon: BarChart3, color: 'from-violet-400 to-violet-600', trend: monthEarnings > totalEarnings / 3 ? 'up' as const : 'down' as const },
    { label: 'Total', value: totalEarnings, icon: Wallet, color: 'from-amber-400 to-amber-600', trend: totalEarnings > weekEarnings * 4 ? 'up' as const : 'down' as const },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      className="rounded-2xl border border-white/10 bg-[#1E293B]/80 p-5 shadow-lg backdrop-blur-xl"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-emerald-400" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Ganancias</p>
            <h3 className="text-base font-black text-white">Smart Earnings</h3>
          </div>
        </div>
        <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold text-emerald-300 backdrop-blur">
          {formatCurrency(todayEarnings)} hoy
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {periods.map((period, i) => (
          <motion.div
            key={period.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.05, duration: 0.3 }}
            className="rounded-xl border border-white/5 bg-white/5 p-3 backdrop-blur"
          >
            <div className="flex items-center justify-between">
              <period.icon className="h-3.5 w-3.5 text-white/40" />
              {period.trend === 'up' ? (
                <ArrowUpRight className="h-3 w-3 text-emerald-400" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-400" />
              )}
            </div>
            <p className="mt-2 text-lg font-black text-white">{formatCurrency(period.value)}</p>
            <p className="text-[10px] font-semibold text-white/40">{period.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-white/5 bg-white/5 p-3 backdrop-blur">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
          <TrendingUp className="h-3 w-3" />
          Últimos 7 días
        </div>
        <div className="flex items-end gap-1.5">
          {weeklyData.map((val, i) => {
            const pct = (val / maxVal) * 100;
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(pct, 4)}%` }}
                  transition={{ duration: 0.5, delay: i * 0.05, ease: 'easeOut' }}
                  className="w-full rounded-t-md bg-gradient-to-t from-emerald-500/60 to-emerald-400/60"
                  style={{ height: `${Math.max(pct, 4)}%` }}
                />
                <span className="text-[8px] font-semibold text-white/30">{reordered[i]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}
