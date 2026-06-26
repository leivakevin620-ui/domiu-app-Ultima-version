'use client';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, TrendingUp, MapPin, Clock, Zap, Navigation, Sparkles, BrainCircuit, BarChart3 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCourier } from '@/contexts/CourierContext';
import { courierProService, type AIReadinessData } from '@/services/courier-pro';
import { formatCurrency } from './shared';

export function CopilotCard() {
  const { profile } = useAuth();
  const { courier } = useCourier();
  const [aiData, setAiData] = useState<AIReadinessData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAiData(courierProService.getAIReadiness());
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#1E293B] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
      >
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="mb-1 h-2.5 w-20 animate-pulse rounded-full bg-white/10" />
            <div className="h-3 w-32 animate-pulse rounded-full bg-white/10" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-12 animate-pulse rounded-xl bg-white/5" />
          <div className="h-12 animate-pulse rounded-xl bg-white/5" />
          <div className="h-12 animate-pulse rounded-xl bg-white/5" />
        </div>
      </motion.section>
    );
  }

  if (!aiData) return null;

  const courierName = profile?.first_name || courier?.name?.split(' ')[0] || 'Courier';

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#1E293B] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
    >
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-emerald-500/5 blur-3xl" />

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-emerald-500/20 text-blue-400 ring-1 ring-blue-500/20">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400/80">
              <Sparkles className="mr-1 inline h-3 w-3" />
              AI Copilot
            </p>
            <h3 className="text-sm font-black text-white">
              Buen día, {courierName}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1">
          <BrainCircuit className="h-3 w-3 text-emerald-400" />
          <span className="text-[9px] font-bold text-emerald-400">ACTIVO</span>
        </div>
      </div>

      <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
        <div className="mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80">Predicción de demanda</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-white/5 px-3 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">Próxima hora</p>
            <p className="mt-0.5 text-lg font-black text-white">
              ~{aiData.demandPrediction.nextHourOrders}
              <span className="ml-1 text-[11px] font-bold text-white/60">pedidos</span>
            </p>
            <div className="mt-1 flex items-center gap-1">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
                  style={{ width: `${Math.round(aiData.demandPrediction.confidence * 100)}%` }}
                />
              </div>
              <span className="text-[9px] font-bold text-white/40">{Math.round(aiData.demandPrediction.confidence * 100)}%</span>
            </div>
          </div>
          <div className="rounded-lg bg-white/5 px-3 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">Hora pico hoy</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-white/60" />
              <span className="text-sm font-black text-white">{aiData.demandPrediction.peakTimeToday}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
        <div className="mb-2 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-emerald-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">Zonas activas</span>
        </div>
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2">
          <Navigation className="h-4 w-4 text-emerald-400" />
          <div>
            <p className="text-[11px] font-bold text-white">Recomendada: {aiData.demandPrediction.recommendedZone}</p>
          </div>
        </div>
        <div className="space-y-1">
          {aiData.hotZones.map((zone, i) => (
            <div key={zone.name} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-bold text-emerald-400">
                  {i + 1}
                </span>
                <span className="text-xs font-bold text-white">{zone.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold text-emerald-400">{zone.ordersPerHour} ped/h</span>
                <span className="text-[10px] text-white/40">{zone.distanceKm} km</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
        <div className="mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">Proyección de ganancias</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-white/5 px-2.5 py-2 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">Hoy</p>
            <p className="text-sm font-black text-emerald-400">{formatCurrency(aiData.estimatedEarnings.todayProjection)}</p>
          </div>
          <div className="rounded-lg bg-white/5 px-2.5 py-2 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">Semana</p>
            <p className="text-sm font-black text-white">{formatCurrency(aiData.estimatedEarnings.weekProjection)}</p>
          </div>
          <div className="rounded-lg bg-white/5 px-2.5 py-2 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">Mes</p>
            <p className="text-sm font-black text-white">{formatCurrency(aiData.estimatedEarnings.monthlyProjection)}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-500/10 to-emerald-500/10 py-2">
        <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
        <span className="text-[10px] font-semibold text-white/60">
          Datos basados en tu historial y tendencias actuales
        </span>
      </div>
    </motion.section>
  );
}
