'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Package, ClipboardList, Users, BarChart3, Settings,
  Star, LogOut, ChevronLeft, Store, Globe, Menu, X, MapPin,
} from 'lucide-react';

const sidebarItems = [
  { label: 'Dashboard', href: '/negocio', icon: LayoutDashboard },
  { label: 'Productos', href: '/negocio/productos', icon: Package },
  { label: 'Pedidos', href: '/negocio/pedidos', icon: ClipboardList },
  { label: 'Clientes', href: '/negocio/clientes', icon: Users },
  { label: 'Mapa en vivo', href: '/negocio/mapa', icon: Globe },
  { label: 'Ubicación del local', href: '/negocio/configuracion/ubicacion', icon: MapPin },
  { label: 'Reportes', href: '/negocio/reportes', icon: BarChart3 },
  { label: 'Reseñas', href: '/negocio/resenas', icon: Star },
  { label: 'Configuración', href: '/negocio/configuracion', icon: Settings },
];

export function BusinessSidebar() {
  const pathname = usePathname();
  const { profile, logout } = useAuth();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const name = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Mi Negocio' : 'Mi Negocio';

  const sidebar = (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-gradient-to-b from-card via-card to-background transition-all duration-300',
        collapsed ? 'w-20' : 'w-64',
      )}
    >
      <div className={cn('flex h-16 items-center border-b border-border/50', collapsed ? 'justify-center px-0' : 'justify-between px-5')}>
        {!collapsed && (
          <Link href="/negocio" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-warning to-warning/70 shadow-md text-warning-foreground text-sm font-bold">
              <Store className="h-4 w-4" />
            </div>
            <div>
              <span className="block text-sm font-semibold text-foreground leading-tight">{name}</span>
              <span className="block text-[10px] font-medium text-warning/70">Business Enterprise</span>
            </div>
          </Link>
        )}
        {collapsed && (
          <Link href="/negocio" className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-warning to-warning/70 shadow-md text-warning-foreground" onClick={() => setMobileOpen(false)}>
            <Store className="h-4 w-4" />
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform duration-200', collapsed && 'rotate-180')} />
        </button>
        <button
          onClick={() => setMobileOpen(false)}
          className="flex lg:hidden h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Cerrar menú"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-0.5">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    collapsed && 'justify-center px-2',
                    isActive
                      ? 'bg-gradient-to-r from-warning/10 to-warning/5 text-warning shadow-sm border border-warning/10'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  {isActive && !collapsed && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-warning" />
                  )}
                  <Icon className={cn('h-4.5 w-4.5 flex-shrink-0', isActive && 'scale-110')} />
                  {!collapsed && <span>{item.label}</span>}
                  {collapsed && (
                    <span className="absolute left-full ml-2 rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-dropdown transition-opacity group-hover:opacity-100 whitespace-nowrap z-50">
                      {item.label}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border/50 p-3">
        <button
          onClick={() => logout()}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive',
            collapsed && 'justify-center px-2',
          )}
        >
          <LogOut className="h-4.5 w-4.5" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-30 flex lg:hidden h-9 w-9 items-center justify-center rounded-xl bg-background/80 border border-border shadow-sm backdrop-blur-sm text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Abrir menú"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebar}
      </div>

      <div className="hidden lg:block fixed inset-y-0 left-0 z-40">
        {sidebar}
      </div>
    </>
  );
}
