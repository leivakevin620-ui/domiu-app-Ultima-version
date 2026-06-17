'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/ui/page-container';
import { HeroSearch } from '@/components/marketplace/hero-search';
import { CategoryScroll } from '@/components/marketplace/category-scroll';
import { BusinessCard } from '@/components/delivery/business-card';
import { marketplaceService } from '@/services/marketplace';
import { ASSETS } from '@/lib/assets';
import type { MarketplaceCategory, MarketplaceBusiness } from '@/services/marketplace';
import { ChevronRight, Tag, TrendingUp, MapPin, Pill, ShoppingBasket, Crown, Sparkles, ArrowRight } from 'lucide-react';
import { Skeleton, BusinessCardSkeleton, CategoryScrollSkeleton, PromoBannerSkeleton } from '@/components/ui/skeleton';

const SECTION_ICONS: Record<string, React.ReactNode> = {
  promociones: <Tag className="h-5 w-5" />,
  mas_pedidos: <TrendingUp className="h-5 w-5" />,
  cerca_ti: <MapPin className="h-5 w-5" />,
  farmacias: <Pill className="h-5 w-5" />,
  supermercados: <ShoppingBasket className="h-5 w-5" />,
  destacados: <Crown className="h-5 w-5" />,
};

const SECTION_COLORS: Record<string, string> = {
  promociones: 'from-rose-500 to-pink-600',
  mas_pedidos: 'from-amber-500 to-orange-600',
  cerca_ti: 'from-emerald-500 to-teal-600',
  farmacias: 'from-sky-500 to-blue-600',
  supermercados: 'from-violet-500 to-purple-600',
  destacados: 'from-primary to-primary/80',
};

