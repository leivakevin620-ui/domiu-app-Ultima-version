'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Power, Clock, MapPin, Zap, Coffee, XCircle } from 'lucide-react';
import { useCourier } from '@/contexts/CourierContext';
import { useAuth } from '@/contexts/AuthContext';
import type { DriverStatus } from '@/types/database';

const STATUS_MAP: Record<DriverStatus, { label: string; dot: string; badge: string; icon: React.ReactNode }> = {
  available: { label: 'Disponible', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700', icon: null },
  busy: { label: 'Ocupado', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700', icon: <Zap className="h-3.5 w-3.5" /> },
  offline: { label: 'No disponible', dot: 'bg-slate-400', badge: 'bg-slate-50 text-slate-500', icon: <XCircle className="h-3.5 w-3.5" /> },
  on_break: { label: 'En pausa', dot: 'bg-blue-400', badge: 'bg-blue-50 text-blue-600', icon: <Coffee className="h-3.5 w-3.5" /> },
};

export function CourierAvailabilityCard() {
  const { courier, courierStatus, isAvailable, loading, refresh } = useCourier();
  const { profile } = useAuth();
  const [toggling, setToggling] = useState(false);
  const status = courierStatus && STATUS_MAP[courierStatus] ? STATUS_MAP[courierStatus] : STATUS_MAP.offline;

  const handleToggle = async () => {
    setToggling(true);
    try {
      const { updateCourierStatusAction } = await import('@/app/actions/auth');
      await updateCourierStatusAction(profile!.id, isAvailable ? 'offline' : 'available');
      await refresh();
    } catch (e) {
      console.error('Error cambiando estado:', e);
    }
    setToggling(false);
  };

  const lastActive = courier?.is_active ? 'Activo ahora' : '—';
  const onlineTime = useMemo(() => {
    const mins = 187;
    return { hours: Math.floor(mins / 60), mins: mins % 60 };
  }, []);
  const onlineHours = onlineTime.hours;
  const onlineMins = onlineTime.mins;

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-xl border border-white/70 bg-white/80 p-4 shadow-[0_8px_25px_rgba(15,23,42,0.06)] backdrop-blur"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Disponibilidad</p>
          <h3 className="text-base font-black text-slate-900">Estado operativo</h3>
        </div>
        <button
          onClick={handleToggle}
          disabled={toggling || loading}
          aria-label={`Cambiar a ${isAvailable ? 'ocupado' : 'disponible'}`}
          className={`relative flex h-12 w-12 items-center justify-center rounded-2xl transition-all ${
            isAvailable
              ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30'
              : 'bg-slate-300 shadow'
          }`}
        >
          <Power className={`h-5 w-5 text-white transition ${toggling ? 'animate-pulse' : ''}`} />
          {isAvailable && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center">
              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-white" />
            </span>
          )}
        </button>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${status.dot}`} />
          <span className="text-sm font-bold text-slate-800">{status.label}</span>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${status.badge}`}>
          {status.icon}
          {isAvailable ? 'Aceptando pedidos' : courierStatus === 'busy' ? 'En entrega' : 'Sin conexión'}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <Clock className="h-3 w-3" />
            Última conexión
          </div>
          <p className="mt-0.5 text-xs font-bold text-slate-800">{lastActive}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <Clock className="h-3 w-3" />
            Tiempo en línea hoy
          </div>
          <p className="mt-0.5 text-xs font-bold text-slate-800">{onlineHours}h {onlineMins}min</p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-500">
        <MapPin className="h-3 w-3" />
        Zona activa: Centro, Norte
      </div>
    </motion.section>
  );
}
