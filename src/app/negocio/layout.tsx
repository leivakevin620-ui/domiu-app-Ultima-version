'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

import { useRouter } from 'next/navigation';
import { BusinessSidebar } from '@/components/business/business-sidebar';
import { BusinessHeader } from '@/components/business/business-header';
import { Footer } from '@/components/ui/footer';
import { SkeletonCard } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function NegocioLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, profile } = useAuth();
  const router = useRouter();

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

  if (isLoading) return <SkeletonCard />;
  if (!profile) return null;
  if (profile.role !== 'merchant') return null;

  return (
    <div className="min-h-screen bg-background">
      <BusinessSidebar />
      <div className={cn('transition-all duration-300 lg:pl-64')}>
        <BusinessHeader />
        <main className="p-6">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
