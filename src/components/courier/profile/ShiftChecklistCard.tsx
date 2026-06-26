'use client';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, CheckCircle2, Circle, Target, DollarSign, Bike, Smartphone, MapPin, Battery, Droplets, Gauge } from 'lucide-react';
import { useCourier } from '@/contexts/CourierContext';
import { formatCurrency } from './shared';

const checklistItems = [
  { id: 'helmet', label: 'Casco puesto', icon: Bike },
  { id: 'phone', label: 'Teléfono cargado', icon: Smartphone },
  { id: 'app', label: 'App actualizada', icon: Smartphone },
  { id: 'gps', label: 'GPS activado', icon: MapPin },
  { id: 'battery', label: 'Batería externa', icon: Battery },
  { id: 'water', label: 'Agua / Hidratación', icon: Droplets },
];

const STORAGE_KEY = 'domiu-shift-checklist';

export function ShiftChecklistCard() {
  const { todayEarnings, activeDeliveries } = useCourier();

  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).checked || {};
    } catch {}
    return {};
  });
  const [deliveryGoal, setDeliveryGoal] = useState(() => {
    if (typeof window === 'undefined') return 10;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).deliveryGoal || 10;
    } catch {}
    return 10;
  });
  const [earningsGoal, setEarningsGoal] = useState(() => {
    if (typeof window === 'undefined') return 80000;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).earningsGoal || 80000;
    } catch {}
    return 80000;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ checked, deliveryGoal, earningsGoal }));
    } catch {}
  }, [checked, deliveryGoal, earningsGoal]);

  const toggleItem = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const checkedCount = Object.values(checked).filter(Boolean).length;
  const completionPct = Math.round((checkedCount / checklistItems.length) * 100);

  const todayDeliveries = activeDeliveries.length;
  const deliveryPct = Math.min(100, Math.round((todayDeliveries / deliveryGoal) * 100));
  const earningsPct = Math.min(100, Math.round((todayEarnings / earningsGoal) * 100));

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#1E293B] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
    >
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/80">Pre-turno</p>
            <h3 className="text-sm font-black text-white">Checklist diario</h3>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-14 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-white/60">{completionPct}%</span>
        </div>
      </div>

      <div className="mb-4 space-y-1">
        {checklistItems.map((item) => {
          const Icon = item.icon;
          const isChecked = checked[item.id] || false;
          return (
            <button
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 transition ${
                isChecked
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
              }`}
            >
              {isChecked ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-white/30" />
              )}
              <Icon className={`h-4 w-4 shrink-0 ${isChecked ? 'text-emerald-400' : 'text-white/40'}`} />
              <span className={`text-xs font-bold ${isChecked ? 'text-white/80 line-through' : 'text-white'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
        <div className="mb-2 flex items-center gap-2">
          <Target className="h-4 w-4 text-emerald-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">Metas del día</span>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-wider text-white/40">Entregas</span>
            <div className="relative">
              <Bike className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
              <input
                type="number"
                value={deliveryGoal}
                onChange={(e) => setDeliveryGoal(Math.max(1, Number(e.target.value)))}
                className="h-9 w-full rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 text-xs font-bold text-white outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-wider text-white/40">Ganancias</span>
            <div className="relative">
              <DollarSign className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
              <input
                type="number"
                value={earningsGoal}
                onChange={(e) => setEarningsGoal(Math.max(1, Number(e.target.value)))}
                className="h-9 w-full rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 text-xs font-bold text-white outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
          </label>
        </div>

        <div className="space-y-2">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] text-white/60">
                <span className="font-bold text-white">{todayDeliveries}</span>
                <span className="text-white/40"> / {deliveryGoal} entregas</span>
              </span>
              <span className="text-[10px] font-bold text-white/40">{deliveryPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-500"
                style={{ width: `${deliveryPct}%` }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] text-white/60">
                <span className="font-bold text-emerald-400">{formatCurrency(todayEarnings)}</span>
                <span className="text-white/40"> / {formatCurrency(earningsGoal)}</span>
              </span>
              <span className="text-[10px] font-bold text-white/40">{earningsPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
                style={{ width: `${earningsPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-white/5 py-2">
        <Gauge className="h-3.5 w-3.5 text-white/40" />
        <span className="text-[10px] font-semibold text-white/40">
          {checkedCount === checklistItems.length
            ? 'Listo para trabajar!'
            : `${checkedCount} de ${checklistItems.length} listo(s)`}
        </span>
      </div>
    </motion.section>
  );
}
