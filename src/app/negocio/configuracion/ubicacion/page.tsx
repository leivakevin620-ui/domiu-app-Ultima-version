'use client';

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, LocateFixed, MapPin, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getBrowserClient } from '@/lib/db/supabase';
import { getCurrentExactLocation } from '@/lib/maps/geolocation';
import { SkeletonCard } from '@/components/ui/skeleton';

const PlacesAutocomplete = dynamic(
  () => import('@/components/tracking/maps/PlacesAutocomplete').then((module) => module.PlacesAutocomplete),
  { ssr: false, loading: () => <SkeletonCard /> },
);

type LocationForm = {
  businessId: string;
  addressId: string | null;
  streetAddress: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
};

export default function BusinessLocationPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<LocationForm>({
    businessId: '',
    addressId: null,
    streetAddress: '',
    city: 'Santa Marta',
    state: 'Magdalena',
    country: 'Colombia',
    postalCode: '',
    latitude: null,
    longitude: null,
    accuracy: null,
  });

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

      const { data: address, error: addressError } = await supabase
        .from('business_addresses')
        .select('id,street_address,city,state_province,country,postal_code,latitude,longitude')
        .eq('business_id', business.id)
        .eq('is_primary', true)
        .is('deleted_at', null)
        .maybeSingle();
      if (addressError) throw addressError;

      setForm({
        businessId: business.id,
        addressId: address?.id ?? null,
        streetAddress: address?.street_address ?? '',
        city: address?.city ?? 'Santa Marta',
        state: address?.state_province ?? 'Magdalena',
        country: address?.country ?? 'Colombia',
        postalCode: address?.postal_code ?? '',
        latitude: address?.latitude == null ? null : Number(address.latitude),
        longitude: address?.longitude == null ? null : Number(address.longitude),
        accuracy: null,
      });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo cargar la ubicación');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const useCurrentLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const location = await getCurrentExactLocation();
      setForm((current) => ({
        ...current,
        streetAddress: location.formattedAddress,
        city: location.city,
        state: location.state,
        country: location.country,
        postalCode: location.postalCode,
        latitude: location.lat,
        longitude: location.lng,
        accuracy: location.accuracy,
      }));
      toast.success('Ubicación exacta del local capturada');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo obtener la ubicación');
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    if (!form.businessId || saving) return;
    if (!form.streetAddress.trim() || form.latitude == null || form.longitude == null) {
      toast.error('Selecciona una dirección de Google o comparte la ubicación actual del local');
      return;
    }

    setSaving(true);
    try {
      const supabase = getBrowserClient();
      const payload = {
        business_id: form.businessId,
        street_address: form.streetAddress.trim(),
        city: form.city.trim() || 'Santa Marta',
        state_province: form.state.trim() || 'Magdalena',
        country: form.country.trim() || 'Colombia',
        postal_code: form.postalCode.trim() || null,
        latitude: form.latitude,
        longitude: form.longitude,
        is_primary: true,
        delivery_available: true,
        metadata: {
          location_accuracy_meters: form.accuracy,
          coordinates_source: 'merchant_device_or_google_places',
        },
        updated_at: new Date().toISOString(),
      };

      const query = form.addressId
        ? supabase.from('business_addresses').update(payload).eq('id', form.addressId)
        : supabase.from('business_addresses').insert(payload);
      const { data, error } = await query.select('id').single();
      if (error || !data) throw new Error(error?.message || 'No se pudo guardar la ubicación');

      setForm((current) => ({ ...current, addressId: data.id }));
      toast.success('Ubicación del negocio guardada. Ya se puede calcular el domicilio.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SkeletonCard />;

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <header className="flex items-center gap-3">
        <button type="button" onClick={() => router.back()} className="rounded-xl border p-2"><ArrowLeft className="h-5 w-5" /></button>
        <div><h1 className="text-2xl font-black">Ubicación exacta del negocio</h1><p className="text-sm text-muted-foreground">Se usa para calcular cada domicilio desde el local hasta el cliente.</p></div>
      </header>

      <section className="rounded-3xl border bg-card p-5 shadow-sm">
        <button type="button" onClick={() => void useCurrentLocation()} disabled={locating} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 text-sm font-black text-primary-foreground disabled:opacity-60">
          <LocateFixed className={`h-5 w-5 ${locating ? 'animate-pulse' : ''}`} />
          {locating ? 'Obteniendo ubicación del local…' : 'Compartir ubicación actual del local'}
        </button>

        <div className="relative my-5 text-center text-xs text-muted-foreground before:absolute before:left-0 before:right-0 before:top-1/2 before:border-t"><span className="relative bg-card px-3">o busca la dirección manualmente</span></div>

        <PlacesAutocomplete
          defaultValue={form.streetAddress}
          placeholder="Buscar dirección del negocio"
          onPlaceSelected={(place) => setForm((current) => ({
            ...current,
            streetAddress: place.formattedAddress,
            city: place.city || current.city,
            state: place.state || current.state,
            country: place.country || current.country,
            postalCode: place.postalCode || current.postalCode,
            latitude: place.lat,
            longitude: place.lng,
            accuracy: null,
          }))}
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} placeholder="Ciudad" className="rounded-xl border bg-background px-3 py-2.5 text-sm" />
          <input value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))} placeholder="Departamento" className="rounded-xl border bg-background px-3 py-2.5 text-sm" />
        </div>

        <div className={`mt-4 rounded-xl p-4 ${form.latitude != null ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
          <div className="flex gap-2"><MapPin className="h-5 w-5" /><div><p className="text-sm font-black">{form.latitude != null ? 'Coordenadas listas' : 'Falta ubicación exacta'}</p><p className="mt-1 text-xs">{form.streetAddress || 'Comparte o busca la dirección del local'}</p>{form.latitude != null && <p className="mt-1 text-[11px]">{form.latitude.toFixed(6)}, {form.longitude?.toFixed(6)}</p>}</div></div>
        </div>

        <button type="button" onClick={() => void save()} disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Guardando…' : 'Guardar ubicación permanentemente'}</button>
      </section>
    </main>
  );
}
