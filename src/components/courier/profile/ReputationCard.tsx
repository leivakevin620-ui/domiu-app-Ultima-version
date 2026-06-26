'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { Star, ThumbsUp, Award, Clock, Camera, BadgeCheck } from 'lucide-react';
import { useCourier } from '@/contexts/CourierContext';
import { useAuth } from '@/contexts/AuthContext';

function mockDistribution(total: number) {
  if (total <= 0) return { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  return {
    5: Math.round(total * 0.60),
    4: Math.round(total * 0.25),
    3: Math.round(total * 0.10),
    2: Math.round(total * 0.03),
    1: Math.round(total * 0.02),
  };
}

export function ReputationCard() {
  const { courier } = useCourier();
  const { profile } = useAuth();

  const rating = courier?.rating || 0;
  const totalRatings = courier?.total_ratings || 0;
  const deliveries = courier?.total_deliveries || 0;
  const isVerified = courier?.is_verified || false;
  const hasAvatar = !!profile?.avatar_url;

  const dist = mockDistribution(totalRatings);
  const maxCount = Math.max(...Object.values(dist), 1);

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="rounded-2xl border border-white/10 bg-[#1E293B] p-5 shadow-lg"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Reputación</p>
          <h3 className="text-lg font-black text-white">Calificaciones</h3>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
          <ThumbsUp className="h-5 w-5 text-amber-400" />
        </div>
      </div>

      <div className="mb-4 flex items-center gap-4 rounded-xl bg-white/5 p-4 backdrop-blur">
        <div className="flex flex-col items-center">
          <span className="text-4xl font-black text-white">{rating > 0 ? rating.toFixed(1) : '—'}</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`h-3 w-3 ${s <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-white/10 text-white/10'}`}
              />
            ))}
          </div>
          <span className="mt-1 text-[10px] font-semibold text-slate-400">
            {totalRatings.toLocaleString('es-CO')} reseñas
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          {[5, 4, 3, 2, 1].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span className="w-3 text-right text-[10px] font-bold text-slate-400">{s}</span>
              <Star className="h-3 w-3 text-amber-400" />
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(dist[s as keyof typeof dist] / maxCount) * 100}%` }}
                  transition={{ duration: 0.5, delay: s * 0.05 }}
                  className="h-full rounded-full bg-amber-400"
                />
              </div>
              <span className="w-6 text-right text-[10px] font-semibold text-slate-400">
                {dist[s as keyof typeof dist]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${
          isVerified ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-500'
        }`}>
          <BadgeCheck className="h-3 w-3" />
          Verificado
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${
          deliveries >= 100 ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-slate-500'
        }`}>
          <Award className="h-3 w-3" />
          +100 entregas
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-300">
          <Clock className="h-3 w-3" />
          Respuesta rápida
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${
          hasAvatar ? 'bg-violet-500/20 text-violet-300' : 'bg-white/5 text-slate-500'
        }`}>
          <Camera className="h-3 w-3" />
          Foto verificada
        </span>
      </div>
    </motion.section>
  );
}
