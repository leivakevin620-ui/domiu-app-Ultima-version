'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle, Eye, EyeOff, LocateFixed, Lock, Mail, MapPin, User } from 'lucide-react';
import { getCurrentExactLocation, type ExactLocation } from '@/lib/maps/geolocation';
import { selfRegisterWithLocationAction } from '@/app/actions/public-registration';
import { SkeletonCard } from '@/components/ui/skeleton';

const PlacesAutocomplete = dynamic(
  () => import('@/components/tracking/maps/PlacesAutocomplete').then((module) => module.PlacesAutocomplete),
  { ssr: false, loading: () => <SkeletonCard /> },
);

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [location, setLocation] = useState<ExactLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const shareLocation = async () => {
    if (locating) return;
    setLocating(true);
    setError('');
    try {
      setLocation(await getCurrentExactLocation());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo obtener la ubicación');
    } finally {
      setLocating(false);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) return setError('Completa todos los datos personales.');
    if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
    if (form.password !== confirmPassword) return setError('Las contraseñas no coinciden.');
    if (!acceptTerms) return setError('Debes aceptar los términos y la política de privacidad.');

    setLoading(true);
    try {
      await selfRegisterWithLocationAction({
        ...form,
        email: form.email.trim().toLowerCase(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        location: location
          ? {
              streetAddress: location.formattedAddress,
              city: location.city,
              state: location.state,
              country: location.country,
              postalCode: location.postalCode,
              latitude: location.lat,
              longitude: location.lng,
              accuracy: location.accuracy,
            }
          : undefined,
      });
      setSuccess(true);
      window.setTimeout(() => router.push('/login'), 1600);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <section className="max-w-md text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-success" />
          <h1 className="mt-4 text-2xl font-black">Cuenta creada</h1>
          <p className="mt-2 text-sm text-muted-foreground">Tu información quedó guardada. Abriendo el inicio de sesión…</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 px-4 py-10">
      <form onSubmit={submit} className="mx-auto w-full max-w-2xl space-y-5 rounded-[2rem] border bg-card p-6 shadow-xl sm:p-8">
        <header>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-xl font-black text-primary-foreground">D</div>
          <h1 className="mt-4 text-3xl font-black">Crear cuenta en DomiU</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tu ubicación permite calcular domicilios exactos y seguir tus pedidos.</p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5"><span className="text-sm font-semibold">Nombre</span><div className="relative"><User className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input required value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} className="h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-sm" /></div></label>
          <label className="space-y-1.5"><span className="text-sm font-semibold">Apellido</span><div className="relative"><User className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input required value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} className="h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-sm" /></div></label>
          <label className="space-y-1.5 sm:col-span-2"><span className="text-sm font-semibold">Correo</span><div className="relative"><Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input type="email" required value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-sm" /></div></label>
          <label className="space-y-1.5"><span className="text-sm font-semibold">Contraseña</span><div className="relative"><Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input type={showPassword ? 'text' : 'password'} required value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="h-11 w-full rounded-xl border bg-background pl-10 pr-10 text-sm" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-3 text-muted-foreground">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></label>
          <label className="space-y-1.5"><span className="text-sm font-semibold">Confirmar contraseña</span><div className="relative"><Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input type={showPassword ? 'text' : 'password'} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-sm" /></div></label>
        </section>

        <section className="rounded-2xl border bg-muted/30 p-4">
          <h2 className="font-black">Ubicación de entrega</h2>
          <p className="mt-1 text-xs text-muted-foreground">Puedes compartir la ubicación del dispositivo o buscar tu dirección manualmente.</p>
          <button type="button" onClick={() => void shareLocation()} disabled={locating} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground disabled:opacity-60"><LocateFixed className={`h-4 w-4 ${locating ? 'animate-pulse' : ''}`} />{locating ? 'Obteniendo ubicación…' : 'Compartir mi ubicación actual'}</button>
          <div className="relative my-4 text-center text-xs text-muted-foreground before:absolute before:left-0 before:right-0 before:top-1/2 before:border-t"><span className="relative bg-muted px-3">o buscar manualmente</span></div>
          <PlacesAutocomplete
            defaultValue={location?.formattedAddress || ''}
            placeholder="Busca tu dirección en Google"
            onPlaceSelected={(place) => setLocation({
              lat: place.lat,
              lng: place.lng,
              accuracy: 0,
              formattedAddress: place.formattedAddress,
              city: place.city || 'Santa Marta',
              state: place.state || 'Magdalena',
              country: place.country || 'Colombia',
              postalCode: place.postalCode || '',
            })}
          />
          <div className={`mt-3 flex gap-2 rounded-xl p-3 text-xs font-semibold ${location ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}><MapPin className="h-4 w-4 shrink-0" /><span>{location ? `${location.formattedAddress} · Coordenadas guardadas` : 'Puedes continuar, pero necesitarás guardar una ubicación exacta antes de hacer pedidos.'}</span></div>
        </section>

        <label className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} className="mt-0.5" /><span>Acepto los <Link href="/terminos" className="font-semibold text-primary">Términos</Link> y la <Link href="/privacidad" className="font-semibold text-primary">Política de privacidad</Link>.</span></label>

        {error && <p className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-xl bg-slate-950 py-3.5 text-sm font-black text-white disabled:opacity-60">{loading ? 'Creando cuenta…' : 'Crear cuenta'}</button>
        <p className="text-center text-sm text-muted-foreground">¿Ya tienes cuenta? <Link href="/login" className="font-bold text-primary">Inicia sesión</Link></p>
      </form>
    </main>
  );
}
