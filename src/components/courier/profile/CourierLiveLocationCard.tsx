'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, Satellite, WifiOff } from 'lucide-react';

export function CourierLiveLocationCard() {
  const [gpsActive, setGpsActive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('—');

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      className="rounded-xl border border-white/70 bg-white/80 p-4 shadow-[0_8px_25px_rgba(15,23,42,0.06)] backdrop-blur"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Ubicación</p>
          <h3 className="text-base font-black text-slate-900">GPS en vivo</h3>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${gpsActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          <Satellite className={`h-3 w-3 ${gpsActive ? 'animate-pulse' : ''}`} />
          <span className="text-[9px] font-bold">{gpsActive ? 'Activo' : 'Inactivo'}</span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 h-32">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='g' width='20' height='20' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 20 0 L 0 0 0 20' fill='none' stroke='white' stroke-width='0.5'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23g)'/%3E%3C/svg%3E")`,
        }} />
        <div className="absolute top-3 left-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 shadow-lg shadow-blue-500/50">
            <Navigation className="h-3 w-3 text-white" />
          </div>
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] text-white/70">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            Santa Marta, Centro
          </span>
          <span>Última act. {lastUpdate}</span>
        </div>
        {!gpsActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="text-center">
              <WifiOff className="mx-auto h-6 w-6 text-white/60" />
              <p className="mt-1 text-xs font-semibold text-white/80">GPS desconectado</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Enlaces rápidos</p>
        <div className="grid grid-cols-2 gap-2">
          <a
            href="/repartidor/mapa"
            className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-50 py-2.5 text-xs font-bold text-blue-600 transition hover:bg-blue-100"
            aria-label="Ver mapa completo"
          >
            <MapPin className="h-3.5 w-3.5" />
            Ver mapa
          </a>
          <button
            onClick={() => setGpsActive(!gpsActive)}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
              gpsActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            }`}
            aria-label={gpsActive ? 'Desactivar GPS' : 'Activar GPS'}
          >
            <Satellite className="h-3.5 w-3.5" />
            {gpsActive ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>
    </motion.section>
  );
}
