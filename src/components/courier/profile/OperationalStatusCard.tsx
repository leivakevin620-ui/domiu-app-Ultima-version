'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Power, Clock, Coffee, Truck, XCircle } from 'lucide-react';
import { useCourier } from '@/contexts/CourierContext';
import { useAuth } from '@/contexts/AuthContext';
import { setCourierOnlineStatusAction } from '@/app/actions/courier-profile';

const STATUS_BUTTONS = [
  { key: 'available', label: 'Disponible', icon: Power, color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30' },
  { key: 'on_break', label: 'En pausa', icon: Coffee, color: 'bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30' },
  { key: 'busy', label: 'Ocupado', icon: Truck, color: 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30' },
  { key: 'offline', label: 'Desconectado', icon: XCircle, color: 'bg-slate-500/20 text-slate-300 border-slate-500/30 hover:bg-slate-500/30' },
] as const;

export function OperationalStatusCard() {
  const { courierStatus, isAvailable, loading, refresh } = useCourier();
  const { profile } = useAuth();
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    if (!profile?.id) return;
    setToggling(true);
    try {
      const newStatus = isAvailable ? 'offline' : 'available';
      const result = await setCourierOnlineStatusAction(newStatus);
      if (result.success) {
        await refresh();
      }
    } catch (e) {
      console.error('Error toggling status:', e);
    }
    setToggling(false);
  };

  const handleStatusChange = async (status: string) => {
    if (!profile?.id || status === courierStatus) return;
    try {
      const result = await setCourierOnlineStatusAction(status);
      if (result.success) {
        await refresh();
      }
    } catch (e) {
      console.error('Error changing status:', e);
    }
  };

  const currentStatus = courierStatus || 'offline';

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-2xl border border-white/10 bg-[#1E293B]/80 p-5 shadow-lg backdrop-blur-xl"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Disponibilidad</p>
          <h3 className="text-base font-black text-white">Estado operativo</h3>
        </div>
        <button
          onClick={handleToggle}
          disabled={toggling || loading}
          aria-label={`Cambiar a ${isAvailable ? 'desconectado' : 'disponible'}`}
          className={`relative flex h-14 w-14 items-center justify-center rounded-2xl transition-all ${
            isAvailable
              ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30'
              : 'bg-slate-700 shadow'
          }`}
        >
          <Power className={`h-6 w-6 text-white transition ${toggling ? 'animate-pulse' : ''}`} />
          {isAvailable && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center">
              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-white" />
            </span>
          )}
        </button>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${
            currentStatus === 'available' ? 'bg-emerald-400' :
            currentStatus === 'busy' ? 'bg-amber-400' :
            currentStatus === 'on_break' ? 'bg-blue-400' : 'bg-slate-400'
          }`} />
          <span className="text-sm font-bold text-white">
            {currentStatus === 'available' ? 'Disponible' :
             currentStatus === 'busy' ? 'Ocupado' :
             currentStatus === 'on_break' ? 'En pausa' : 'Desconectado'}
          </span>
        </div>
        <span className="text-xs font-semibold text-white/50">
          {isAvailable ? 'Aceptando pedidos' : 'Sin conexión'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {STATUS_BUTTONS.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => handleStatusChange(key)}
            disabled={loading}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition-all backdrop-blur ${
              currentStatus === key
                ? color + ' ring-1 ring-white/20'
                : 'border-white/5 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-white/5 bg-white/5 p-3 backdrop-blur">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
          <Clock className="h-3 w-3" />
          Turno actual
        </div>
        <p className="mt-1 text-sm font-semibold text-white/70">
          {isAvailable ? 'En línea ahora' : 'Fuera de línea'}
        </p>
        <p className="text-xs text-white/40">Horario habitual: 7:00 - 19:00</p>
      </div>
    </motion.section>
  );
}
