'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LoginCredentials, getDashboardPathForRole } from '@/types/auth';
import { logger } from '@/lib/logger';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldAlert } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, isAuthenticated, profile, error: authError } = useAuth();

  useEffect(() => {
    if (isAuthenticated && profile?.role) {
      const path = getDashboardPathForRole(profile.role);
      logger.debug('[LoginPage] already authenticated, redirecting', { role: profile.role, path });
      router.replace(path);
    }
  }, [isAuthenticated, profile, router]);

  const [formData, setFormData] = useState<LoginCredentials>({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [recoverDone, setRecoverDone] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formError) setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.email) { setFormError('Ingresa tu email'); return; }
    if (!formData.password) { setFormError('Ingresa tu contraseña'); return; }

    logger.debug('[LoginPage] handleSubmit', { email: formData.email });
    try {
      const profile = await login(formData);
      const path = getDashboardPathForRole(profile.role);
      logger.debug('[LoginPage] login OK', { role: profile.role, redirectTo: path, currentPathname: window.location.pathname });
      await new Promise(r => setTimeout(r, 0));
      router.replace(path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.debug('[LoginPage] login FAIL', { message: msg });
      setFormError(msg);
    }
  };

  const handleRecover = async () => {
    setRecovering(true);
    setRecoverDone(false);
    try {
      const res = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al recuperar');
      setRecoverDone(true);
      const profile = await login(formData);
      const path = getDashboardPathForRole(profile.role);
      router.replace(path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(msg);
    } finally {
      setRecovering(false);
    }
  };

  const displayError = formError || authError;

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary/5 via-background to-primary/5 items-center justify-center p-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--color-primary)_0%,_transparent_60%)] opacity-[0.03]" />
        <div className="relative max-w-lg">
          <div className="mb-8">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">D</div>
          </div>
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-foreground">Bienvenido de vuelta</h1>
          <p className="mb-10 text-lg text-muted-foreground">Inicia sesión para pedir tus platos favoritos, gestionar tu negocio o recibir pedidos.</p>
          <div className="space-y-3">
            <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-lg">🍕</div>
              <div><p className="text-sm font-medium text-foreground">Miles de restaurantes</p><p className="text-xs text-muted-foreground">Comida de verdad, de restaurantes reales en Santa Marta</p></div>
            </div>
            <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-info/10 text-lg">⚡</div>
              <div><p className="text-sm font-medium text-foreground">Entrega en minutos</p><p className="text-xs text-muted-foreground">Seguimiento en tiempo real de tu pedido</p></div>
            </div>
            <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-lg">💳</div>
              <div><p className="text-sm font-medium text-foreground">Pago seguro</p><p className="text-xs text-muted-foreground">Múltiples métodos de pago protegidos</p></div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground">D</div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ¿No tienes cuenta?{' '}
              <Link href="/register" className="font-medium text-primary hover:underline">Regístrate gratis</Link>
            </p>
          </div>

          {displayError && (
            <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
              <p className="text-sm font-medium text-destructive">{displayError}</p>
              {displayError === 'Credenciales incorrectas' && !recoverDone && (
                <button
                  type="button"
                  disabled={recovering || isLoading}
                  onClick={handleRecover}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                >
                  {recovering ? (
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" />
                      Recuperando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Recuperar acceso automáticamente
                    </span>
                  )}
                </button>
              )}
              {recoverDone && (
                <p className="mt-2 text-xs font-medium text-success">Cuenta recuperada. Iniciando sesión...</p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input id="email" name="email" type="email" autoComplete="email" required
                  value={formData.email} onChange={handleChange} placeholder="tu@email.com"
                  className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-all" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required
                  value={formData.password} onChange={handleChange} placeholder="••••••••"
                  className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground transition-all" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-border text-primary" />
                <span className="text-xs text-muted-foreground">Recordarme</span>
              </label>
              <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">¿Olvidaste tu contraseña?</Link>
            </div>

            <button type="submit" disabled={isLoading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-50">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Iniciando sesión...
                </span>
              ) : (
                <span className="flex items-center gap-2">Iniciar sesión <ArrowRight className="h-4 w-4" /></span>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-xs text-muted-foreground">
              Al iniciar sesión aceptas nuestros{' '}
              <Link href="/terminos" className="text-primary hover:underline">Términos</Link> y{' '}
              <Link href="/privacidad" className="text-primary hover:underline">Política de Privacidad</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
