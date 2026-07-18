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
  LayoutDashboard, Users, Store, Truck, ClipboardList, BarChart3, Settings,
  MessageSquare, DollarSign, Gift, MapPin, LogOut, ChevronLeft, Search,
  Sparkles, Shield, Activity, Globe, X, Package, PlusCircle, FileText, LifeBuoy, Scale,
} from 'lucide-react';

const sidebarItems = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Pedidos', href: '/admin/pedidos', icon: ClipboardList },
  { label: 'Crear Pedido', href: '/admin/pedidos/crear', icon: Package },
  { label: 'Liquidación', href: '/admin/liquidaciones', icon: Scale, featured: true },
  { label: 'Locales', href: '/admin/locales', icon: Store },
  { label: 'Crear Local', href: '/admin/locales/nuevo', icon: PlusCircle },
  { label: 'Repartidores', href: '/admin/repartidores', icon: Truck },
  { label: 'Usuarios', href: '/admin/usuarios', icon: Users },
  { label: 'Solicitudes', href: '/admin/solicitudes', icon: FileText },
  { label: 'Soporte', href: '/admin/soporte', icon: LifeBuoy },
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

  React.useEffect(() => {
    const openMenu = () => {
      window.dispatchEvent(new Event('domiu:close-assistant'));
      setMobileOpen(true);
    };
    const closeMenu = () => setMobileOpen(false);
    window.addEventListener('domiu:open-admin-menu', openMenu);
    window.addEventListener('domiu:close-admin-menu', closeMenu);
    return () => {
      window.removeEventListener('domiu:open-admin-menu', openMenu);
      window.removeEventListener('domiu:close-admin-menu', closeMenu);
    };
  }, []);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('domiu:admin-menu-state', { detail: { open: mobileOpen } }));
    return () => {
      if (mobileOpen) window.dispatchEvent(new CustomEvent('domiu:admin-menu-state', { detail: { open: false } }));
    };
  }, [mobileOpen]);

  React.useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const permissionMap: Record<string, string> = {
    Usuarios: 'users.read',
    Locales: 'business.read',
    'Crear Local': 'business.create',
    Repartidores: 'courier.read',
    Pedidos: 'orders.read',
    Finanzas: 'wallet.read',
    Liquidación: 'wallet.read',
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
  const compact = collapsed && !mobileOpen;

  const sidebar = (
    <aside className={cn(
      'isolate flex h-full w-[min(88vw,20rem)] flex-col border-r border-primary/10 bg-gradient-to-b from-[#1A1D21] via-[#1A1D21] to-[#20242A] shadow-2xl transition-all duration-300 lg:shadow-none',
      compact ? 'lg:w-20' : 'lg:w-64',
    )}>
      <div className={cn('flex h-20 shrink-0 items-center border-b border-primary/10', compact ? 'justify-center px-0' : 'justify-between px-4')}>
        {!compact && <Link href="/admin" className="flex min-w-0 items-center" onClick={() => setMobileOpen(false)} aria-label="DomiU Magdalena Admin"><DomiULogo variant="dark" markClassName="h-10 w-10" /></Link>}
        {compact && <Link href="/admin" className="domiu-brand-glow flex h-11 w-11 items-center justify-center rounded-xl bg-[#2C3138]" aria-label="DomiU Magdalena Admin"><DomiUMark className="h-9 w-9" /></Link>}
        <button onClick={() => setCollapsed(!collapsed)} className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary lg:flex" aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}><ChevronLeft className={cn('h-4 w-4 transition-transform duration-200', collapsed && 'rotate-180')} /></button>
        <button onClick={() => setMobileOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary lg:hidden" aria-label="Cerrar menú"><X className="h-5 w-5" /></button>
      </div>

      <div className={cn('px-3 pt-3', compact && 'lg:px-2')}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={compact ? '' : 'Buscar opción...'} className={cn('h-11 w-full rounded-xl border border-border bg-[#24282E] text-base text-foreground placeholder:text-muted-foreground transition-all duration-200 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 lg:h-9 lg:text-sm', compact ? 'lg:px-2' : 'pl-10 pr-3')} />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto overscroll-contain p-3 pb-6">
        <p className={cn('mb-2 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/70', compact && 'lg:hidden')}>Menú de administración</p>
        <ul className="space-y-1">{filtered.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return <li key={item.href}><Link href={item.href} onClick={() => setMobileOpen(false)} className={cn(
            'group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
            compact && 'lg:justify-center lg:px-2',
            isActive ? 'border border-primary/25 bg-primary/12 text-primary shadow-sm' : item.featured ? 'border border-primary/15 bg-primary/[0.06] text-white hover:bg-primary/10' : 'text-muted-foreground hover:bg-[#2C3138] hover:text-white',
          )}>
            {isActive && !compact && <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary" />}
            <Icon className={cn('h-[18px] w-[18px] flex-shrink-0 transition-transform duration-200', isActive && 'scale-110')} />
            {!compact && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
            {!compact && item.featured && <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-black uppercase text-primary-foreground">Principal</span>}
            {compact && <span className="absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-dropdown transition-opacity group-hover:opacity-100 lg:block">{item.label}</span>}
          </Link></li>;
        })}</ul>
      </nav>

      <div className="shrink-0 border-t border-primary/10 p-3">
        <div className="mb-3 rounded-xl border border-primary/15 bg-primary/[0.06] p-3"><div className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-primary" />{!compact && <span className="text-xs font-bold text-primary">DomiU Enterprise</span>}</div>{!compact && <p className="mt-0.5 text-[10px] text-muted-foreground">Control operativo y financiero</p>}</div>
        <button onClick={() => void logout()} className={cn('flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive', compact && 'lg:justify-center lg:px-2')}><LogOut className="h-[18px] w-[18px]" />{!compact && <span>Cerrar sesión</span>}</button>
      </div>
    </aside>
  );

  return <>
    {mobileOpen && <button type="button" className="fixed inset-0 z-[1900] bg-black/75 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú lateral" />}
    <div className={cn('fixed inset-y-0 left-0 z-[2000] transition-transform duration-300 ease-out lg:hidden', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>{sidebar}</div>
    <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{sidebar}</div>
  </>;
}
