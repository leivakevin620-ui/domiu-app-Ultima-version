'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LoginCredentials, getDashboardPathForRole } from '@/types/auth';
import { logger } from '@/lib/logger';
import { DomiULogo, DomiUMark } from '@/components/brand/DomiULogo';
import { ArrowRight, Eye, EyeOff, Lock, Mail, MapPin, Store, Bike } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, isAuthenticated, profile, error: authError } = useAuth();
  const [formData, setFormData] = useState<LoginCredentials>({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && profile?.role) {
      const path = getDashboardPathForRole(profile.role);
      logger.debug('[LoginPage] already authenticated, redirecting', { role: profile.role, path });
      router.replace(path);
    }
  }, [isAuthenticated, profile, router]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    if (formError) setFormError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!formData.email) return setFormError('Ingresa tu correo electrónico');
    if (!formData.password) return setFormError('Ingresa tu contraseña');
    try {
      const sessionProfile = await login(formData);
      router.replace(getDashboardPathForRole(sessionProfile.role));
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const displayError = formError || authError;

  return (
    <main className="min-h-[100dvh] bg-[#F7F8FA] text-[#17191F] [--background:#F7F8FA] [--foreground:#17191F] [--primary:#FFD400] [--primary-foreground:#17191F] [--muted:#EEF0F3] [--muted-foreground:#68707D] [--border:#DDE1E7]">
      <header className="flex h-20 items-center justify-center border-b border-[#E5E8ED] bg-white px-5 shadow-sm">
        <Link href="/" aria-label="Volver al inicio"><DomiULogo showTagline /></Link>
      </header>

      <div className="grid min-h-[calc(100dvh-5rem)] lg:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#FFF5B8] via-[#FFD400] to-[#ECAF00] p-12 lg:flex lg:items-center lg:justify-center">
          <div className="absolute -left-28 -top-28 h-96 w-96 rounded-full border-[48px] border-white/20" />
          <div className="absolute -bottom-36 -right-28 h-[32rem] w-[32rem] rounded-full border-[72px] border-black/5" />
          <div className="relative max-w-lg">
            <DomiUMark className="h-28 w-40" />
            <p className="mt-8 text-xs font-black uppercase tracking-[0.2em] text-[#6A5500]">DomiU Magdalena</p>
            <h1 className="mt-3 text-5xl font-black leading-[1.02] tracking-[-0.045em]">Tu ciudad y sus comercios en un solo lugar.</h1>
            <p className="mt-5 max-w-md text-base font-semibold leading-relaxed text-[#554B2D]">Compra local, sigue tu pedido y recibe una entrega organizada desde la misma plataforma.</p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[{ icon: Store, label: 'Comercios' }, { icon: Bike, label: 'Reparto' }, { icon: MapPin, label: 'Ubicación' }].map(({ icon: Icon, label }) => (
                <div key={label} className="rounded-2xl border border-white/50 bg-white/60 p-4 text-center backdrop-blur-sm">
                  <Icon className="mx-auto h-5 w-5 text-[#725B00]" /><p className="mt-2 text-xs font-black">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-md rounded-[2rem] border border-[#E3E6EB] bg-white p-7 shadow-[0_24px_70px_-40px_rgba(16,24,40,.35)] sm:p-9">
            <div className="mb-7 lg:hidden"><DomiUMark className="h-20 w-28" /></div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#927200]">Acceso seguro</p>
            <h2 className="mt-2 text-3xl font-black">Iniciar sesión</h2>
            <p className="mt-2 text-sm font-medium text-[#68707D]">¿No tienes cuenta? <Link href="/register" className="font-black text-[#806500] hover:underline">Regístrate gratis</Link></p>

            {displayError && <p className="mt-6 rounded-xl border border-[#F7B4AE] bg-[#FFF1F0] p-3 text-sm font-semibold text-[#B42318]">{displayError}</p>}

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-black">Correo electrónico</span>
                <span className="relative block"><Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#89909A]" /><input name="email" type="email" autoComplete="email" required value={formData.email} onChange={handleChange} placeholder="tu@email.com" className="h-12 w-full rounded-xl border border-[#DDE1E7] bg-[#F8F9FA] pl-12 pr-4 text-sm font-semibold outline-none focus:border-[#FFD400] focus:bg-white focus:ring-2 focus:ring-[#FFD400]/20" /></span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black">Contraseña</span>
                <span className="relative block"><Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#89909A]" /><input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={formData.password} onChange={handleChange} placeholder="••••••••" className="h-12 w-full rounded-xl border border-[#DDE1E7] bg-[#F8F9FA] pl-12 pr-12 text-sm font-semibold outline-none focus:border-[#FFD400] focus:bg-white focus:ring-2 focus:ring-[#FFD400]/20" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7C838D]" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></span>
              </label>
              <div className="flex items-center justify-between gap-4 text-xs"><label className="flex items-center gap-2 font-semibold text-[#68707D]"><input type="checkbox" defaultChecked className="accent-[#D8AB00]" /> Recordarme</label><Link href="/forgot-password" className="font-black text-[#806500] hover:underline">¿Olvidaste tu contraseña?</Link></div>
              <button type="submit" disabled={isLoading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FFD400] text-sm font-black shadow-lg shadow-[#FFD400]/25 disabled:opacity-50">{isLoading ? 'Iniciando sesión…' : <>Iniciar sesión <ArrowRight className="h-4 w-4" /></>}</button>
            </form>

            <p className="mt-7 text-center text-xs font-medium text-[#7A818C]">Al continuar aceptas nuestros <Link href="/terminos" className="font-bold text-[#806500]">Términos</Link> y <Link href="/privacidad" className="font-bold text-[#806500]">Política de privacidad</Link>.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
