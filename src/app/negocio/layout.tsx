'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/ui/app-sidebar';
import { AppHeader } from '@/components/ui/app-header';
import { LoadingState } from '@/components/ui/loading-state';
import { LayoutDashboard, Package, ClipboardList, Users, BarChart3, Settings } from 'lucide-react';

const sidebarItems = [
  { label: 'Dashboard', href: '/negocio', icon: <LayoutDashboard className="h-4.5 w-4.5" /> },
  { label: 'Productos', href: '/negocio/productos', icon: <Package className="h-4.5 w-4.5" /> },
  { label: 'Pedidos', href: '/negocio/pedidos', icon: <ClipboardList className="h-4.5 w-4.5" /> },
  { label: 'Clientes', href: '/negocio/clientes', icon: <Users className="h-4.5 w-4.5" /> },
  { label: 'Reportes', href: '/negocio/reportes', icon: <BarChart3 className="h-4.5 w-4.5" /> },
  { label: 'Configuración', href: '/negocio/configuracion', icon: <Settings className="h-4.5 w-4.5" /> },
];

export default function NegocioLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, profile } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return <LoadingState />;
  }

  if (!profile) {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar items={sidebarItems} title="Mi Negocio" />
      <div className="lg:pl-64">
        <AppHeader title="Mi Negocio" />
        <main>{children}</main>
      </div>
    </div>
  );
}
