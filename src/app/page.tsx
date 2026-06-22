'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getDashboardPathForRole } from '@/types/auth';
import { logger } from '@/lib/logger';
import { marketplaceService, MarketplaceBusiness, MarketplaceCategory } from '@/services/marketplace';
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
        // silently fail - static content still shows
      }
    };
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground animate-pulse">
            D
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Cargando...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Redirigiendo...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border/10 bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20">
              D
            </div>
            <span className="text-lg font-bold text-foreground">DomiU</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="inline-flex h-10 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
            >
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
