'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { SearchInput } from '@/components/ui/search-input';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { BusinessCard } from '@/components/delivery/business-card';
import { ProductCard } from '@/components/delivery/product-card';
import { marketplaceService } from '@/services/marketplace';
import type { MarketplaceBusiness, MarketplaceProduct, MarketplaceCategory } from '@/services/marketplace';
import { Search, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const initialCat = searchParams.get('cat') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [catFilter, setCatFilter] = useState(initialCat);
  const [businesses, setBusinesses] = useState<MarketplaceBusiness[]>([]);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    marketplaceService.getCategories().then(setCategories);
  }, []);

  const doSearch = useCallback(async (q: string, cat: string) => {
    setLoading(true);
    if (cat) {
      const biz = await marketplaceService.getBusinessesByCategory(cat);
      setBusinesses(biz);
      setProducts([]);
    } else if (q.trim()) {
      const result = await marketplaceService.search(q);
      setBusinesses(result.businesses);
      setProducts(result.products);
    } else {
      const biz = await marketplaceService.getBusinesses({ isOpen: true });
      setBusinesses(biz);
      setProducts([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    doSearch(query, catFilter);
  }, [query, catFilter, doSearch]);

  const handleSearch = (val: string) => {
    setQuery(val);
    setCatFilter('');
    const params = new URLSearchParams();
    if (val.trim()) params.set('q', val.trim());
    router.replace(`/cliente/search${params.toString() ? '?' + params.toString() : ''}`, { scroll: false });
  };

  const selectedCat = categories.find((c) => c.id === catFilter);

  return (
    <PageContainer>
      <PageTitle title="Buscar" description="Encuentra lo que buscas">
        <button className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
        </button>
      </PageTitle>

      <div className="mb-6">
        <SearchInput
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onClear={() => { setQuery(''); setCatFilter(''); router.replace('/cliente/search'); }}
          placeholder="Buscar restaurantes o platillos..."
        />
      </div>

      {categories.length > 0 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setCatFilter('')}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              !catFilter ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setCatFilter(cat.id); setQuery(''); }}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                catFilter === cat.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : (
        <div className="space-y-8">
          {!catFilter && products.length > 0 && (
            <section>
              <h3 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Platillos ({products.length})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    name={p.name}
                    price={p.price}
                    description={p.description}
                    image={p.image_url ?? undefined}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {catFilter ? selectedCat?.name ?? 'Categoría' : 'Restaurantes'} ({businesses.length})
            </h3>
            {businesses.length === 0 ? (
              <EmptyState
                icon={<Search className="h-6 w-6" />}
                title="Sin resultados"
                description={query ? `No encontramos resultados para "${query}"` : 'No hay restaurantes disponibles'}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {businesses.map((biz) => (
                  <Link key={biz.id} href={`/cliente/business/${biz.slug}`}>
                    <BusinessCard
                      name={biz.name}
                      category={biz.category_name}
                      rating={biz.rating}
                      deliveryTime={biz.delivery_time}
                      deliveryFee={biz.delivery_fee}
                      isOpen={biz.is_open}
                    />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </PageContainer>
  );
}
