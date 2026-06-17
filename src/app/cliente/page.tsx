'use client';

import React, { useEffect, useState } from 'react';
import { PageContainer } from '@/components/ui/page-container';
import { LoadingState } from '@/components/ui/loading-state';
import { HeroSearch } from '@/components/marketplace/hero-search';
import { CategoryScroll } from '@/components/marketplace/category-scroll';
import { BusinessSection } from '@/components/marketplace/business-section';
import { marketplaceService } from '@/services/marketplace';
import type { MarketplaceCategory, MarketplaceBusiness } from '@/services/marketplace';

export default function ClienteHome() {
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [featured, setFeatured] = useState<MarketplaceBusiness[]>([]);
  const [nearby, setNearby] = useState<MarketplaceBusiness[]>([]);
  const [recommended, setRecommended] = useState<MarketplaceBusiness[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [cats, feat, near, rec] = await Promise.all([
        marketplaceService.getCategories(),
        marketplaceService.getFeaturedBusinesses(),
        marketplaceService.getBusinesses({ isOpen: true }),
        marketplaceService.getRecommendedBusinesses(),
      ]);
      setCategories(cats);
      setFeatured(feat);
      setNearby(near);
      setRecommended(rec);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState />;

  return (
    <PageContainer>
      <div className="space-y-10">
        <HeroSearch />

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Categorías</h2>
          </div>
          <CategoryScroll categories={categories} />
        </section>

        {featured.length > 0 && (
          <BusinessSection
            title="Destacados"
            businesses={featured}
            viewAllHref="/cliente/search"
          />
        )}

        {nearby.length > 0 && (
          <BusinessSection
            title="Cercanos"
            businesses={nearby}
            viewAllHref="/cliente/search"
          />
        )}

        {recommended.length > 0 && (
          <BusinessSection
            title="Recomendados para ti"
            businesses={recommended}
          />
        )}
      </div>
    </PageContainer>
  );
}
