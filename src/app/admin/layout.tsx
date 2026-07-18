'use client';

import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';
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
  }, [profile?.id]);

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
      const destination = roleRoutes[profile.role] || '/login';
      logger.debug('[AdminLayout] role not admin', { role: profile.role, redirectTo: destination });
      router.replace(destination);
    }
  }, [isLoading, profile, router]);

  if (isLoading) return <SkeletonCard />;
  if (!profile) return null;
  if (!ADMIN_ROLES.includes(profile.role)) return null;

  return (
    <div className="min-h-[100dvh] w-full min-w-0 max-w-full overflow-x-clip bg-background">
      <AdminSidebar />
      <div className={cn('min-w-0 max-w-full overflow-x-clip transition-all duration-300 lg:pl-64')}>
        <AdminHeader />
        <main className="min-w-0 max-w-full overflow-x-clip p-3 pb-8 sm:p-5 sm:pb-10 lg:p-6">{children}</main>
        <div className="hidden lg:block"><Footer /></div>
      </div>
    </div>
  );
}
