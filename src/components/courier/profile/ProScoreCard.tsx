'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { Award, CheckCircle, Star, Calendar, Target } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCourier } from '@/contexts/CourierContext';
import { getCourierLevel, getNextLevel } from '@/services/courier-pro';
import { levelStyles } from './shared';

export function ProScoreCard() {
  const { profile } = useAuth();
  const { courier } = useCourier();

  const deliveries = courier?.total_deliveries || 0;
  const rating = courier?.rating || 0;
  const isVerified = courier?.is_verified || false;
  const createdAt = profile?.created_at;

  const level = getCourierLevel(deliveries);
  const nextLevel = getNextLevel(deliveries);
  const ls = levelStyles[level.title] || levelStyles.Novato;
  const LevelIcon = ls.icon;

  const [seniorityMonths] = React.useState(() => createdAt
    ? Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
    : 0);

  const scoreWeights = { deliveries: 0.25, rating: 0.35, verified: 0.20, seniority: 0.20 };
  const normalizedDeliveries = Math.min(deliveries / 1000, 1);
  const normalizedRating = rating / 5;
  const verifiedScore = isVerified ? 1 : 0;
  const normalizedSeniority = Math.min(seniorityMonths / 24, 1);
  const proScore = Math.round(
    (normalizedDeliveries * scoreWeights.deliveries +
      normalizedRating * scoreWeights.rating +
      verifiedScore * scoreWeights.verified +
      normalizedSeniority * scoreWeights.seniority) * 100
  );

  const progressToNext = nextLevel
    ? Math.min((deliveries - level.minDeliveries) / (nextLevel.minDeliveries - level.minDeliveries) * 100, 100)
    : 100;

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-white/10 bg-[#1E293B] p-5 shadow-lg"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">DomiU Pro</p>
          <h3 className="text-lg font-black text-white">Nivel {level.title}</h3>
        </div>
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${ls.ring} shadow-lg`}>
          <LevelIcon className="h-7 w-7 text-white" />
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3 rounded-xl bg-white/5 p-3 backdrop-blur">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
          <Target className="h-6 w-6 text-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-black text-white">{proScore}</p>
          <p className="text-[11px] font-semibold text-slate-400">Pro Score</p>
        </div>
        <div className="rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 px-3 py-1">
          <span className="text-[10px] font-black uppercase tracking-wide text-white">{level.title}</span>
        </div>
      </div>

      {nextLevel && (
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Próximo: {nextLevel.title}
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              {deliveries}/{nextLevel.minDeliveries} entregas
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressToNext}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 shadow-[0_0_10px_rgba(52,211,153,0.3)]"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-lg bg-white/5 p-2.5">
          <Award className="h-4 w-4 shrink-0 text-emerald-400" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Entregas</p>
            <span className="inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">
              {deliveries.toLocaleString('es-CO')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white/5 p-2.5">
          <Star className="h-4 w-4 shrink-0 text-amber-400" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Calificación</p>
            <p className="text-sm font-black text-white">{rating > 0 ? `${rating.toFixed(1)} / 5.0` : '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white/5 p-2.5">
          <CheckCircle className="h-4 w-4 shrink-0 text-cyan-400" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Verificado</p>
            <span className={`inline-flex items-center gap-1 text-xs font-bold ${isVerified ? 'text-emerald-400' : 'text-slate-500'}`}>
              {isVerified ? 'Sí' : 'No'}
              {isVerified && <CheckCircle className="h-3 w-3" />}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white/5 p-2.5">
          <Calendar className="h-4 w-4 shrink-0 text-violet-400" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Antigüedad</p>
            <p className="text-sm font-black text-white">{seniorityMonths} meses</p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
