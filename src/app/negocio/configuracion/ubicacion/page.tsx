'use client';

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Building2,
  LocateFixed,
  MapPin,
  Pencil,
  Plus,
  Save,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { MapsProvider } from '@/contexts/MapsContext';
import { getBrowserClient } from '@/lib/db/supabase';
import { getCurrentExactLocation, isCoordinateFallback } from '@/lib/maps/geolocation';
import { SkeletonCard } from '@/components/ui/skeleton';
import { LocationMapPicker } from '@/components/tracking/maps/LocationMapPicker';

const PlacesAutocomplete = dynamic(
  () => import('@/components/tracking/maps/PlacesAutocomplete').then((module) => module.PlacesAutocomplete),
  { ssr: false, loading: () => <SkeletonCard /> },
);

type BusinessLocation = {
  id: string;
  name: string;
  streetAddress: string;
  formattedAddress: string;
  placeId: string;
  city: string;
  state: string;
  neighborhood: string;
  country: string;
  postalCode: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  isPrimary: boolean;
  isActive: boolean;
  deliveryAvailable: boolean;
  serviceRadiusKm: number;
};

const EMPTY_LOCATION: BusinessLocation = {
  id: '',
  name: 'Local principal',
  streetAddress: '',
  formattedAddress: '',
  placeId: '',
  city: 'Santa Marta',
  state: 'Magdalena',
  neighborhood: '',
  country: 'Colombia',
  postalCode: '',
  phone: '',
  latitude: null,
  longitude: null,
  accuracy: null,
  isPrimary: true,
  isActive: true,
  deliveryAvailable: true,
  serviceRadiusKm: 8,
};

