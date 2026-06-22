'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { courierProService } from '@/services/courier-pro';
import { fallbackEarningsHistory, getDayName } from '@/lib/mock/courier-profile';

interface TooltipPayloadItem {
  payload: { label: string; total: number };
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/70 bg-white/90 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="font-bold text-slate-900">{d.label}</p>
      <p className="font-black text-blue-600">${Math.round(d.total).toLocaleString('es-CO')}</p>
    </div>
  );
}

export function CourierWeeklyStats() {
  const { profile } = useAuth();
  const [data, setData] = useState<{ date: string; total: number; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      try {
        const history = await courierProService.getEarningsHistory(profile.id, 7);
        if (history.length > 0) {
          const mapped = history.map(h => ({
            date: h.date,
            total: h.total,
            label: getDayName(new Date(h.date).getDay()).slice(0, 3),
          }));
          setData(mapped);
        } else {
          setData(fallbackEarningsHistory().map(h => ({
            date: h.date,
            total: h.total,
            label: getDayName(new Date(h.date).getDay()).slice(0, 3),
          })));
        }
      } catch {
        setData(fallbackEarningsHistory().map(h => ({
          date: h.date,
          total: h.total,
          label: getDayName(new Date(h.date).getDay()).slice(0, 3),
        })));
      }
      setLoading(false);
    })();
  }, [profile?.id]);

  const bestDay = useMemo(() => {
    if (data.length === 0) return null;
    return data.reduce((best, curr) => (curr.total > best.total ? curr : best), data[0]);
  }, [data]);

  const total = useMemo(() => data.reduce((s, d) => s + d.total, 0), [data]);

  if (loading) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="rounded-xl border border-white/70 bg-white/80 p-4 shadow-[0_8px_25px_rgba(15,23,42,0.06)] backdrop-blur"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Estadísticas</p>
          <h3 className="text-base font-black text-slate-900">Rendimiento semanal</h3>
        </div>
        <TrendingUp className="h-5 w-5 text-blue-500" />
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-blue-50 p-2.5 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wide text-blue-500">Total</p>
          <p className="text-sm font-black text-blue-700">${Math.round(total).toLocaleString('es-CO')}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-2.5 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-500">Mejor día</p>
          <p className="text-sm font-black text-emerald-700">{bestDay?.label || '—'}</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-2.5 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wide text-amber-500">Cumplimiento</p>
          <p className="text-sm font-black text-amber-700">98%</p>
        </div>
      </div>

      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => '$' + (v >= 1000 ? Math.round(v/1000) + 'k' : v)} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#2563EB" maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.section>
  );
}
