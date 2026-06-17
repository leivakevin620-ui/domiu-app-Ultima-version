'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LoginCredentials } from '@/types/auth';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ChevronRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error: authError } = useAuth();

  const [formData, setFormData] = useState<LoginCredentials>({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

    try {
      await login(formData);
      const role = await new Promise<string>((resolve) => {
        const check = setInterval(() => {
          const r = document.cookie.includes('sb-') ? null : null;
          const el = document.getElementById('__NEXT_DATA__');
          clearInterval(check);
          resolve('customer');
        }, 100);
        setTimeout(() => resolve('customer'), 2000);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Credenciales inválidas';
      setFormError(msg);
    }
  };

  const displayError = formError || authError;

  const roleCards = [
    { role: 'customer' as const, label: 'Cliente', desc: 'Pide comida rápido', bg: 'from-primary/5 to-primary/0', border: 'border-primary/10' },
    { role: 'merchant' as const, label: 'Negocio', desc: 'Gestiona tu restaurante', bg: 'from-warning/5 to-warning/0', border: 'border-warning/10' },
    { role: 'courier' as const, label: 'Repartidor', desc: 'Gana dinero deliveries', bg: 'from-info/5 to-info/0', border: 'border-info/10' },
  ];

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary/5 via-background to-primary/5 items-center justify-center p-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--color-primary)_0%,_transparent_60%)] opacity-[0.03]" />
        <div className="relative max-w-lg">
          <div className="mb-8">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
              D
            </div>
          </div>
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-foreground">
            Bienvenido de vuelta
          </h1>
          <p className="mb-10 text-lg text-muted-foreground">
            Inicia sesión para pedir tus platos favoritos, gestionar tu negocio o recibir pedidos.
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-lg">🍕</div>
              <div>
                <p className="text-sm font-medium text-foreground">Miles de restaurantes</p>
                <p className="text-xs text-muted-foreground">Comida de verdad, de restaurantes reales en Santa Marta</p>
              </div>
            </div>
            <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-info/10 text-lg">⚡</div>
              <div>
                <p className="text-sm font-medium text-foreground">Entrega en minutos</p>
                <p className="text-xs text-muted-foreground">Seguimiento en tiempo real de tu pedido</p>
              </div>
            </div>
            <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-lg">💳</div>
              <div>
                <p className="text-sm font-medium text-foreground">Pago seguro</p>
                <p className="text-xs text-muted-foreground">Múltiples métodos de pago protegidos</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground">
              D
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ¿No tienes cuenta?{' '}
              <Link href="/register" className="font-medium text-primary hover:underline">
                Regístrate gratis
              </Link>
            </p>
          </div>

          {displayError && (
            <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
              <p className="text-sm font-medium text-destructive">{displayError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="tu@email.com"
                  className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20" />
                <span className="text-xs text-muted-foreground">Recordarme</span>
              </label>
              <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Iniciando sesión...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Iniciar sesión <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </button>
          </form>

          <div className="mt-8">
            <p className="mb-3 text-center text-xs text-muted-foreground">Acceso rápido como:</p>
            <div className="grid grid-cols-3 gap-2">
              {roleCards.map((role) => (
                <button
                  key={role.role}
                  type="button"
                  onClick={() => {
                    const email = role.role === 'customer' ? 'leivakevin620@gmail.com' : role.role === 'merchant' ? 'carlos@cevicheria.com' : 'carlos.mendoza@courier.com';
                    setFormData({ email, password: 'demo1234' });
                    setFormError(null);
                  }}
                  className={`rounded-xl border ${role.border} ${role.bg} bg-card p-3 text-center transition-all hover:shadow-sm hover:-translate-y-0.5`}
                >
                  <p className="text-xs font-medium text-foreground">{role.label}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{role.desc}</p>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-center text-muted-foreground">
              Rellena credenciales demo automáticamente
            </p>
          </div>

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
