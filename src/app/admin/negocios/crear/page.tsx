'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Store } from 'lucide-react';
import { toast } from 'sonner';
import { getAvailableOwners } from '@/app/actions/admin-business';
import { createBusinessCompleteAction } from '@/app/actions/admin-business-management';

const TYPES = [
  ['restaurant', 'Restaurante'], ['fast_food', 'Comida rápida'], ['cafe', 'Cafetería'],
  ['bakery', 'Panadería'], ['supermarket', 'Supermercado'], ['pharmacy', 'Farmacia'],
  ['store', 'Tienda'], ['other', 'Otro'],
];

export default function CrearNegocioPage() {
  const router = useRouter();
  const [owners, setOwners] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [loadingOwners, setLoadingOwners] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', slug: '', description: '', cuisineType: '', businessType: 'restaurant',
    phone: '', email: '', website: '', ownerId: '', address: '', city: 'Santa Marta',
    latitude: '', longitude: '', isVerified: false,
  });

  useEffect(() => {
    getAvailableOwners().then(setOwners).catch(() => toast.error('No se pudieron cargar propietarios')).finally(() => setLoadingOwners(false));
  }, []);

  const set = (key: string, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));
  const makeSlug = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await createBusinessCompleteAction({
        name: form.name,
        slug: form.slug,
        description: form.description,
        cuisineType: form.cuisineType,
        businessType: form.businessType,
        phone: form.phone,
        email: form.email,
        website: form.website,
        ownerId: form.ownerId,
        address: form.address,
        city: form.city,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        isVerified: form.isVerified,
      });
      if (result.error) return toast.error(result.error);
      toast.success('Negocio, dirección, horarios y propietario configurados');
      router.push(`/admin/negocios/${result.businessId}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const input = 'h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none';
  const label = 'text-xs font-semibold text-muted-foreground';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/admin/negocios')} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border"><ArrowLeft className="h-4 w-4" /></button>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20"><Store className="h-5 w-5 text-success" /></div>
        <div><h1 className="text-xl font-bold">Crear negocio</h1><p className="text-sm text-muted-foreground">Alta administrativa completa y segura</p></div>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Información comercial</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5"><span className={label}>Nombre *</span><input required minLength={3} value={form.name} onChange={e => { set('name', e.target.value); set('slug', makeSlug(e.target.value)); }} className={input} /></label>
            <label className="space-y-1.5"><span className={label}>Slug *</span><input required pattern="[a-z0-9-]+" value={form.slug} onChange={e => set('slug', makeSlug(e.target.value))} className={input} /></label>
            <label className="space-y-1.5"><span className={label}>Tipo *</span><select value={form.businessType} onChange={e => set('businessType', e.target.value)} className={input}>{TYPES.map(([v,n]) => <option key={v} value={v}>{n}</option>)}</select></label>
            <label className="space-y-1.5"><span className={label}>Categoría o cocina</span><input value={form.cuisineType} onChange={e => set('cuisineType', e.target.value)} className={input} /></label>
          </div>
          <label className="block space-y-1.5"><span className={label}>Descripción</span><textarea maxLength={1200} rows={3} value={form.description} onChange={e => set('description', e.target.value)} className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm" /></label>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1.5"><span className={label}>Teléfono</span><input value={form.phone} onChange={e => set('phone', e.target.value)} className={input} /></label>
            <label className="space-y-1.5"><span className={label}>Correo</span><input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={input} /></label>
            <label className="space-y-1.5"><span className={label}>Sitio web</span><input value={form.website} onChange={e => set('website', e.target.value)} className={input} /></label>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Propietario</h2>
          <label className="block space-y-1.5"><span className={label}>Usuario propietario *</span><select required disabled={loadingOwners} value={form.ownerId} onChange={e => set('ownerId', e.target.value)} className={input}><option value="">{loadingOwners ? 'Cargando...' : 'Selecciona un usuario activo'}</option>{owners.map(o => <option key={o.id} value={o.id}>{o.name} — {o.email}</option>)}</select></label>
          <p className="text-xs text-muted-foreground">Al crear el negocio, el usuario será convertido automáticamente a rol merchant.</p>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Ubicación principal</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 md:col-span-2"><span className={label}>Dirección *</span><input required minLength={5} value={form.address} onChange={e => set('address', e.target.value)} className={input} /></label>
            <label className="space-y-1.5"><span className={label}>Ciudad *</span><input required value={form.city} onChange={e => set('city', e.target.value)} className={input} /></label>
            <label className="flex items-center gap-2 self-end pb-2"><input type="checkbox" checked={form.isVerified} onChange={e => set('isVerified', e.target.checked)} /> <span className="text-sm">Crear como verificado</span></label>
            <label className="space-y-1.5"><span className={label}>Latitud</span><input type="number" step="any" min="-90" max="90" value={form.latitude} onChange={e => set('latitude', e.target.value)} className={input} /></label>
            <label className="space-y-1.5"><span className={label}>Longitud</span><input type="number" step="any" min="-180" max="180" value={form.longitude} onChange={e => set('longitude', e.target.value)} className={input} /></label>
          </div>
        </section>

        <div className="flex justify-end gap-3"><button type="button" onClick={() => router.push('/admin/negocios')} className="rounded-lg border border-border px-4 py-2 text-sm">Cancelar</button><button disabled={saving || loadingOwners} className="inline-flex items-center gap-2 rounded-lg bg-success px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Crear negocio completo</button></div>
      </form>
    </div>
  );
}
