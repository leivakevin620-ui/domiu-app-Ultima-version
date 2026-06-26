'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

import { useRouter } from 'next/navigation';
import { BottomNavigation } from '@/components/ui/bottom-navigation';
import { SkeletonCard } from '@/components/ui/skeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CourierProvider } from '@/contexts/CourierContext';
import { Home, ClipboardList, DollarSign, User, Bike, Navigation, LogOut } from 'lucide-react';

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

  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
    router.refresh();
  };

  useEffect(() => {
    if (!isLoading && !profile) {
      router.replace('/login');
    } else if (!isLoading && profile && profile.role !== 'courier') {
      router.replace('/?error=unauthorized');
    }
  }, [isLoading, profile, router]);

  if (isLoading) return <SkeletonCard />;
  if (!profile) return null;
  if (profile.role !== 'courier') return null;

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
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-bold text-red-500 transition hover:bg-red-500/20"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-3.5 w-3.5" />
            Salir
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-4">
        <ErrorBoundary name="Layout-children">
          <CourierProvider courierId={profile?.id}>
            {children}
          </CourierProvider>
        </ErrorBoundary>
      </main>
      <BottomNavigation items={navItems} />
    </div>
  );
}