function SectionHeader({
  icon,
  title,
  viewAllHref,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  viewAllHref?: string;
  color: string;
}) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white shadow-sm`}>
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground leading-tight">{title}</h2>
        </div>
      </div>
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:text-primary hover:shadow-sm"
        >
          Ver todo
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function HorizontalBusinessScroll({ businesses }: { businesses: MarketplaceBusiness[] }) {
  if (businesses.length === 0) return null;
  return (
    <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 scrollbar-none">
      {businesses.map((biz) => (
        <Link key={biz.id} href={`/cliente/business/${biz.slug}`} className="w-[240px] shrink-0 sm:w-[280px]">
          <BusinessCard
            name={biz.name}
            image={biz.banner_url ?? biz.logo_url ?? undefined}
            logo={biz.logo_url ?? undefined}
            category={biz.category_name}
            rating={biz.rating}
            reviewCount={biz.review_count}
            deliveryTime={biz.delivery_time}
            deliveryFee={biz.delivery_fee}
            isOpen={biz.is_open}
            isFeatured={biz.is_featured}
            distance={biz.distance}
            promotion={biz.promotion}
          />
        </Link>
      ))}
    </div>
  );
}

function PromoBanner({ business }: { business: MarketplaceBusiness }) {
  const PROMO_IMAGES = [ASSETS.promotions['50-off'], ASSETS.promotions.envio_gratis, ASSETS.promotions.combos, ASSETS.promotions.primera_compra];
  const bgImage = PROMO_IMAGES[Number(business.id?.charCodeAt?.(0) ?? 0) % PROMO_IMAGES.length];
  return (
    <Link
      href={`/cliente/business/${business.slug}`}
      className="group relative block h-44 w-[280px] shrink-0 overflow-hidden rounded-2xl sm:h-52 sm:w-[320px]"
    >
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-500 group-hover:scale-105"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
      <div className="relative z-10 flex h-full flex-col justify-between p-5 text-white">
        <div className="flex items-start justify-between">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            {business.delivery_time}
          </span>
          <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-amber-900">
            -20%
          </span>
        </div>
        <div>
          <h3 className="text-lg font-bold leading-tight">{business.name}</h3>
          <p className="mt-1 text-sm text-white/70 line-clamp-1">{business.category_name}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-white/60">
            <span>{'★'.repeat(Math.round(business.rating))} {business.rating}</span>
            <span>{business.delivery_fee}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function ClienteHome() {
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [featured, setFeatured] = useState<MarketplaceBusiness[]>([]);
  const [nearby, setNearby] = useState<MarketplaceBusiness[]>([]);
  const [recommended, setRecommended] = useState<MarketplaceBusiness[]>([]);
  const [pharmacies, setPharmacies] = useState<MarketplaceBusiness[]>([]);
  const [supermarkets, setSupermarkets] = useState<MarketplaceBusiness[]>([]);
  const [promotions, setPromotions] = useState<MarketplaceBusiness[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [cats, feat, near, rec, pharm, superm] = await Promise.all([
        marketplaceService.getCategories(),
        marketplaceService.getFeaturedBusinesses(),
        marketplaceService.getBusinesses({ isOpen: true }),
        marketplaceService.getRecommendedBusinesses(),
        marketplaceService.getBusinessesByType('pharmacy'),
        marketplaceService.getBusinessesByType('supermarket'),
      ]);
      setCategories(cats);
      setFeatured(feat);
      setNearby(near);
      setRecommended(rec);
      setPharmacies(pharm);
      setSupermarkets(superm);
      setPromotions(feat.filter((b) => b.rating >= 4.5).slice(0, 5));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-8 pb-8">
          <div className="animate-pulse rounded-3xl bg-gradient-to-br from-primary/20 to-primary/10 px-6 py-8 sm:px-8 sm:py-10">
            <div className="mb-4 h-9 w-48 rounded-full bg-white/20" />
            <div className="mb-2 h-8 w-72 rounded-lg bg-white/20" />
            <div className="mb-6 h-4 w-56 rounded bg-white/10" />
            <div className="h-13 w-full rounded-2xl bg-white/20" style={{ height: '52px' }} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-5 w-24" />
            </div>
            <CategoryScrollSkeleton />
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-5 w-28" />
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              <PromoBannerSkeleton />
              <PromoBannerSkeleton />
              <PromoBannerSkeleton />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <BusinessCardSkeleton />
              <BusinessCardSkeleton />
              <BusinessCardSkeleton />
              <BusinessCardSkeleton />
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  const sections: Array<{
    key: string;
    title: string;
    businesses: MarketplaceBusiness[];
    horizontal?: boolean;
    promo?: boolean;
  }> = [
    ...(promotions.length > 0 ? [{ key: 'promociones', title: 'Promociones', businesses: promotions, promo: true }] : []),
    ...(recommended.length > 0 ? [{ key: 'mas_pedidos', title: 'Los más pedidos', businesses: recommended, horizontal: true }] : []),
    ...(nearby.length > 0 ? [{ key: 'cerca_ti', title: 'Cerca de ti', businesses: nearby }] : []),
    ...(pharmacies.length > 0 ? [{ key: 'farmacias', title: 'Farmacias', businesses: pharmacies, horizontal: true }] : []),
    ...(supermarkets.length > 0 ? [{ key: 'supermercados', title: 'Supermercados', businesses: supermarkets, horizontal: true }] : []),
    ...(featured.length > 0 ? [{ key: 'destacados', title: 'Restaurantes destacados', businesses: featured }] : []),
  ];

  return (
    <PageContainer>
      <div className="space-y-10 pb-12">
        {/* Hero */}
        <HeroSearch />

        {/* Categories */}
        <section>
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 text-primary shadow-sm">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-foreground">Categorías</h2>
            </div>
            <Link
              href="/cliente/categories"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:text-primary hover:shadow-sm"
            >
              Ver todo
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <CategoryScroll categories={categories} />
        </section>

        {/* Dynamic sections */}
        {sections.map((section) => (
          <section key={section.key}>
            <SectionHeader
              icon={SECTION_ICONS[section.key]}
              title={section.title}
              viewAllHref="/cliente/search"
              color={SECTION_COLORS[section.key]}
            />
            {section.promo ? (
              <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 scrollbar-none">
                {section.businesses.map((biz) => (
                  <PromoBanner key={biz.id} business={biz} />
                ))}
              </div>
            ) : section.horizontal ? (
              <HorizontalBusinessScroll businesses={section.businesses} />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {section.businesses.map((biz) => (
                  <Link key={biz.id} href={`/cliente/business/${biz.slug}`}>
                    <BusinessCard
                      name={biz.name}
                      image={biz.banner_url ?? biz.logo_url ?? undefined}
                      logo={biz.logo_url ?? undefined}
                      category={biz.category_name}
                      rating={biz.rating}
                      reviewCount={biz.review_count}
                      deliveryTime={biz.delivery_time}
                      deliveryFee={biz.delivery_fee}
                      isOpen={biz.is_open}
                      isFeatured={biz.is_featured}
                      distance={biz.distance}
                      promotion={biz.promotion}
                    />
                  </Link>
                ))}
              </div>
            )}
          </section>
        ))}

        {/* CTA Final */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/80 px-6 py-10 text-center text-primary-foreground shadow-xl sm:px-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-white/5" />
          <Sparkles className="mx-auto mb-4 h-8 w-8 text-white/70" />
          <h3 className="mb-2 text-2xl font-bold">¿Eres un negocio?</h3>
          <p className="mb-6 text-sm text-white/70 max-w-md mx-auto">
            Únete a DomiU y llega a miles de clientes en Santa Marta. Registra tu negocio hoy.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-primary shadow-xl transition-all duration-200 hover:bg-white/90 hover:shadow-2xl active:scale-95"
          >
            Registra tu negocio
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </PageContainer>
  );
}
