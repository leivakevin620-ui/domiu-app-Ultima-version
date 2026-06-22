'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { LogOut, Settings, ChevronRight, Home } from 'lucide-react';

const breadcrumbMap: Record<string, string> = {
  admin: 'Dashboard',
  usuarios: 'Usuarios',
  negocios: 'Negocios',
  repartidores: 'Repartidores',
  pedidos: 'Pedidos',
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
  const breadcrumbs = segments.map((seg, i) => ({
    label: breadcrumbMap[seg] || seg.charAt(0).toUpperCase() + seg.slice(1),
    href: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl sm:px-6',
      )}
    >
      <div className="flex items-center gap-3">
        <nav className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
          <Home className="h-3.5 w-3.5" />
          {breadcrumbs.map((crumb) => (
            <React.Fragment key={crumb.href}>
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              {crumb.isLast ? (
                <span className="font-medium text-foreground">{crumb.label}</span>
              ) : (
                <button onClick={() => router.push(crumb.href)} className="transition-colors hover:text-foreground">
                  {crumb.label}
                </button>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 text-sm font-medium text-primary transition-all duration-200 hover:from-primary/20 hover:to-primary/10 ring-1 ring-primary/10"
          >
            {initials}
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-dropdown animate-scale-in">
                <div className="border-b border-border/50 px-3 py-2.5">
                  <p className="text-sm font-medium text-foreground">
                    {profile?.first_name} {profile?.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <span className="mt-1 inline-block rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Administrador
                  </span>
                </div>
                <div className="mt-1 space-y-0.5">
                  <button
                    onClick={() => router.push('/admin/configuracion')}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Settings className="h-4 w-4" />
                    Configuración
                  </button>
                  <button
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
