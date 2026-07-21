'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DomiULogo, DomiUMark } from '@/components/brand/DomiULogo';
import {
  LayoutDashboard, Package, PackagePlus, ClipboardList, Users, BarChart3, Settings,
  Star, LogOut, ChevronLeft, Globe, Menu, X, MapPinned, CreditCard,
} from 'lucide-react';

const sidebarItems = [
  { label: 'Dashboard', href: '/negocio', icon: LayoutDashboard },
  { label: 'Productos', href: '/negocio/productos', icon: Package },
  { label: 'Pedidos', href: '/negocio/pedidos', icon: ClipboardList },
  { label: 'Crear pedido manual', href: '/negocio/pedidos/crear', icon: PackagePlus },
  { label: 'Clientes', href: '/negocio/clientes', icon: Users },
  { label: 'Mapa en vivo', href: '/negocio/mapa', icon: Globe },
  { label: 'Locales', href: '/negocio/configuracion/ubicacion', icon: MapPinned },
  { label: 'Métodos de pago', href: '/negocio/configuracion/pagos', icon: CreditCard },
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
        'flex h-full flex-col border-r border-primary/10 bg-gradient-to-b from-[#1A1D21] via-[#1A1D21] to-[#20242A] transition-all duration-300',
        collapsed ? 'w-20' : 'w-64',
      )}
    >
      <div className={cn('flex h-20 items-center border-b border-primary/10', collapsed ? 'justify-center px-0' : 'justify-between px-4')}>
        {!collapsed && (
          <Link href="/negocio" className="min-w-0" onClick={() => setMobileOpen(false)} aria-label="DomiU Magdalena Negocio">
            <DomiULogo variant="dark" markClassName="h-10 w-10" />
          </Link>
        )}
        {collapsed && (
          <Link href="/negocio" className="domiu-brand-glow flex h-11 w-11 items-center justify-center rounded-xl bg-[#2C3138]" onClick={() => setMobileOpen(false)} aria-label="DomiU Magdalena Negocio">
            <DomiUMark className="h-9 w-9" />
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary lg:flex"
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform duration-200', collapsed && 'rotate-180')} />
        </button>
        <button
          onClick={() => setMobileOpen(false)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary lg:hidden"
          aria-label="Cerrar menú"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!collapsed && (
        <div className="border-b border-primary/10 px-4 py-3">
          <p className="truncate text-xs font-bold text-white">{name}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Panel de negocio</p>
        </div>
      )}

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
                      ? 'border border-primary/20 bg-primary/10 text-primary shadow-sm'
                      : 'text-muted-foreground hover:bg-[#2C3138] hover:text-white',
                  )}
                >
                  {isActive && !collapsed && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                  )}
                  <Icon className={cn('h-4.5 w-4.5 flex-shrink-0', isActive && 'scale-110')} />
                  {!collapsed && <span>{item.label}</span>}
                  {collapsed && (
                    <span className="absolute left-full z-50 ml-2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-dropdown transition-opacity group-hover:opacity-100">
                      {item.label}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-primary/10 p-3">
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
        className="fixed left-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-[#1A1D21]/90 text-primary shadow-sm backdrop-blur-sm transition-colors lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm lg:hidden"
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

      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{sidebar}</div>
    </>
  );
}
