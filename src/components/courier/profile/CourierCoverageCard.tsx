'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, CheckCircle2 } from 'lucide-react';
import { COVERAGE_ZONES } from '@/lib/mock/courier-profile';

export function CourierCoverageCard() {

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-xl border border-white/70 bg-white/80 p-4 shadow-[0_8px_25px_rgba(15,23,42,0.06)] backdrop-blur"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Cobertura</p>
          <h3 className="text-base font-black text-slate-900">Zonas de operación</h3>
        </div>
        <MapPin className="h-5 w-5 text-amber-500" />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {COVERAGE_ZONES.map((zone) => (
          <div
            key={zone.id}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
              zone.active
                ? 'bg-blue-50 text-blue-700'
                : 'bg-slate-50 text-slate-400'
            }`}
          >
            {zone.active ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300" />
            )}
            <span>{zone.name}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Zona actual</p>
        <p className="text-sm font-bold text-blue-800">Centro</p>
      </div>
    </motion.section>
  );
}
