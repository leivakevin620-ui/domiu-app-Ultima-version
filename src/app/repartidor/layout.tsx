'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { BottomNavigation } from '@/components/ui/bottom-navigation';
import { AppHeader } from '@/components/ui/app-header';
import { LoadingState } from '@/components/ui/loading-state';
import { Home, ClipboardList, DollarSign, User } from 'lucide-react';

const navItems = [
  { label: 'Inicio', href: '/repartidor', icon: <Home className="h-5 w-5" /> },
  { label: 'Pedidos', href: '/repartidor/pedidos', icon: <ClipboardList className="h-5 w-5" /> },
  { label: 'Ganancias', href: '/repartidor/ganancias', icon: <DollarSign className="h-5 w-5" /> },
  { label: 'Perfil', href: '/repartidor/perfil', icon: <User className="h-5 w-5" /> },
];

export default function RepartidorLayout({ children }: { children: React.ReactNode }) {
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
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      <AppHeader title="Repartidor" />
      <main>{children}</main>
      <BottomNavigation items={navItems} />
    </div>
  );
}
