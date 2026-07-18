'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { LogOut, Settings, ChevronRight, Home, Menu } from 'lucide-react';

const breadcrumbMap: Record<string, string> = {
  admin: 'Dashboard',
  usuarios: 'Usuarios',
  negocios: 'Negocios',
  locales: 'Locales',
  repartidores: 'Repartidores',
  pedidos: 'Pedidos',
  liquidaciones: 'Liquidación',
  finanzas: 'Finanzas',
  cobertura: 'Cobertura',
  promociones: 'Promociones',
  reportes: 'Reportes',
  resenas: 'Reseñas',
  wallets: 'Wallets',
  configuracion: 'Configuración',
};

export function AdminHeader() {
  const { user, profile, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const initials = profile
    ? `${profile.first_name?.charAt(0) ?? ''}${profile.last_name?.charAt(0) ?? ''}`
    : 'U';

  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((segment, index) => ({
    label: breadcrumbMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1),
    href: '/' + segments.slice(0, index + 1).join('/'),
    isLast: index === segments.length - 1,
  }));
  const currentTitle = breadcrumbs.at(-1)?.label || 'Administración';

  const openNavigation = () => {
    window.dispatchEvent(new Event('domiu:open-admin-menu'));
  };

  return (
    <header className={cn('sticky top-0 z-30 flex min-h-16 min-w-0 items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-3 py-2 backdrop-blur-xl sm:px-6')}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={openNavigation}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-sm transition hover:bg-primary/15 active:scale-95 lg:hidden"
          aria-label="Abrir menú de opciones"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="min-w-0 flex-1">
          <nav className="hidden min-w-0 items-center gap-1.5 text-sm text-muted-foreground sm:flex">
            <Home className="h-3.5 w-3.5 shrink-0" />
            {breadcrumbs.map((crumb) => (
              <React.Fragment key={crumb.href}>
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                {crumb.isLast ? (
                  <span className="min-w-0 truncate font-medium text-foreground">{crumb.label}</span>
                ) : (
                  <button type="button" onClick={() => router.push(crumb.href)} className="shrink-0 transition-colors hover:text-foreground">
                    {crumb.label}
                  </button>
                )}
              </React.Fragment>
            ))}
          </nav>
          <div className="sm:hidden">
            <p className="truncate text-sm font-black text-foreground">{currentTitle}</p>
            <p className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Panel administrador</p>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <NotificationBell />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 text-sm font-black text-primary ring-1 ring-primary/10 transition-all duration-200 hover:from-primary/20 hover:to-primary/10"
            aria-label="Abrir perfil de administrador"
            aria-expanded={menuOpen}
          >
            {initials}
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-[min(14rem,calc(100vw-1rem))] rounded-2xl border border-border bg-card p-2 shadow-dropdown animate-scale-in">
                <div className="min-w-0 border-b border-border/50 px-3 py-2.5">
                  <p className="truncate text-sm font-medium text-foreground">{profile?.first_name} {profile?.last_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  <span className="mt-1 inline-block rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Administrador</span>
                </div>
                <div className="mt-1 space-y-0.5">
                  <button type="button" onClick={() => { router.push('/admin/configuracion'); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    <Settings className="h-4 w-4" /> Configuración
                  </button>
                  <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                    <LogOut className="h-4 w-4" /> Cerrar sesión
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
