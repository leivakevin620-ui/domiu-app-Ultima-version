'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { CourierSidebar } from '@/components/courier/layout/CourierSidebar';
import { CourierTopbar } from '@/components/courier/layout/CourierTopbar';
import { CourierDispatchAlarm } from '@/components/courier/CourierDispatchAlarm';
import { BottomNavigation } from '@/components/ui/bottom-navigation';
import { SkeletonCard } from '@/components/ui/skeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CourierProvider } from '@/contexts/CourierContext';
import { Home, ClipboardList, Map, DollarSign, User } from 'lucide-react';

const navItems = [
  { label: 'Inicio', href: '/repartidor', icon: <Home className="h-5 w-5" /> },
  { label: 'Pedidos', href: '/repartidor/pedidos', icon: <ClipboardList className="h-5 w-5" /> },
  { label: 'Mapa', href: '/repartidor/mapa', icon: <Map className="h-5 w-5" /> },
  { label: 'Ganancias', href: '/repartidor/ganancias', icon: <DollarSign className="h-5 w-5" /> },
  { label: 'Perfil', href: '/repartidor/perfil', icon: <User className="h-5 w-5" /> },
];

export default function RepartidorLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, profile } = useAuth();
  const router = useRouter();

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
    <div className="min-h-screen bg-background">
      <CourierProvider courierId={profile.id}>
        <CourierDispatchAlarm />
        <CourierSidebar />
        <div className="transition-all duration-300 lg:pl-72 pb-16 lg:pb-0">
          <CourierTopbar />
          <main className="p-4 sm:p-6">
            <ErrorBoundary name="Layout-children">
              {children}
            </ErrorBoundary>
          </main>
        </div>
        <BottomNavigation items={navItems} />
      </CourierProvider>
    </div>
  );
}
