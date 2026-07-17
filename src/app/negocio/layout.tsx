'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { BusinessSidebar } from '@/components/business/business-sidebar';
import { BusinessHeader } from '@/components/business/business-header';
import { BottomNavigation } from '@/components/ui/bottom-navigation';
import { Footer } from '@/components/ui/footer';
import { SkeletonCard } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getBrowserClient } from '@/lib/db/supabase';
import {
  ClipboardList,
  LayoutDashboard,
  MapPin,
  Package,
  Settings,
  Users,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/negocio', icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'Productos', href: '/negocio/productos', icon: <Package className="h-5 w-5" /> },
  { label: 'Pedidos', href: '/negocio/pedidos', icon: <ClipboardList className="h-5 w-5" /> },
  { label: 'Clientes', href: '/negocio/clientes', icon: <Users className="h-5 w-5" /> },
  { label: 'Config', href: '/negocio/configuracion', icon: <Settings className="h-5 w-5" /> },
];

const LOCATION_ONBOARDING_PATH = '/negocio/configuracion/ubicacion';

export default function NegocioLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [checkingLocation, setCheckingLocation] = useState(true);

  useEffect(() => {
    if (!isLoading && !profile) {
      router.replace('/login');
    } else if (!isLoading && profile && profile.role !== 'merchant') {
      const roleRoutes: Record<string, string> = {
        admin: '/admin',
        courier: '/repartidor',
        customer: '/cliente',
      };
      router.replace(roleRoutes[profile.role] || '/login');
    }
  }, [isLoading, profile, router]);

  useEffect(() => {
    if (isLoading || !profile?.id || profile.role !== 'merchant') {
      if (!isLoading) setCheckingLocation(false);
      return;
    }

    let active = true;
    const checkBusinessLocation = async () => {
      setCheckingLocation(true);
      try {
        const supabase = getBrowserClient();
        const { data: business, error: businessError } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', profile.id)
          .is('deleted_at', null)
          .maybeSingle();

        if (!active) return;
        if (businessError) {
          console.error('[BusinessOnboarding] No se pudo validar el negocio:', businessError);
          return;
        }
        if (!business) return;

        const { data: location, error: locationError } = await supabase
          .from('business_addresses')
          .select('id')
          .eq('business_id', business.id)
          .eq('is_active', true)
          .eq('delivery_available', true)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle();

        if (!active) return;
        if (locationError) {
          console.error('[BusinessOnboarding] No se pudo validar el local:', locationError);
          return;
        }
        if (!location && !pathname.startsWith(LOCATION_ONBOARDING_PATH)) {
          router.replace(`${LOCATION_ONBOARDING_PATH}?onboarding=1`);
        }
      } finally {
        if (active) setCheckingLocation(false);
      }
    };

    void checkBusinessLocation();
    return () => {
      active = false;
    };
  }, [isLoading, pathname, profile?.id, profile?.role, router]);

  if (
    isLoading ||
    (profile?.role === 'merchant' &&
      checkingLocation &&
      !pathname.startsWith(LOCATION_ONBOARDING_PATH))
  ) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/15 text-warning">
            <MapPin className="h-7 w-7 animate-pulse" />
          </div>
          <p className="text-sm font-black">Verificando la ubicación del establecimiento…</p>
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!profile) return null;
  if (profile.role !== 'merchant') return null;

  return (
    <div className="min-h-[100dvh] max-w-full overflow-x-hidden bg-background">
      <BusinessSidebar />
      <div className={cn('min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] transition-all duration-300 lg:pl-64 lg:pb-0')}>
        <BusinessHeader />
        <main className="min-w-0 overflow-x-hidden p-3 sm:p-6">{children}</main>
        <div className="hidden lg:block"><Footer /></div>
      </div>
      <BottomNavigation items={navItems} />
    </div>
  );
}
