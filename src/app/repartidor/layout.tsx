'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

import { useRouter } from 'next/navigation';
import { BottomNavigation } from '@/components/ui/bottom-navigation';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Home, ClipboardList, DollarSign, User, Bike, Navigation } from 'lucide-react';

const navItems = [
  { label: 'Inicio', href: '/repartidor', icon: <Home className="h-5 w-5" /> },
  { label: 'Pedidos', href: '/repartidor/pedidos', icon: <ClipboardList className="h-5 w-5" /> },
  { label: 'Mapa', href: '/repartidor/mapa', icon: <Navigation className="h-5 w-5" /> },
  { label: 'Ganancias', href: '/repartidor/ganancias', icon: <DollarSign className="h-5 w-5" /> },
  { label: 'Perfil', href: '/repartidor/perfil', icon: <User className="h-5 w-5" /> },
];

export default function RepartidorLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, profile } = useAuth();
  const router = useRouter();

  if (isLoading) return <SkeletonCard />;
  if (!profile) { router.push('/login'); return null; }
  if (profile.role !== 'courier') { router.push('/?error=unauthorized'); return null; }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background/95 pb-20 lg:pb-0">
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-warning to-orange-500 shadow-lg shadow-warning/20">
              <Bike className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">DomiU Courier</h1>
              <p className="text-[10px] text-muted-foreground">Repartidor Pro</p>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-4">{children}</main>
      <BottomNavigation items={navItems} />
    </div>
  );
}
