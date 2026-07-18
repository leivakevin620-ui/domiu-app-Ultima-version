'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useCourier } from '@/contexts/CourierContext';
import { useRouter, usePathname } from 'next/navigation';

import { LogOut, Settings, ChevronRight, Home, Bell } from 'lucide-react';

const breadcrumbMap: Record<string, string> = {
  repartidor: 'Dashboard',
  perfil: 'Mi perfil',
  pedidos: 'Pedidos',
  mapa: 'Mapa y rutas',
  ganancias: 'Ganancias',
  chat: 'Chat',
  notificaciones: 'Notificaciones',
  configuracion: 'Configuración',
};

const STATUS_DOT: Record<string, string> = {
  available: 'bg-success',
  busy: 'bg-warning',
  offline: 'bg-muted-foreground',
  on_break: 'bg-info',
};

export function CourierTopbar() {
  const { profile, logout } = useAuth();
  const { courierStatus } = useCourier();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
    router.refresh();
  };

  const initials = profile
    ? `${profile.first_name?.charAt(0) ?? ''}${profile.last_name?.charAt(0) ?? ''}`
    : 'R';

  const statusKey = courierStatus || 'offline';
  const statusDot = STATUS_DOT[statusKey] || STATUS_DOT.offline;

  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    label: breadcrumbMap[seg] || seg.charAt(0).toUpperCase() + seg.slice(1),
    href: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));

  return (
    <header className="sticky top-0 z-30 flex min-h-16 min-w-0 items-center justify-between gap-2 border-b border-border/50 bg-background/90 px-3 py-2 backdrop-blur-xl sm:px-6">
      <div className="min-w-0 flex-1">
        <nav className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          <Home className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
          {breadcrumbs.map((crumb) => (
            <React.Fragment key={crumb.href}>
              <ChevronRight className="hidden h-3 w-3 shrink-0 text-muted-foreground/50 sm:block" />
              {crumb.isLast ? (
                <span className="min-w-0 truncate text-sm font-medium text-foreground sm:text-base">{crumb.label}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push(crumb.href)}
                  className="hidden shrink-0 text-xs transition-colors hover:text-foreground sm:block"
                >
                  {crumb.label}
                </button>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <a
          href="/repartidor/notificaciones"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notificaciones"
        >
          <Bell className="h-[18px] w-[18px]" />
        </a>

        <a
          href="/repartidor/configuracion"
          className="hidden h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground min-[360px]:flex"
          aria-label="Configuración"
        >
          <Settings className="h-[18px] w-[18px]" />
        </a>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-warning/10 to-orange-500/5 text-sm font-medium text-warning ring-1 ring-warning/10 transition-all duration-200 hover:from-warning/20 hover:to-orange-500/10"
            aria-label="Abrir menú de usuario"
            aria-expanded={menuOpen}
          >
            {initials}
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-[min(14rem,calc(100vw-1rem))] rounded-2xl border border-border bg-card p-2 shadow-dropdown animate-scale-in">
                <div className="min-w-0 border-b border-border/50 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', statusDot)} />
                    <p className="min-w-0 truncate text-sm font-medium text-foreground">
                      {profile?.first_name} {profile?.last_name}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{profile?.email}</p>
                </div>
                <div className="mt-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => { router.push('/repartidor/configuracion'); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Settings className="h-4 w-4" />
                    Configuración
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
