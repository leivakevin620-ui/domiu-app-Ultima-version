'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bike, Car, Truck, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { courierProService } from '@/services/courier-pro';
import { getBrowserClient } from '@/lib/db/supabase';
import { VEHICLE_TYPES, VEHICLE_BRANDS } from '@/lib/mock/courier-profile';

const vehicleIcons: Record<string, React.ElementType> = {
  motorcycle: Bike,
  bike: Bike,
  car: Car,
  van: Truck,
};

const iconColors: Record<string, string> = {
  motorcycle: 'text-blue-600 bg-blue-50',
  bike: 'text-emerald-600 bg-emerald-50',
  car: 'text-violet-600 bg-violet-50',
  van: 'text-amber-600 bg-amber-50',
};

export function CourierVehicleCard() {
  const { profile } = useAuth();
  const [vehicle, setVehicle] = useState({ type: 'motorcycle', plate: '', model: '' });
  const [brand, setBrand] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      const supabase = await getBrowserClient();
      const { data: driver } = await supabase
        .from('drivers')
        .select('vehicle_type, vehicle_plate, vehicle_model')
        .eq('id', profile.id)
        .single();
      if (driver) {
        const fullModel = driver.vehicle_model || '';
        setVehicle({
          type: driver.vehicle_type || 'motorcycle',
          plate: driver.vehicle_plate || '',
          model: fullModel,
        });
        const parts = fullModel.split(' ');
        setBrand(parts[0] || '');
      }
    })();
  }, [profile?.id]);

  const handleSave = async () => {
    if (!profile?.id) return;
    setSaving(true);
    await courierProService.updateVehicle(profile.id, vehicle);
    setSaving(false);
  };

  const Icon = vehicleIcons[vehicle.type] || Bike;

  const brands = VEHICLE_BRANDS[vehicle.type] || VEHICLE_BRANDS.motorcycle;

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-white/70 bg-white/80 p-4 shadow-[0_8px_25px_rgba(15,23,42,0.06)] backdrop-blur"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Vehículo</p>
          <h3 className="text-base font-black text-slate-900">Unidad de reparto</h3>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconColors[vehicle.type] || iconColors.motorcycle}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-3 text-white">
        <Icon className="h-12 w-12 text-white/60" />
        <div className="min-w-0">
          <p className="text-xs text-white/60">{VEHICLE_TYPES[vehicle.type] || 'Motocicleta'}</p>
          <p className="text-base font-black">{vehicle.model || 'Modelo pendiente'}</p>
          <span className="inline-block rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-white/80">{vehicle.plate || 'Sin placa'}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Tipo</span>
          <select
            value={vehicle.type}
            onChange={(e) => setVehicle({ ...vehicle, type: e.target.value })}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10"
            aria-label="Tipo de vehículo"
          >
            {Object.entries(VEHICLE_TYPES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Placa</span>
          <input
            value={vehicle.plate}
            onChange={(e) => setVehicle({ ...vehicle, plate: e.target.value.toUpperCase() })}
            placeholder="ABC123"
            maxLength={10}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold uppercase text-slate-800 outline-none transition focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10"
            aria-label="Placa del vehículo"
          />
        </label>
      </div>

      <label className="mt-2 block">
        <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Marca</span>
        <select
          value={brand}
          onChange={(e) => {
            const selected = e.target.value;
            setBrand(selected);
            const rest = vehicle.model.split(' ').slice(1).join(' ');
            setVehicle({ ...vehicle, model: selected + (rest ? ' ' + rest : '') });
          }}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10"
          aria-label="Marca del vehículo"
        >
          <option value="">Selecciona una marca</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </label>
      <label className="mt-2 block">
        <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Modelo</span>
        <input
          value={vehicle.model}
          onChange={(e) => {
            const newValue = e.target.value;
            const firstWord = newValue.split(' ')[0] || '';
            if (brand && firstWord !== brand && brands.includes(firstWord)) {
              setBrand(firstWord);
            }
            setVehicle({ ...vehicle, model: newValue });
          }}
          placeholder="Ej: XTZ 150 2024"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10"
          aria-label="Modelo completo del vehículo"
        />
      </label>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-xs font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-50"
        aria-label={saving ? 'Guardando vehículo' : 'Guardar vehículo'}
      >
        <Save className="h-3.5 w-3.5" />
        {saving ? 'Guardando...' : 'Guardar vehículo'}
      </button>
    </motion.section>
  );
}
