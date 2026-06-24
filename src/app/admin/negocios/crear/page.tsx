'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Store, ArrowLeft, Loader2, CheckCircle, UserPlus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { createBusinessAction, getAvailableOwners } from '@/app/actions/admin-business';

export default function CrearNegocioPage() {
  const router = useRouter();
  const [owners, setOwners] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOwner, setCreateOwner] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
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

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.name.trim()) errors.name = 'El nombre del negocio es obligatorio';
    else if (form.name.trim().length < 2) errors.name = 'Mínimo 2 caracteres';

    if (!form.slug.trim()) errors.slug = 'El slug es obligatorio';
    else if (!/^[a-z0-9-]+$/.test(form.slug)) errors.slug = 'Solo minúsculas, números y guiones';

    if (!form.address.trim()) errors.address = 'La dirección es obligatoria';

    if (form.latitude && (isNaN(Number(form.latitude)) || Number(form.latitude) < -90 || Number(form.latitude) > 90)) {
      errors.latitude = 'Latitud inválida (-90 a 90)';
    }
    if (form.longitude && (isNaN(Number(form.longitude)) || Number(form.longitude) < -180 || Number(form.longitude) > 180)) {
      errors.longitude = 'Longitud inválida (-180 a 180)';
    }

    if (createOwner) {
      if (!form.ownerName.trim()) errors.ownerName = 'Nombre del propietario obligatorio';
      if (!form.ownerEmail.trim()) errors.ownerEmail = 'Email del propietario obligatorio';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ownerEmail)) errors.ownerEmail = 'Email inválido';
      if (!form.ownerPassword) errors.ownerPassword = 'Contraseña obligatoria';
      else if (form.ownerPassword.length < 6) errors.ownerPassword = 'Mínimo 6 caracteres';
    } else if (!form.ownerId) {
      errors.ownerId = 'Selecciona un propietario o activa "Crear nuevo usuario propietario"';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.debug('[admin-business] submit clicked');

    setErrorMsg('');

    if (!validateForm()) {
      console.debug('[admin-business] validation failed');
      return;
    }

    setLoading(true);

    try {
      const res = await createBusinessAction({
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || undefined,
        cuisineType: form.cuisineType.trim() || undefined,
        businessType: 'restaurant',
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        ownerId: form.ownerId || undefined,
        createOwner,
        ownerName: form.ownerName.trim() || undefined,
        ownerEmail: form.ownerEmail.trim() || undefined,
        ownerPassword: form.ownerPassword || undefined,
        address: form.address.trim(),
        city: form.city.trim(),
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        isVerified: form.isVerified,
      });

      if (res.error) {
        setErrorMsg(res.error);
        toast.error(res.error);
        setLoading(false);
        return;
      }

      toast.success('Negocio creado exitosamente');
      router.push('/admin/locales');
    } catch (err) {
      const msg = 'Error inesperado: ' + (err instanceof Error ? err.message : 'intenta de nuevo');
      console.error('[admin-business]', err);
      setErrorMsg(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors(prev => { const c = { ...prev }; delete c[field]; return c; });
    }
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
        {errorMsg && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive font-medium">{errorMsg}</p>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Información del Negocio</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Nombre del negocio *</label>
              <input value={form.name} onChange={e => { updateField('name', e.target.value); generateSlug(e.target.value); }} required className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring/50 focus:outline-none" placeholder="Ej: Pizzas Donde Juan" />
              {validationErrors.name && <p className="text-xs text-destructive">{validationErrors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Slug *</label>
              <input value={form.slug} onChange={e => updateField('slug', e.target.value)} required className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground font-mono focus:border-ring/50 focus:outline-none" placeholder="pizzas-donde-juan" />
              {validationErrors.slug && <p className="text-xs text-destructive">{validationErrors.slug}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Descripción</label>
            <textarea value={form.description} onChange={e => updateField('description', e.target.value)} rows={3} className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring/50 focus:outline-none" placeholder="Breve descripción del negocio..." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Tipo de cocina</label>
              <input value={form.cuisineType} onChange={e => updateField('cuisineType', e.target.value)} className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" placeholder="Ej: Tradicional" />
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
                {validationErrors.ownerName && <p className="text-xs text-destructive">{validationErrors.ownerName}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Email *</label>
                <input value={form.ownerEmail} onChange={e => updateField('ownerEmail', e.target.value)} type="email" required className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" />
                {validationErrors.ownerEmail && <p className="text-xs text-destructive">{validationErrors.ownerEmail}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Contraseña *</label>
                <input value={form.ownerPassword} onChange={e => updateField('ownerPassword', e.target.value)} type="password" required minLength={6} className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" />
                {validationErrors.ownerPassword && <p className="text-xs text-destructive">{validationErrors.ownerPassword}</p>}
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
              {validationErrors.ownerId && <p className="text-xs text-destructive">{validationErrors.ownerId}</p>}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dirección</h3>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Dirección *</label>
            <input value={form.address} onChange={e => updateField('address', e.target.value)} required className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" placeholder="Calle 10 #20-30" />
            {validationErrors.address && <p className="text-xs text-destructive">{validationErrors.address}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Ciudad</label>
              <input value={form.city} onChange={e => updateField('city', e.target.value)} className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Latitud</label>
              <input value={form.latitude} onChange={e => updateField('latitude', e.target.value)} type="number" step="any" className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" />
              {validationErrors.latitude && <p className="text-xs text-destructive">{validationErrors.latitude}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Longitud</label>
              <input value={form.longitude} onChange={e => updateField('longitude', e.target.value)} type="number" step="any" className="h-10 w-full rounded-lg border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none" />
              {validationErrors.longitude && <p className="text-xs text-destructive">{validationErrors.longitude}</p>}
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
          <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-success px-6 py-2.5 text-sm font-semibold text-white hover:bg-success/90 border-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
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
