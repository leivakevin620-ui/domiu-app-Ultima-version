'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Store, ArrowLeft, Loader2, CheckCircle, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { createBusinessAction, getAvailableOwners } from '@/app/actions/admin-business';

export default function CrearNegocioPage() {
  const router = useRouter();
  const [owners, setOwners] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOwner, setCreateOwner] = useState(false);
  const [form, setForm] = useState({
    name: '', slug: '', description: '', cuisineType: '', phone: '', email: '',
    ownerId: '', ownerName: '', ownerEmail: '', ownerPassword: '',
    address: '', city: 'Santa Marta', latitude: '', longitude: '',
    isVerified: false,
  });

  useEffect(() => {
    getAvailableOwners().then(setOwners).catch(() => {});
  }, []);

  const generateSlug = (name: string) => {
    setForm(prev => ({ ...prev, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await createBusinessAction({
      name: form.name,
      slug: form.slug,
      description: form.description || undefined,
      cuisineType: form.cuisineType || undefined,
      businessType: 'restaurant',
      phone: form.phone || undefined,
      email: form.email || undefined,
      ownerId: form.ownerId || undefined,
      createOwner,
      ownerName: form.ownerName || undefined,
      ownerEmail: form.ownerEmail || undefined,
      ownerPassword: form.ownerPassword || undefined,
      address: form.address,
      city: form.city,
      latitude: form.latitude ? Number(form.latitude) : undefined,
      longitude: form.longitude ? Number(form.longitude) : undefined,
      isVerified: form.isVerified,
    });

    if (res.error) {
      toast.error(res.error);
      setLoading(false);
      return;
    }

    toast.success('Negocio creado exitosamente');
    router.push('/admin/negocios');
  };

  const updateField = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20">
          <Store className="h-5 w-5 text-success" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Crear Nuevo Negocio</h1>
          <p className="text-sm text-muted-foreground">Registra un local en la plataforma</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Información del Negocio</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Nombre del negocio *</label>
              <input value={form.name} onChange={e => { updateField('name', e.target.value); generateSlug(e.target.value); }} required className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring/50 focus:outline-none" placeholder="Ej: Pizzas Donde Juan" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Slug *</label>
              <input value={form.slug} onChange={e => updateField('slug', e.target.value)} required className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground font-mono focus:border-ring/50 focus:outline-none" placeholder="pizzas-donde-juan" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Descripción</label>
            <textarea value={form.description} onChange={e => updateField('description', e.target.value)} rows={3} className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring/50 focus:outline-none" placeholder="Breve descripción del negocio..." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Tipo de cocina</label>
              <input value={form.cuisineType} onChange={e => updateField('cuisineType', e.target.value)} className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" placeholder="Ej: Italiana" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Teléfono</label>
              <input value={form.phone} onChange={e => updateField('phone', e.target.value)} className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" placeholder="3001234567" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Email</label>
              <input value={form.email} onChange={e => updateField('email', e.target.value)} type="email" className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" placeholder="local@ejemplo.com" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Propietario</h3>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="createOwner" checked={createOwner} onChange={e => setCreateOwner(e.target.checked)} className="rounded border-border bg-input-bg text-success focus:ring-ring/30" />
            <label htmlFor="createOwner" className="text-sm text-foreground/80 flex items-center gap-1.5">
              <UserPlus className="h-4 w-4 text-success" /> Crear nuevo usuario propietario
            </label>
          </div>

          {createOwner ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Nombre completo *</label>
                <input value={form.ownerName} onChange={e => updateField('ownerName', e.target.value)} required className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Email *</label>
                <input value={form.ownerEmail} onChange={e => updateField('ownerEmail', e.target.value)} type="email" required className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Contraseña *</label>
                <input value={form.ownerPassword} onChange={e => updateField('ownerPassword', e.target.value)} type="password" required minLength={6} className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Seleccionar propietario existente *</label>
              <select value={form.ownerId} onChange={e => updateField('ownerId', e.target.value)} required className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none">
                <option value="">Selecciona un usuario...</option>
                {owners.map(o => (
                  <option key={o.id} value={o.id}>{o.name} ({o.email})</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dirección</h3>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Dirección *</label>
            <input value={form.address} onChange={e => updateField('address', e.target.value)} required className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" placeholder="Calle 10 #20-30" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Ciudad</label>
              <input value={form.city} onChange={e => updateField('city', e.target.value)} className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Latitud</label>
              <input value={form.latitude} onChange={e => updateField('latitude', e.target.value)} type="number" step="any" className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Longitud</label>
              <input value={form.longitude} onChange={e => updateField('longitude', e.target.value)} type="number" step="any" className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="isVerified" checked={form.isVerified} onChange={e => updateField('isVerified', e.target.checked)} className="rounded border-border bg-input-bg text-success focus:ring-ring/30" />
          <label htmlFor="isVerified" className="text-sm text-foreground/80 flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4 text-success" /> Marcar como verificado
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-success px-6 py-2.5 text-sm font-semibold text-white hover:bg-success/90 border-0 transition-all disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
            {loading ? 'Creando...' : 'Crear Negocio'}
          </button>
          <button type="button" onClick={() => router.back()} className="rounded-xl border border-border px-6 py-2.5 text-sm text-foreground/80 hover:text-foreground transition-all">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
