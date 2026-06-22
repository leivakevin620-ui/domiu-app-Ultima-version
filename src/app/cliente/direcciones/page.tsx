'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { clientService, ClientAddress } from '@/services/client';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard, SkeletonList } from '@/components/ui/skeleton';
import { MapsProvider } from '@/contexts/MapsContext';
import dynamic from 'next/dynamic';
const PlacesAutocomplete = dynamic(() => import('@/components/tracking/maps/PlacesAutocomplete').then(m => ({ default: m.PlacesAutocomplete })), {
  ssr: false,
  loading: () => <SkeletonCard />,
});
import { logger } from '@/lib/logger';
import { MapPin, Plus, Pencil, Trash2, Star, Home, Briefcase, Map } from 'lucide-react';

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = { home: Home, work: Briefcase, other: Map };

export default function DireccionesPage() {
  const { profile } = useAuth();
  const [addresses, setAddresses] = useState<ClientAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'home', street_address: '', city: '', state_province: '', postal_code: '', country: 'Colombia', is_primary: false, label: '', latitude: 0, longitude: 0 });

  const load = () => {
    if (!profile?.id) return;
    clientService.getAddresses(profile.id).then(data => {
      setAddresses(data);
      setLoading(false);
    });
  };

  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });
  useEffect(() => { loadRef.current(); }, [profile?.id]);

  const handlePlaceSelected = useCallback((place: { lat: number; lng: number; formattedAddress: string; city?: string; state?: string; country?: string; postalCode?: string }) => {
    setForm(f => ({
      ...f,
      street_address: place.formattedAddress,
      city: place.city || f.city,
      state_province: place.state || f.state_province,
      country: place.country || 'Colombia',
      postal_code: place.postalCode || f.postal_code,
      latitude: place.lat,
      longitude: place.lng,
    }));
  }, []);

  const resetForm = () => {
    setForm({ type: 'home', street_address: '', city: '', state_province: '', postal_code: '', country: 'Colombia', is_primary: false, label: '', latitude: 0, longitude: 0 });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (addr: ClientAddress) => {
    setForm({ type: addr.type, street_address: addr.street_address, city: addr.city, state_province: addr.state_province ?? '', postal_code: addr.postal_code ?? '', country: addr.country, is_primary: addr.is_primary, label: '', latitude: addr.lat ?? 0, longitude: addr.lng ?? 0 });
    setEditingId(addr.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!profile?.id || saving) return;
    setSaving(true);
    try {
      if (editingId) {
        await clientService.updateAddress(editingId, profile.id, {
          ...form,
          lat: form.latitude || null,
          lng: form.longitude || null,
        });
      } else {
        await clientService.createAddress(profile.id, {
          ...form,
          lat: form.latitude || null,
          lng: form.longitude || null,
        });
      }
      resetForm();
      load();
    } catch (e) {
      logger.error('Error al guardar dirección', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await clientService.deleteAddress(id);
    load();
  };

  const handleSetDefault = async (id: string) => {
    if (!profile?.id) return;
    await clientService.setDefaultAddress(id, profile.id);
    load();
  };

  return (
    <MapsProvider>
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      <div className="sticky top-0 z-30 bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <h1 className="text-base font-bold text-foreground">Direcciones</h1>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Nueva
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="overflow-hidden rounded-2xl border border-border/30 bg-card p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-foreground">{editingId ? 'Editar dirección' : 'Nueva dirección'}</h2>
              <button onClick={resetForm} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                {['home', 'work', 'other'].map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, type: t }))}
                    className={`flex-1 rounded-lg py-2 text-xs font-semibold capitalize transition-all ${
                      form.type === t ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t === 'home' ? 'Casa' : t === 'work' ? 'Trabajo' : 'Otro'}
                  </button>
                ))}
              </div>
              <PlacesAutocomplete
                onPlaceSelected={handlePlaceSelected}
                placeholder="Buscar dirección *"
                defaultValue={form.street_address}
              />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Ciudad *" className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                <input value={form.state_province} onChange={e => setForm(f => ({ ...f, state_province: e.target.value }))} placeholder="Departamento" className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))} placeholder="Código postal" className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="País" className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={form.is_primary} onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))} className="rounded border-border" />
                Establecer como dirección principal
              </label>
              <button
                onClick={handleSave}
                disabled={saving || !form.street_address || !form.city}
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Agregar dirección'}
              </button>
            </div>
          </motion.div>
        )}

        {loading ? (
          <SkeletonList />
        ) : addresses.length === 0 && !showForm ? (
          <EmptyState
            icon={<MapPin className="h-6 w-6" />}
            title="Sin direcciones"
            description="Agrega tu primera dirección para recibir pedidos."
            action={
              <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
                <Plus className="h-4 w-4" /> Agregar dirección
              </button>
            }
          />
        ) : (
          <AnimatePresence>
            {addresses.map((addr, i) => {
              const Icon = TYPE_ICONS[addr.type] ?? MapPin;
              return (
                <motion.div
                  key={addr.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative rounded-2xl border border-border/30 bg-card/50 p-5 transition-all hover:border-primary/20"
                >
                  {addr.is_primary && (
                    <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                      <Star className="h-3 w-3 fill-current" /> Principal
                    </span>
                  )}
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${addr.type === 'work' ? 'bg-blue-50 text-blue-500' : addr.type === 'home' ? 'bg-emerald-50 text-emerald-500' : 'bg-purple-50 text-purple-500'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {addr.type === 'home' ? 'Casa' : addr.type === 'work' ? 'Trabajo' : 'Otro'}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{addr.street_address}</p>
                      <p className="text-xs text-muted-foreground">
                        {[addr.city, addr.state_province, addr.country].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t border-border/20 pt-3">
                    <button onClick={() => handleEdit(addr)} className="flex items-center gap-1 rounded-lg bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3 w-3" /> Editar
                    </button>
                    {!addr.is_primary && (
                      <button onClick={() => handleSetDefault(addr.id)} className="flex items-center gap-1 rounded-lg bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                        <Star className="h-3 w-3" /> Principal
                      </button>
                    )}
                    <button onClick={() => handleDelete(addr.id)} className="ml-auto flex items-center gap-1 rounded-lg bg-muted/50 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50">
                      <Trash2 className="h-3 w-3" /> Eliminar
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
    </MapsProvider>
  );
}
