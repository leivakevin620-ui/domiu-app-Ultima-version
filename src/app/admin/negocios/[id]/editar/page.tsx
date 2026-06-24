'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Store, ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getBusinessFullDetail, updateBusinessAction, updateBusinessHoursAction, updateBusinessAddressAction } from '@/app/actions/admin-business';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function EditarNegocioPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState({
    name: '', description: '', cuisineType: '', phone: '', email: '',
    isVerified: false, isActive: true,
  });
  const [hours, setHours] = useState<Array<{ day_of_week: number; opens_at: string; closes_at: string; is_closed: boolean }>>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [tab, setTab] = useState<'general' | 'hours' | 'address'>('general');

  useEffect(() => {
    (async () => {
      try {
        const d = await getBusinessFullDetail(id);
        if (d) {
          setData(d);
          setForm({
            name: d.business.name || '',
            description: d.business.description || '',
            cuisineType: d.business.cuisine_type || '',
            phone: d.business.phone || '',
            email: d.business.email || '',
            isVerified: d.business.is_verified || false,
            isActive: d.business.is_active ?? true,
          });
          setHours(d.hours?.map((h: any) => ({
            day_of_week: h.day_of_week,
            opens_at: h.opens_at?.slice(0, 5) || '08:00',
            closes_at: h.closes_at?.slice(0, 5) || '22:00',
            is_closed: h.is_closed || false,
          })) || []);
          setAddresses(d.addresses || []);
        }
      } catch { toast.error('Error al cargar datos'); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await updateBusinessAction(id, {
      name: form.name,
      description: form.description || undefined,
      cuisineType: form.cuisineType || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      isVerified: form.isVerified,
      isActive: form.isActive,
    });
    if (res.error) { toast.error(res.error); setSaving(false); return; }
    toast.success('Datos actualizados');
    setSaving(false);
  };

  const handleSaveHours = async () => {
    setSaving(true);
    const res = await updateBusinessHoursAction(id, hours);
    if (res.error) { toast.error(res.error); setSaving(false); return; }
    toast.success('Horarios actualizados');
    setSaving(false);
  };

  const handleSaveAddress = async (addressId: string, updates: Record<string, any>) => {
    const res = await updateBusinessAddressAction(addressId, updates);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Dirección actualizada');
  };

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Cargando...</div>;
  }

  if (!data) {
    return <div className="py-20 text-center text-slate-500">Negocio no encontrado</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push(`/admin/negocios/${id}`)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/50 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900/50">
          <Store className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Editar {data.business.name}</h1>
          <p className="text-sm text-slate-400">Modifica los datos del local</p>
        </div>
      </div>

      <div className="flex border-b border-slate-700/50">
        {[
          { key: 'general' as const, label: 'Información' },
          { key: 'hours' as const, label: 'Horarios' },
          { key: 'address' as const, label: 'Dirección' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
              tab === t.key ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'general' && (
        <form onSubmit={handleSaveGeneral} className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500">Nombre</label>
              <input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500">Tipo de cocina</label>
              <input value={form.cuisineType} onChange={e => setForm(prev => ({ ...prev, cuisineType: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-500">Descripción</label>
            <textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={3} className="w-full rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500">Teléfono</label>
              <input value={form.phone} onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500">Email</label>
              <input value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} type="email" className="h-10 w-full rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isVerified} onChange={e => setForm(prev => ({ ...prev, isVerified: e.target.checked }))} className="rounded border-slate-600 bg-slate-700 text-emerald-500" />
              <span className="text-sm text-slate-300">Verificado</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))} className="rounded border-slate-600 bg-slate-700 text-emerald-500" />
              <span className="text-sm text-slate-300">Activo</span>
            </label>
          </div>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-900/50 px-4 py-2 text-sm font-medium text-emerald-400 border border-emerald-800/50 hover:bg-emerald-900/70 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar Cambios
          </button>
        </form>
      )}

      {tab === 'hours' && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5 space-y-3">
          {hours.map((h) => (
            <div key={h.day_of_week} className="flex items-center gap-3 p-2 rounded-lg bg-slate-700/20">
              <span className="w-24 text-sm font-medium text-white">{DAY_NAMES[h.day_of_week]}</span>
              <label className="flex items-center gap-2 text-sm text-slate-400">
                <input type="checkbox" checked={!h.is_closed} onChange={() => setHours(prev => prev.map(x => x.day_of_week === h.day_of_week ? { ...x, is_closed: !x.is_closed } : x))} className="rounded border-slate-600 bg-slate-700 text-emerald-500" />
                Abierto
              </label>
              {!h.is_closed && (
                <>
                  <input type="time" value={h.opens_at} onChange={e => setHours(prev => prev.map(x => x.day_of_week === h.day_of_week ? { ...x, opens_at: e.target.value } : x))} className="h-9 w-28 rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 text-sm text-white" />
                  <span className="text-slate-500">—</span>
                  <input type="time" value={h.closes_at} onChange={e => setHours(prev => prev.map(x => x.day_of_week === h.day_of_week ? { ...x, closes_at: e.target.value } : x))} className="h-9 w-28 rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 text-sm text-white" />
                </>
              )}
            </div>
          ))}
          <button onClick={handleSaveHours} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-900/50 px-4 py-2 text-sm font-medium text-emerald-400 border border-emerald-800/50 hover:bg-emerald-900/70 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar Horarios
          </button>
        </div>
      )}

      {tab === 'address' && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5 space-y-4">
          {addresses.map((a: any) => (
            <AddressEditor key={a.id} address={a} onSave={(updates) => handleSaveAddress(a.id, updates)} />
          ))}
          {addresses.length === 0 && <p className="text-sm text-slate-500">Sin direcciones registradas</p>}
        </div>
      )}
    </div>
  );
}

function AddressEditor({ address, onSave }: { address: any; onSave: (updates: Record<string, any>) => void }) {
  const [street, setStreet] = useState(address.street_address || '');
  const [city, setCity] = useState(address.city || 'Santa Marta');
  const [lat, setLat] = useState(address.latitude?.toString() || '');
  const [lng, setLng] = useState(address.longitude?.toString() || '');

  return (
    <div className="space-y-3 rounded-lg bg-slate-700/20 p-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">{address.is_primary ? 'Dirección Principal' : 'Dirección'}</span>
        {address.is_primary && <span className="text-[10px] text-emerald-400">PRINCIPAL</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500">Dirección</label>
          <input value={street} onChange={e => setStreet(e.target.value)} className="h-9 w-full rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 text-sm text-white" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500">Ciudad</label>
          <input value={city} onChange={e => setCity(e.target.value)} className="h-9 w-full rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 text-sm text-white" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500">Latitud</label>
          <input value={lat} onChange={e => setLat(e.target.value)} type="number" step="any" className="h-9 w-full rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 text-sm text-white" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500">Longitud</label>
          <input value={lng} onChange={e => setLng(e.target.value)} type="number" step="any" className="h-9 w-full rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 text-sm text-white" />
        </div>
      </div>
      <button onClick={() => onSave({ street_address: street, city, latitude: lat ? Number(lat) : null, longitude: lng ? Number(lng) : null })} className="rounded-lg bg-emerald-900/50 px-3 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-800/50 hover:bg-emerald-900/70">
        Guardar Dirección
      </button>
    </div>
  );
}
