'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getDashboardPathForRole } from '@/types/auth';
import { logger } from '@/lib/logger';
import { marketplaceService, MarketplaceBusiness, MarketplaceCategory } from '@/services/marketplace';
import { DomiULogo, DomiUMark } from '@/components/brand/DomiULogo';
import { Hero } from '@/components/landing/Hero';
import { Benefits } from '@/components/landing/Benefits';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { CategoriesSection } from '@/components/landing/CategoriesSection';
import { FeaturedRestaurants } from '@/components/landing/FeaturedRestaurants';
import { Stats } from '@/components/landing/Stats';
import { Testimonials } from '@/components/landing/Testimonials';
import { AppDownload } from '@/components/landing/AppDownload';
import { FAQ } from '@/components/landing/FAQ';
import { FooterPremium } from '@/components/landing/FooterPremium';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, profile, isLoading } = useAuth();
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [featured, setFeatured] = useState<MarketplaceBusiness[]>([]);
  const [recommended, setRecommended] = useState<MarketplaceBusiness[]>([]);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    if (profile?.role) {
      const path = getDashboardPathForRole(profile.role);
      logger.debug('[HomePage] redirect', { role: profile.role, path });
      router.push(path);
    } else {
      logger.debug('[HomePage] no role, redirect to /login');
      router.push('/login');
    }
  }, [isAuthenticated, profile, isLoading, router]);

  useEffect(() => {
    const load = async () => {
      try {
        const [cats, feat, rec] = await Promise.all([
          marketplaceService.getCategories(),
          marketplaceService.getFeaturedBusinesses(),
          marketplaceService.getRecommendedBusinesses(),
        ]);
        setCategories(cats);
        setFeatured(feat);
        setRecommended(rec);
      } catch {
        // El contenido estático continúa disponible cuando el marketplace tarda.
      }
    };
    void load();
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <DomiUMark className="h-16 w-16 animate-pulse" />
          <p className="animate-pulse text-sm font-semibold text-muted-foreground">Cargando DomiU Magdalena…</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <p className="text-muted-foreground">Redirigiendo…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-primary/10 bg-[#1A1D21]/85 backdrop-blur-2xl">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center" aria-label="DomiU Magdalena">
            <DomiULogo variant="dark" markClassName="h-11 w-11" />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm font-semibold text-muted-foreground transition-colors hover:text-primary sm:inline-flex">
              Iniciar sesión
            </Link>
            <Link href="/register" className="domiu-brand-glow inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground transition-all hover:brightness-105">
              Registrarse
            </Link>
          </div>
        </div>
      </nav>

      <Hero />
      <Benefits />
      <CategoriesSection categories={categories} />
      <FeaturedRestaurants featured={featured} recommended={recommended} />
      <HowItWorks />
      <Stats />
      <Testimonials />
      <AppDownload />
      <FAQ />
      <FooterPremium />
    </div>
  );
}
