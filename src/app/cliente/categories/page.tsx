'use client';

import React, { useEffect, useState } from 'react';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { LoadingState } from '@/components/ui/loading-state';
import { marketplaceService } from '@/services/marketplace';
import type { MarketplaceCategory, MarketplaceBusiness } from '@/services/marketplace';
import { useRouter } from 'next/navigation';

export default function CategoriesPage() {
  const router = useRouter();
  const [data, setData] = useState<(MarketplaceCategory & { businesses: MarketplaceBusiness[] })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    marketplaceService.getCategoriesWithBusinesses().then((result) => {
      setData(result);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingState />;

  return (
    <PageContainer>
      <PageTitle title="Categorías" description="Explora por tipo de comida" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.map((cat) => (
          <button
            key={cat.id}
            onClick={() => router.push(`/cliente/search?cat=${cat.id}`)}
            className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-card transition-all hover:shadow-dropdown hover:-translate-y-0.5"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl transition-colors group-hover:bg-primary/5">
              {cat.icon}
            </div>
            <div>
              <h3 className="font-medium text-foreground">{cat.name}</h3>
              <p className="text-sm text-muted-foreground">
                {cat.businesses.length} negocio{cat.businesses.length !== 1 ? 's' : ''}
              </p>
            </div>
          </button>
        ))}
      </div>
    </PageContainer>
  );
}
