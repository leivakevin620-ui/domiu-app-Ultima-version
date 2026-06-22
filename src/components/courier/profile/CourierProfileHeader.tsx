'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Calendar, IdCard, Bike, Star, Bell, Settings, PenLine } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useCourier } from '@/contexts/CourierContext';
import { getCourierLevel } from '@/services/courier-pro';
import { getInitials, levelStyles, formatDate } from './shared';

export function CourierProfileHeader() {
  const { profile } = useAuth();
  const { courier, isAvailable, activeDeliveries } = useCourier();

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || 'Repartidor DomiU';
  const deliveredOrders = courier?.total_deliveries || 0;
  const avgRating = courier?.rating || 0;
  const level = getCourierLevel(deliveredOrders);
  const cleanLevelTitle = level.title;
  const levelStyle = levelStyles[cleanLevelTitle] || levelStyles.Novato;
  const LevelIcon = levelStyle.icon;
  const city = String(profile?.metadata?.city || profile?.metadata?.zone || 'Santa Marta');
  const driverId = profile?.id ? `DU-${profile.id.slice(0, 8).toUpperCase()}` : 'DU-PENDIENTE';
  const notificationCount = activeDeliveries.length;

  const statusConfig = isAvailable
    ? { label: 'En línea', dot: 'bg-emerald-400', bg: 'bg-emerald-500/20 text-emerald-300' }
    : { label: 'Desconectado', dot: 'bg-slate-400', bg: 'bg-slate-500/20 text-slate-300' };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#0F172A] via-[#1E3A5F] to-[#2563EB] shadow-[0_26px_70px_rgba(37,99,235,0.28)]"
    >
      <div className="relative p-5 sm:p-7">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-40" />

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${levelStyle.ring} p-[3px] shadow-2xl`}>
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-slate-900 text-2xl font-black text-white">
                {profile?.avatar_url ? (
                  <Image src={profile.avatar_url} alt={fullName} width={80} height={80} className="h-full w-full object-cover" />
                ) : (
                  getInitials(profile?.first_name, profile?.last_name, profile?.email)
                )}
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-white leading-tight sm:text-2xl">{fullName}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusConfig.bg}`}>
                  <span className={`h-2 w-2 rounded-full ${statusConfig.dot} animate-pulse`} />
                  {statusConfig.label}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r ${levelStyle.badge} px-2.5 py-1 text-xs font-black text-white`}>
                  <LevelIcon className="h-3.5 w-3.5" />
                  {cleanLevelTitle}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-white/80">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {avgRating > 0 ? avgRating.toFixed(1) : '—'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/60">
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{city}</span>
                <span className="flex items-center gap-1"><IdCard className="h-3 w-3" />{driverId}</span>
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Ingreso {formatDate(profile?.created_at)}</span>
                <span className="flex items-center gap-1"><Bike className="h-3 w-3" />Repartidor DomiU</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button aria-label="Notificaciones" className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur transition hover:bg-white/20">
              <Bell className="h-4 w-4" />
              {notificationCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">{notificationCount}</span>}
            </button>
            <button aria-label="Configuración" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur transition hover:bg-white/20">
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Nivel {level.level}</p>
              <p className="text-sm font-bold text-white">{cleanLevelTitle} · {level.bonusMultiplier}x bonificación</p>
            </div>
            <button aria-label="Editar perfil" className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/25">
              <PenLine className="h-3.5 w-3.5" />
              Editar
            </button>
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>{deliveredOrders} entregas</span>
              <span>Nivel {level.level}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
