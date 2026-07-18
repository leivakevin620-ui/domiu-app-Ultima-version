'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { permissionsService } from '@/services/permissions';
import type { Permission } from '@/types/admin';
import { DomiULogo, DomiUMark } from '@/components/brand/DomiULogo';
import {
  LayoutDashboard,
  Users,
  Store,
  Truck,
  ClipboardList,
  BarChart3,
  Settings,
  MessageSquare,
  DollarSign,
  Gift,
  MapPin,
  LogOut,
  ChevronLeft,
  Search,
  Sparkles,
  Shield,
  Activity,
  Globe,
  Menu,
  X,
  Package,
  PlusCircle,
  FileText,
  LifeBuoy,
  ReceiptText,
} from 'lucide-react';

const sidebarItems = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Usuarios', href: '/admin/usuarios', icon: Users },
  { label: 'Locales', href: '/admin/locales', icon: Store },
  { label: 'Crear Local', href: '/admin/locales/nuevo', icon: PlusCircle },
  { label: 'Repartidores', href: '/admin/repartidores', icon: Truck },
  { label: 'Solicitudes', href: '/admin/solicitudes', icon: FileText },
  { label: 'Soporte', href: '/admin/soporte', icon: LifeBuoy },
  { label: 'Pedidos', href: '/admin/pedidos', icon: ClipboardList },
  { label: 'Crear Pedido', href: '/admin/pedidos/crear', icon: Package },
  { label: 'Mapa', href: '/admin/mapa', icon: Globe },
  { label: 'Finanzas', href: '/admin/finanzas', icon: DollarSign },
  { label: 'Liquidaciones', href: '/admin/liquidaciones', icon: ReceiptText },
  { label: 'Cobertura', href: '/admin/cobertura', icon: MapPin },
  { label: 'Promociones', href: '/admin/promociones', icon: Gift },
  { label: 'Reportes', href: '/admin/reportes', icon: BarChart3 },
  { label: 'Reseñas', href: '/admin/resenas', icon: MessageSquare },
  { label: 'Wallets', href: '/admin/wallets', icon: DollarSign },
  { label: 'Auditoría', href: '/admin/auditoria', icon: Shield },
  { label: 'Seguridad', href: '/admin/seguridad', icon: Activity },
  { label: 'Configuración', href: '/admin/configuracion', icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { profile, logout } = useAuth();
  const [collapsed, setCollapsed] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const permissionMap: Record<string, string> = {
    Usuarios: 'users.read',
    Locales: 'business.read',
    'Crear Local': 'business.create',
    Repartidores: 'courier.read',
    Pedidos: 'orders.read',
    Finanzas: 'wallet.read',
    Liquidaciones: 'wallet.read',
    Wallets: 'wallet.read',
    Reportes: 'reports.read',
    Configuración: 'settings.update',
    Auditoría: 'audit.read',
    Seguridad: 'security.read',
    Dashboard: '',
    Cobertura: '',
    Promociones: '',
    Reseñas: '',
  };

  const visibleItems = sidebarItems.filter((item) => {
    const perm = permissionMap[item.label];
    if (!perm) return true;
    if (!profile) return false;
    if (profile.email === 'domiumagdalena@gmail.com') return true;
    return permissionsService.hasPermission(profile.admin_role, perm as Permission, profile.email);
  });

  const filtered = search
    ? visibleItems.filter((item) => item.label.toLowerCase().includes(search.toLowerCase()))
    : visibleItems;

  const sidebar = (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-primary/10 bg-gradient-to-b from-[#1A1D21] via-[#1A1D21] to-[#20242A] transition-all duration-300',
        collapsed ? 'w-20' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex h-20 items-center border-b border-primary/10',
          collapsed ? 'justify-center px-0' : 'justify-between px-4',
        )}
      >
        {!collapsed && (
          <Link
            href="/admin"
            className="flex min-w-0 items-center"
            onClick={() => setMobileOpen(false)}
            aria-label="DomiU Magdalena Admin"
          >
            <DomiULogo variant="dark" markClassName="h-10 w-10" />
          </Link>
        )}
        {collapsed && (
          <Link
            href="/admin"
            className="domiu-brand-glow flex h-11 w-11 items-center justify-center rounded-xl bg-[#2C3138]"
            onClick={() => setMobileOpen(false)}
            aria-label="DomiU Magdalena Admin"
          >
            <DomiUMark className="h-9 w-9" />
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary lg:flex"
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          <ChevronLeft
            className={cn('h-4 w-4 transition-transform duration-200', collapsed && 'rotate-180')}
          />
        </button>
        <button
          onClick={() => setMobileOpen(false)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary lg:hidden"
          aria-label="Cerrar menú"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className={cn('px-3 pt-3', collapsed && 'px-2')}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={collapsed ? '' : 'Buscar menú...'}
            className={cn(
              'h-9 rounded-xl border border-border bg-[#24282E] text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
              collapsed ? 'w-full px-2' : 'w-full pl-9 pr-3',
            )}
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-0.5">
          {filtered.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
                  <Icon
                    className={cn(
                      'h-4.5 w-4.5 flex-shrink-0 transition-transform duration-200',
                      isActive && 'scale-110',
                    )}
                  />
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
        <div className="mb-3 rounded-xl border border-primary/15 bg-primary/[0.06] p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-bold text-primary">DomiU Enterprise</span>
          </div>
          {!collapsed && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Control operativo y seguridad
            </p>
          )}
        </div>
        <button
          onClick={() => logout()}
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive',
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
