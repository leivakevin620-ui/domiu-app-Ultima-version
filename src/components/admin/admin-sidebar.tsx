'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { permissionsService } from '@/services/permissions';
import type { Permission } from '@/types/admin';
import {
  LayoutDashboard, Users, Store, Truck, ClipboardList, BarChart3, Settings,
  MessageSquare, DollarSign, Gift, MapPin, LogOut, ChevronLeft, Search,
  Sparkles, Shield, Activity, Globe, Menu, X,
} from 'lucide-react';

const sidebarItems = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Usuarios', href: '/admin/usuarios', icon: Users },
  { label: 'Negocios', href: '/admin/negocios', icon: Store },
  { label: 'Repartidores', href: '/admin/repartidores', icon: Truck },
  { label: 'Pedidos', href: '/admin/pedidos', icon: ClipboardList },
  { label: 'Mapa', href: '/admin/mapa', icon: Globe },
  { label: 'Finanzas', href: '/admin/finanzas', icon: DollarSign },
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
    'Usuarios': 'users.read',
    'Negocios': 'business.read',
    'Repartidores': 'courier.read',
    'Pedidos': 'orders.read',
    'Finanzas': 'wallet.read',
    'Wallets': 'wallet.read',
    'Reportes': 'reports.read',
    'Configuración': 'settings.update',
    'Auditoría': 'audit.read',
    'Seguridad': 'security.read',
    'Dashboard': '',
    'Cobertura': '',
    'Promociones': '',
    'Reseñas': '',
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
        'flex h-full flex-col border-r border-border bg-gradient-to-b from-card via-card to-background transition-all duration-300',
        collapsed ? 'w-20' : 'w-64',
      )}
    >
      <div className={cn('flex h-16 items-center border-b border-border/50', collapsed ? 'justify-center px-0' : 'justify-between px-5')}>
        {!collapsed && (
          <Link href="/admin" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-md text-primary-foreground text-sm font-bold">
              D
            </div>
            <div>
              <span className="block text-sm font-semibold text-foreground">DomiU</span>
              <span className="block text-[10px] font-medium text-primary/70">Enterprise</span>
            </div>
          </Link>
        )}
        {collapsed && (
          <Link href="/admin" className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-md text-primary-foreground text-sm font-bold" onClick={() => setMobileOpen(false)}>
            D
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

      <div className={cn('px-3 pt-3', collapsed && 'px-2')}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={collapsed ? '' : 'Buscar menú...'}
            className={cn(
              'h-9 rounded-xl border border-border/50 bg-background/50 text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20',
              collapsed ? 'w-full px-2' : 'w-full pl-9 pr-3',
            )}
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-0.5">
          {filtered.map((item) => {
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
                      ? 'bg-gradient-to-r from-primary/10 to-primary/5 text-primary shadow-sm border border-primary/10'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  {isActive && !collapsed && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                  )}
                  <Icon className={cn('h-4.5 w-4.5 flex-shrink-0 transition-transform duration-200', isActive && 'scale-110')} />
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
        <div className="mb-3 rounded-xl bg-gradient-to-br from-primary/5 to-primary/[0.02] border border-primary/10 p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Enterprise v2.0</span>
          </div>
          {!collapsed && <p className="mt-0.5 text-[10px] text-muted-foreground">Panel de administración</p>}
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
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-30 flex lg:hidden h-9 w-9 items-center justify-center rounded-xl bg-background/80 border border-border shadow-sm backdrop-blur-sm text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Abrir menú"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebar}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:block fixed inset-y-0 left-0 z-40">
        {sidebar}
      </div>
    </>
  );
}