function BusinessLocationContent() {
  const router = useRouter();
  const { profile } = useAuth();
  const [businessId, setBusinessId] = useState('');
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [form, setForm] = useState<BusinessLocation>(EMPTY_LOCATION);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const supabase = getBrowserClient();
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', profile.id)
        .is('deleted_at', null)
        .maybeSingle();
      if (businessError) throw businessError;
      if (!business) throw new Error('No se encontró un negocio vinculado a esta cuenta');
      setBusinessId(business.id);

      const { data, error } = await supabase
        .from('business_addresses')
        .select('id,name,street_address,formatted_address,place_id,city,state_province,neighborhood,country,postal_code,phone,latitude,longitude,is_primary,is_active,delivery_available,service_radius_km,metadata')
        .eq('business_id', business.id)
        .is('deleted_at', null)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;

      setLocations(
        (data ?? []).map((row) => ({
          id: String(row.id),
          name: String(row.name || (row.is_primary ? 'Local principal' : 'Sucursal')),
          streetAddress: String(row.street_address || ''),
          formattedAddress: String(row.formatted_address || row.street_address || ''),
          placeId: String(row.place_id || ''),
          city: String(row.city || 'Santa Marta'),
          state: String(row.state_province || 'Magdalena'),
          neighborhood: String(row.neighborhood || ''),
          country: String(row.country || 'Colombia'),
          postalCode: String(row.postal_code || ''),
          phone: String(row.phone || ''),
          latitude: row.latitude == null ? null : Number(row.latitude),
          longitude: row.longitude == null ? null : Number(row.longitude),
          accuracy:
            row.metadata && typeof row.metadata === 'object'
              ? Number((row.metadata as Record<string, unknown>).location_accuracy_meters || 0) || null
              : null,
          isPrimary: Boolean(row.is_primary),
          isActive: Boolean(row.is_active),
          deliveryAvailable: Boolean(row.delivery_available),
          serviceRadiusKm: Number(row.service_radius_km ?? 8),
        })),
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudieron cargar los locales');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setForm({
      ...EMPTY_LOCATION,
      name: locations.length === 0 ? 'Local principal' : `Sucursal ${locations.length + 1}`,
      isPrimary: locations.length === 0,
    });
    setShowForm(true);
  };

  const edit = (location: BusinessLocation) => {
    setForm({ ...location });
    setShowForm(true);
  };

  const useCurrentLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const location = await getCurrentExactLocation();
      setForm((current) => ({
        ...current,
        streetAddress:
          isCoordinateFallback(location.formattedAddress) && current.streetAddress.trim()
            ? current.streetAddress
            : location.formattedAddress,
        formattedAddress:
          isCoordinateFallback(location.formattedAddress) && current.formattedAddress.trim()
            ? current.formattedAddress
            : location.formattedAddress,
        placeId: '',
        city: location.city || current.city,
        state: location.state || current.state,
        country: location.country || current.country,
        postalCode: location.postalCode || current.postalCode,
        latitude: location.lat,
        longitude: location.lng,
        accuracy: location.accuracy,
      }));
      toast.success('GPS del local capturado. Ajusta el marcador sobre la entrada.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo obtener la ubicación');
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    if (!businessId || saving) return;
    if (!form.name.trim() || !form.streetAddress.trim()) {
      toast.error('Escribe el nombre y la dirección del local');
      return;
    }
    if (form.latitude == null || form.longitude == null) {
      toast.error('Selecciona la dirección o comparte el GPS para guardar coordenadas exactas');
      return;
    }
    if (form.serviceRadiusKm <= 0 || form.serviceRadiusKm > 100) {
      toast.error('El radio de cobertura debe estar entre 1 y 100 kilómetros');
      return;
    }

    setSaving(true);
    try {
      const supabase = getBrowserClient();
      if (form.isPrimary) {
        const { error: resetError } = await supabase
          .from('business_addresses')
          .update({ is_primary: false })
          .eq('business_id', businessId)
          .eq('is_primary', true);
        if (resetError) throw resetError;
      }

      const payload = {
        business_id: businessId,
        name: form.name.trim(),
        street_address: form.streetAddress.trim(),
        formatted_address: form.formattedAddress.trim() || form.streetAddress.trim(),
        place_id: form.placeId.trim() || null,
        city: form.city.trim() || 'Santa Marta',
        state_province: form.state.trim() || 'Magdalena',
        neighborhood: form.neighborhood.trim() || null,
        country: form.country.trim() || 'Colombia',
        postal_code: form.postalCode.trim() || null,
        phone: form.phone.trim() || null,
        latitude: form.latitude,
        longitude: form.longitude,
        is_primary: form.isPrimary,
        is_active: form.isActive,
        delivery_available: form.deliveryAvailable,
        service_radius_km: form.serviceRadiusKm,
        metadata: {
          location_accuracy_meters: form.accuracy,
          coordinates_source: form.placeId ? 'google_places_or_map' : 'merchant_device_gps',
          location_verified: true,
          place_id: form.placeId || null,
          neighborhood: form.neighborhood || null,
          service_radius_km: form.serviceRadiusKm,
        },
        updated_at: new Date().toISOString(),
      };

      const query = form.id
        ? supabase.from('business_addresses').update(payload).eq('id', form.id).eq('business_id', businessId)
        : supabase.from('business_addresses').insert(payload);
      const { data, error } = await query.select('id').single();
      if (error || !data) throw new Error(error?.message || 'No se pudo guardar el local');

      if (form.isPrimary) {
        const { error: businessUpdateError } = await supabase
          .from('businesses')
          .update({
            latitude: form.latitude,
            longitude: form.longitude,
            updated_at: new Date().toISOString(),
          })
          .eq('id', businessId);
        if (businessUpdateError) throw businessUpdateError;
      }

      setShowForm(false);
      setForm({ ...EMPTY_LOCATION });
      toast.success('Local y coordenadas guardados correctamente');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo guardar el local');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (location: BusinessLocation) => {
    if (!businessId) return;
    if (location.isPrimary && locations.filter((item) => item.isActive).length > 1) {
      toast.error('Primero marca otra sede como principal');
      return;
    }
    try {
      const supabase = getBrowserClient();
      const { error } = await supabase
        .from('business_addresses')
        .update({ deleted_at: new Date().toISOString(), is_active: false, is_primary: false })
        .eq('id', location.id)
        .eq('business_id', businessId);
      if (error) throw error;
      toast.success('Local eliminado');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo eliminar el local');
    }
  };

  if (loading) return <SkeletonCard />;

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="rounded-xl border p-2" aria-label="Volver"><ArrowLeft className="h-5 w-5" /></button>
          <div><h1 className="text-2xl font-black">Locales y ubicaciones</h1><p className="text-sm text-muted-foreground">Cada pedido parte de la sede exacta seleccionada.</p></div>
        </div>
        <button type="button" onClick={openNew} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground"><Plus className="h-4 w-4" />Agregar local</button>
      </header>

      {showForm && (
        <section className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-black">{form.id ? 'Editar local' : 'Nuevo local'}</h2><button type="button" onClick={() => setShowForm(false)} aria-label="Cerrar"><X className="h-5 w-5" /></button></div>
          <button type="button" onClick={() => void useCurrentLocation()} disabled={locating} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 text-sm font-black text-primary-foreground disabled:opacity-60"><LocateFixed className={`h-5 w-5 ${locating ? 'animate-pulse' : ''}`} />{locating ? 'Obteniendo coordenadas del local…' : 'Compartir ubicación actual del local'}</button>
          <div className="relative my-5 text-center text-xs text-muted-foreground before:absolute before:left-0 before:right-0 before:top-1/2 before:border-t"><span className="relative bg-card px-3">buscar con Google Maps</span></div>
          <div className="space-y-3">
            <PlacesAutocomplete
              defaultValue={form.streetAddress}
              placeholder="Escribe o busca la dirección del establecimiento"
              onValueChange={(streetAddress) => setForm((current) => streetAddress === current.streetAddress ? current : { ...current, streetAddress, formattedAddress: streetAddress, placeId: '', latitude: null, longitude: null, accuracy: null })}
              onPlaceSelected={(place) => setForm((current) => ({ ...current, streetAddress: place.formattedAddress, formattedAddress: place.formattedAddress, placeId: place.placeId || '', city: place.city || current.city, state: place.state || current.state, neighborhood: place.neighborhood || current.neighborhood, country: place.country || current.country, postalCode: place.postalCode || current.postalCode, latitude: place.lat, longitude: place.lng, accuracy: null }))}
            />
            <LocationMapPicker
              latitude={form.latitude}
              longitude={form.longitude}
              label={form.name || 'Local'}
              onLocationChange={(location) => setForm((current) => ({ ...current, latitude: location.lat, longitude: location.lng, streetAddress: location.formattedAddress || current.streetAddress, formattedAddress: location.formattedAddress || current.formattedAddress, placeId: location.placeId || current.placeId, city: location.city || current.city, state: location.state || current.state, neighborhood: location.neighborhood || current.neighborhood, country: location.country || current.country, postalCode: location.postalCode || current.postalCode, accuracy: null }))}
            />
            <div className="grid gap-3 sm:grid-cols-2"><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nombre del local" className="rounded-xl border bg-background px-3 py-2.5 text-sm" /><input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Teléfono del local" className="rounded-xl border bg-background px-3 py-2.5 text-sm" /></div>
            <div className="grid gap-3 sm:grid-cols-3"><input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} placeholder="Ciudad" className="rounded-xl border bg-background px-3 py-2.5 text-sm" /><input value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))} placeholder="Departamento" className="rounded-xl border bg-background px-3 py-2.5 text-sm" /><input value={form.neighborhood} onChange={(event) => setForm((current) => ({ ...current, neighborhood: event.target.value }))} placeholder="Barrio" className="rounded-xl border bg-background px-3 py-2.5 text-sm" /></div>
            <label className="block text-xs font-semibold text-muted-foreground">Radio máximo de cobertura<input type="number" min="1" max="100" step="0.5" value={form.serviceRadiusKm} onChange={(event) => setForm((current) => ({ ...current, serviceRadiusKm: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm text-foreground" /></label>
            <div className="grid gap-2 sm:grid-cols-3"><label className="flex items-center gap-2 rounded-xl border p-3 text-sm"><input type="checkbox" checked={form.isPrimary} onChange={(event) => setForm((current) => ({ ...current, isPrimary: event.target.checked }))} />Local principal</label><label className="flex items-center gap-2 rounded-xl border p-3 text-sm"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />Local activo</label><label className="flex items-center gap-2 rounded-xl border p-3 text-sm"><input type="checkbox" checked={form.deliveryAvailable} onChange={(event) => setForm((current) => ({ ...current, deliveryAvailable: event.target.checked }))} />Recibe domicilios</label></div>
            <div className={`rounded-xl p-4 ${form.latitude != null ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}><div className="flex gap-2"><MapPin className="h-5 w-5" /><div><p className="text-sm font-black">{form.latitude != null ? 'Coordenadas confirmadas' : 'Falta ubicación exacta'}</p><p className="mt-1 text-xs">{form.formattedAddress || form.streetAddress || 'Busca la dirección o comparte el GPS'}</p>{form.latitude != null && <p className="mt-1 text-[11px]">{form.latitude.toFixed(6)}, {form.longitude?.toFixed(6)}</p>}</div></div></div>
            <button type="button" onClick={() => void save()} disabled={saving || locating} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Guardando y verificando…' : 'Guardar local permanentemente'}</button>
          </div>
        </section>
      )}

      {locations.length === 0 ? (
        <section className="rounded-3xl border border-dashed p-10 text-center"><Building2 className="mx-auto h-10 w-10 text-muted-foreground" /><h2 className="mt-3 font-black">No hay locales configurados</h2><p className="mt-1 text-sm text-muted-foreground">Agrega el primer local para poder recibir pedidos y calcular rutas.</p><button type="button" onClick={openNew} className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Agregar local principal</button></section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {locations.map((location) => (
            <article key={location.id} className={`rounded-2xl border bg-card p-4 ${location.isPrimary ? 'border-primary/40 shadow-sm' : ''}`}>
              <div className="flex items-start gap-3"><div className="rounded-xl bg-orange-100 p-2 text-orange-600"><Building2 className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-black">{location.name}</h2>{location.isPrimary && <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary"><Star className="h-3 w-3 fill-current" />Principal</span>}{!location.isActive && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">Inactivo</span>}</div><p className="mt-1 text-sm text-muted-foreground">{location.formattedAddress || location.streetAddress}</p><p className={`mt-2 text-xs font-semibold ${location.latitude != null ? 'text-success' : 'text-destructive'}`}>{location.latitude != null ? `Coordenadas exactas · radio ${location.serviceRadiusKm} km` : 'Faltan coordenadas'}</p></div></div>
              <div className="mt-4 flex gap-2 border-t pt-3"><button type="button" onClick={() => edit(location)} className="flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold"><Pencil className="h-3 w-3" />Editar</button><button type="button" onClick={() => void remove(location)} className="ml-auto rounded-lg bg-destructive/10 p-2 text-destructive"><Trash2 className="h-4 w-4" /></button></div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

export default function BusinessLocationPage() {
  return <MapsProvider><BusinessLocationContent /></MapsProvider>;
}
