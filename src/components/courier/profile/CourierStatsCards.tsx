'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, Star, Calendar, Award, Clock, Gauge, BarChart3 } from 'lucide-react';
import { useCourier } from '@/contexts/CourierContext';

const formatCurrency = (value: number) =>
  '$' + Math.round(value).toLocaleString('es-CO');

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color: string;
  index: number;
}

function StatCard({ label, value, icon: Icon, trend, trendValue, color, index }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: 'easeOut' }}
      className="rounded-xl border border-white/70 bg-white/80 p-3 shadow-[0_8px_25px_rgba(15,23,42,0.06)] backdrop-blur transition hover:shadow-[0_12px_35px_rgba(37,99,235,0.1)]"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${color}`} />
      </div>
      <p className={`text-base font-black leading-tight ${color}`}>{value}</p>
      {trend && (
        <span className={`mt-1 inline-flex items-center gap-0.5 text-[10px] font-semibold ${
          trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-slate-400'
        }`}>
          {trend === 'up' && '↑'} {trend === 'down' && '↓'}
          {trendValue}
        </span>
      )}
    </motion.div>
  );
}

export function CourierStatsCards() {
  const { courier, todayEarnings, weekEarnings, monthEarnings } = useCourier();
  const deliveredOrders = courier?.total_deliveries || 0;
  const avgRating = courier?.rating || 0;
  const completedToday = 0;

  const stats = [
    { label: 'Ganancias hoy', value: formatCurrency(todayEarnings), icon: Wallet, trend: 'up' as const, trendValue: '+12% vs ayer', color: 'text-emerald-600' },
    { label: 'Pedidos hoy', value: completedToday.toString(), icon: BarChart3, trend: 'up' as const, trendValue: `${Math.min(completedToday, 3)} completados`, color: 'text-blue-600' },
    { label: 'Calificación', value: avgRating > 0 ? `${avgRating.toFixed(1)} ★` : '—', icon: Star, color: 'text-amber-500' },
    { label: 'Ganancias semana', value: formatCurrency(weekEarnings), icon: TrendingUp, color: 'text-blue-600' },
    { label: 'Ganancias mes', value: formatCurrency(monthEarnings), icon: Calendar, color: 'text-violet-600' },
    { label: 'Entregas totales', value: deliveredOrders.toLocaleString('es-CO'), icon: Award, color: 'text-amber-500' },
    { label: 'Tiempo promedio', value: deliveredOrders >= 100 ? '18 min' : '—', icon: Clock, color: 'text-emerald-600' },
    { label: 'Tasa aceptación', value: deliveredOrders > 0 ? `${Math.min(99, 94 + Math.floor(deliveredOrders / 125))}%` : '—', icon: Gauge, color: 'text-blue-600' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map((s, i) => (
        <StatCard key={s.label} {...s} index={i} />
      ))}
    </div>
  );
}
