'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bike, Car, Truck, PenLine, Save, X, Hash } from 'lucide-react';
import { useCourier } from '@/contexts/CourierContext';
import { updateCourierVehicleAction } from '@/app/actions/courier-profile';

const VEHICLE_ICONS: Record<string, React.ElementType> = {
  bike: Bike,
  motorcycle: Bike,
  car: Car,
  van: Truck,
};

const VEHICLE_TYPES: Record<string, string> = {
  bike: 'Bicicleta',
  motorcycle: 'Motocicleta',
  car: 'Automóvil',
  van: 'Camioneta',
};

const VEHICLE_COLORS = [
  { label: 'Blanco', value: 'Blanco' },
  { label: 'Negro', value: 'Negro' },
  { label: 'Rojo', value: 'Rojo' },
  { label: 'Azul', value: 'Azul' },
  { label: 'Gris', value: 'Gris' },
  { label: 'Plateado', value: 'Plateado' },
  { label: 'Verde', value: 'Verde' },
  { label: 'Amarillo', value: 'Amarillo' },
  { label: 'Naranja', value: 'Naranja' },
  { label: 'Marrón', value: 'Marrón' },
];

export function VehicleProCard() {
  const { courier, refresh } = useCourier();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const formInit = React.useCallback(() => {
    if (!courier) return { type: 'motorcycle', plate: '', model: '', brand: '', color: '' };
    const meta = (courier.metadata as Record<string, string>) || {};
    return {
      type: courier.vehicle_type || 'motorcycle',
      plate: courier.vehicle_plate || '',
      model: courier.vehicle_model || '',
      brand: meta.vehicle_brand || '',
      color: meta.vehicle_color || '',
    };
  }, [courier]);

  const init = formInit();
  const [type, setType] = useState<string>(init.type);
  const [plate, setPlate] = useState(init.plate);
  const [model, setModel] = useState(init.model);
  const [brand, setBrand] = useState(init.brand);
  const [color, setColor] = useState(init.color);

  const Icon = VEHICLE_ICONS[type] || Bike;

  const handleSave = async () => {
    if (!courier?.id) return;
    setSaving(true);
    const result = await updateCourierVehicleAction(courier.id, {
      vehicle_type: type as 'bike' | 'motorcycle' | 'car' | 'van',
      vehicle_plate: plate,
      vehicle_model: model,
      vehicle_brand: brand,
      vehicle_color: color,
    });
    if (result.success) {
      setEditing(false);
      refresh();
    }
    setSaving(false);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-2xl border border-white/10 bg-[#1E293B] p-5 shadow-lg"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">Vehículo</p>
          <h3 className="text-lg font-black text-white">Unidad de reparto</h3>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
            aria-label="Editar vehículo"
          >
            <PenLine className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => setEditing(false)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
            aria-label="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="relative mb-4 overflow-hidden rounded-xl bg-gradient-to-br from-[#0F172A] to-[#1E293B] p-4">
        <Icon className="absolute -bottom-2 -right-2 h-28 w-28 text-white/5" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/20">
            <Icon className="h-7 w-7 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-cyan-400/80">{VEHICLE_TYPES[type] || 'Motocicleta'}</p>
            <p className="text-lg font-black text-white">{brand || model || 'Modelo pendiente'}</p>
            {plate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-white/70">
                <Hash className="h-3 w-3" />
                {plate}
              </span>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Tipo</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'motorcycle' | 'bicycle' | 'car')}
                className="h-10 w-full rounded-xl border border-white/10 bg-[#0F172A] px-3 text-xs font-semibold text-white outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
              >
                {Object.entries(VEHICLE_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Placa</span>
              <input
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={10}
                className="h-10 w-full rounded-xl border border-white/10 bg-[#0F172A] px-3 text-xs font-semibold uppercase text-white outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Marca</span>
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Yamaha, Honda..."
                className="h-10 w-full rounded-xl border border-white/10 bg-[#0F172A] px-3 text-xs font-semibold text-white outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Color</span>
              <select
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-full rounded-xl border border-white/10 bg-[#0F172A] px-3 text-xs font-semibold text-white outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
              >
                <option value="">Seleccionar</option>
                {VEHICLE_COLORS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Modelo</span>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="XTZ 150 2024"
              className="h-10 w-full rounded-xl border border-white/10 bg-[#0F172A] px-3 text-xs font-semibold text-white outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
            />
          </label>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-600 hover:to-emerald-600 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Guardando...' : 'Guardar vehículo'}
          </button>
        </motion.div>
      )}
    </motion.section>
  );
}
