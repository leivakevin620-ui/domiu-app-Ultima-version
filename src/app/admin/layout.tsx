'use client';

import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

import { useRouter } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';
import { BottomNavigation } from '@/components/ui/bottom-navigation';
import { LayoutDashboard, Users, Store, Truck, ClipboardList, Settings } from 'lucide-react';
import { Footer } from '@/components/ui/footer';
import { SkeletonCard } from '@/components/ui/skeleton';
import { ADMIN_ROLES } from '@/types/auth';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { adminAuthService } from '@/services/admin-auth';
import { auditService } from '@/services/audit';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, profile } = useAuth();
  const router = useRouter();
  const sessionRegistered = useRef(false);

  useEffect(() => {
    if (profile?.id && !sessionRegistered.current) {
      sessionRegistered.current = true;
      try { adminAuthService.registerSession(profile.id); } catch {}
      try { adminAuthService.addHistory(profile.id, 'login', 'Acceso al panel de administración'); } catch {}
      try { auditService.log(profile.id, `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Admin', 'login', 'session', null, 'Acceso al panel de administración'); } catch {}
    }
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    logger.debug('[AdminLayout] render', { isLoading, hasProfile: !!profile, role: profile?.role, adminRoles: ADMIN_ROLES });
  });

  useEffect(() => {
    if (!isLoading && !profile) {
      logger.debug('[AdminLayout] no profile, redirect to /login');
      router.replace('/login');
    } else if (!isLoading && profile && !ADMIN_ROLES.includes(profile.role)) {
      const roleRoutes: Record<string, string> = {
        merchant: '/negocio',
        business: '/negocio',
        courier: '/repartidor',
        customer: '/cliente',
      };
      const dest = roleRoutes[profile.role] || '/login';
      logger.debug('[AdminLayout] role not admin', { role: profile.role, redirectTo: dest });
      router.replace(dest);
    }
  }, [isLoading, profile, router]);

  if (isLoading) return <SkeletonCard />;
  if (!profile) return null;
  if (!ADMIN_ROLES.includes(profile.role)) return null;

  return (
    <div className="min-h-[100dvh] w-full min-w-0 max-w-full overflow-x-clip bg-background">
      <AdminSidebar />
      <div className={cn('min-w-0 max-w-full overflow-x-clip pb-[calc(5rem+env(safe-area-inset-bottom))] transition-all duration-300 lg:pl-64 lg:pb-0')}>
        <AdminHeader />
        <main className="min-w-0 max-w-full overflow-x-clip p-3 sm:p-5 lg:p-6">{children}</main>
        <div className="hidden lg:block"><Footer /></div>
      </div>
      <BottomNavigation
        items={[
          { label: 'Dashboard', href: '/admin', icon: <LayoutDashboard className="h-5 w-5" /> },
          { label: 'Usuarios', href: '/admin/usuarios', icon: <Users className="h-5 w-5" /> },
          { label: 'Negocios', href: '/admin/negocios', icon: <Store className="h-5 w-5" /> },
          { label: 'Repartidores', href: '/admin/repartidores', icon: <Truck className="h-5 w-5" /> },
          { label: 'Pedidos', href: '/admin/pedidos', icon: <ClipboardList className="h-5 w-5" /> },
          { label: 'Más', href: '/admin/configuracion', icon: <Settings className="h-5 w-5" /> },
        ]}
      />
    </div>
  );
}
