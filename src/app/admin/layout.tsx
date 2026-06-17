'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/ui/app-sidebar';
import { AppHeader } from '@/components/ui/app-header';
import { LoadingState } from '@/components/ui/loading-state';
import {
  LayoutDashboard,
  Users,
  Store,
  Truck,
  ClipboardList,
  BarChart3,
  Settings,
} from 'lucide-react';

const sidebarItems = [
  { label: 'Dashboard', href: '/admin', icon: <LayoutDashboard className="h-4.5 w-4.5" /> },
  { label: 'Usuarios', href: '/admin/usuarios', icon: <Users className="h-4.5 w-4.5" /> },
  { label: 'Negocios', href: '/admin/negocios', icon: <Store className="h-4.5 w-4.5" /> },
  { label: 'Repartidores', href: '/admin/repartidores', icon: <Truck className="h-4.5 w-4.5" /> },
  { label: 'Pedidos', href: '/admin/pedidos', icon: <ClipboardList className="h-4.5 w-4.5" /> },
  { label: 'Reportes', href: '/admin/reportes', icon: <BarChart3 className="h-4.5 w-4.5" /> },
  { label: 'Configuración', href: '/admin/configuracion', icon: <Settings className="h-4.5 w-4.5" /> },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, profile } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return <LoadingState />;
  }

  if (!profile) {
    router.push('/login');
    return null;
  }

  if (profile.role !== 'admin') {
    const roleRoutes: Record<string, string> = {
      merchant: '/negocio',
      courier: '/repartidor',
      customer: '/cliente',
    };
    router.push(roleRoutes[profile.role] || '/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar items={sidebarItems} title="Admin DomiU" />
      <div className="lg:pl-64">
        <AppHeader title="Panel de Administración" />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
