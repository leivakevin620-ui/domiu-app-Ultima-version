'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DomiUBrandLockup, DomiUMark } from '@/components/brand/DomiULogo';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  PackagePlus,
  Users,
  BarChart3,
  Settings,
  Star,
  LogOut,
  ChevronLeft,
  Globe,
  Menu,
  X,
  MapPinned,
  CreditCard,
} from 'lucide-react';

const sidebarItems = [
  { label: 'Dashboard', href: '/negocio', icon: LayoutDashboard },
  { label: 'Pedidos', href: '/negocio/pedidos', icon: ClipboardList },
  { label: 'Crear domicilio', href: '/negocio/pedidos/crear', icon: PackagePlus, featured: true },
  { label: 'Productos', href: '/negocio/productos', icon: Package },
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

  const name = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Mi Negocio'
    : 'Mi Negocio';

  const compact = collapsed && !mobileOpen;

  const sidebar = (
    <aside
      className={cn(
        'flex h-full w-[min(88vw,20rem)] flex-col border-r border-white/10 bg-gradient-to-b from-[#111419] via-[#15191f] to-[#0d1014] text-white shadow-2xl transition-all duration-300 lg:shadow-none',
        compact ? 'lg:w-20' : 'lg:w-64',
      )}
    >
      <div
        className={cn(
          'flex h-20 shrink-0 items-center border-b border-white/10',
          compact ? 'justify-center px-0' : 'justify-between px-4',
        )}
      >
        {!compact && (
          <Link
            href="/negocio"
            className="min-w-0"
            onClick={() => setMobileOpen(false)}
            aria-label="DomiU Magdalena Negocio"
          >
            <DomiUBrandLockup />
          </Link>
        )}
        {compact && (
          <Link
            href="/negocio"
            className="domiu-brand-glow flex h-11 w-11 items-center justify-center rounded-xl bg-[#232831]"
            onClick={() => setMobileOpen(false)}
            aria-label="DomiU Magdalena Negocio"
          >
            <DomiUMark className="h-9" />
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-[#FFC400] lg:flex"
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform duration-200', collapsed && 'rotate-180')} />
        </button>
        <button
          onClick={() => setMobileOpen(false)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-slate-300 transition-colors hover:bg-white/10 hover:text-[#FFC400] lg:hidden"
          aria-label="Cerrar menú"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      {!compact && (
        <div className="border-b border-white/10 px-4 py-3">
          <p className="truncate text-sm font-bold text-white">{name}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#FFC400]">
            Panel de negocio
          </p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto overscroll-contain p-3 pb-6">
        <ul className="space-y-1">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
                    compact && 'lg:justify-center lg:px-2',
                    isActive
                      ? 'border border-[#FFC400]/30 bg-[#FFC400]/12 text-[#FFD34D] shadow-sm'
                      : item.featured
                        ? 'border border-[#FFC400]/20 bg-[#FFC400]/[0.07] text-white hover:bg-[#FFC400]/12'
                        : 'text-slate-300 hover:bg-white/[0.07] hover:text-white',
                  )}
                >
                  {isActive && !compact && (
                    <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-[#FFC400]" />
                  )}
                  <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive && 'scale-110')} />
                  {!compact && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                  {!compact && item.featured && (
                    <span className="rounded-full bg-[#FFC400] px-2 py-0.5 text-[9px] font-black uppercase text-[#111419]">
                      Nuevo
                    </span>
                  )}
                  {compact && (
                    <span className="absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md bg-[#20252c] px-2 py-1 text-xs text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 lg:block">
                      {item.label}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        {!compact && (
          <div className="mb-3 rounded-xl border border-[#FFC400]/20 bg-[#FFC400]/[0.07] p-3">
            <p className="text-xs font-bold text-[#FFD34D]">Operación conectada</p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
              Pedidos, clientes y domicilios desde un solo lugar.
            </p>
          </div>
        )}
        <button
          onClick={() => void logout()}
          className={cn(
            'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-all duration-200 hover:bg-red-500/10 hover:text-red-300',
            compact && 'lg:justify-center lg:px-2',
          )}
        >
          <LogOut className="h-[18px] w-[18px]" />
          {!compact && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white/95 text-[#9b7200] shadow-lg backdrop-blur-sm transition-colors hover:bg-[#fff8dd] lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú lateral"
        />
      )}

      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-out lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebar}
      </div>

      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{sidebar}</div>
    </>
  );
}
