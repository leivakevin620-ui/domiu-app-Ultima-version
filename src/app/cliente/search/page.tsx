'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { PageContainer } from '@/components/ui/page-container';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { BusinessCardPremium } from '../_components/BusinessCardPremium';
import { marketplaceService } from '@/services/marketplace';
import type { MarketplaceBusiness, MarketplaceProduct, MarketplaceCategory } from '@/services/marketplace';
import { Search, SlidersHorizontal, Mic, X, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ProductCard } from '@/components/delivery/product-card';

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
  const [focused, setFocused] = useState(false);

  useEffect(() => { marketplaceService.getCategories().then(setCategories); }, []);

  useEffect(() => {
    const search = async () => {
      setLoading(true);
      if (catFilter) {
        const biz = await marketplaceService.getBusinessesByCategory(catFilter);
        setBusinesses(biz); setProducts([]);
      } else if (query.trim()) {
        const result = await marketplaceService.search(query);
        setBusinesses(result.businesses); setProducts(result.products);
      } else {
        const biz = await marketplaceService.getBusinesses({ isOpen: true });
        setBusinesses(biz); setProducts([]);
      }
      setLoading(false);
    };
    search();
  }, [query, catFilter]);

  const handleSearch = useCallback((val: string) => {
    setQuery(val); setCatFilter('');
    const params = new URLSearchParams();
    if (val.trim()) params.set('q', val.trim());
    router.replace(`/cliente/search${params.toString() ? '?' + params.toString() : ''}`, { scroll: false });
  }, [router]);

  const selectedCat = categories.find((c) => c.id === catFilter);
  const totalResults = businesses.length + products.length;

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      <div className="sticky top-0 z-30 bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className={`relative flex flex-1 items-center rounded-2xl border bg-background/80 backdrop-blur-xl transition-all ${focused ? 'border-primary/30 shadow-lg shadow-primary/5 ring-2 ring-primary/10' : 'border-border/50 shadow-sm'}`}>
            <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Buscar restaurantes o platillos..."
              className="h-11 w-full bg-transparent pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {query && (
              <button onClick={() => handleSearch('')} className="absolute right-10 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            )}
            <button className="absolute right-2 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground hover:bg-muted">
              <Mic className="h-4 w-4" />
            </button>
          </div>
          <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/50 bg-background/80 text-muted-foreground backdrop-blur-xl transition-all hover:border-primary/30 hover:text-primary hover:shadow-sm">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      <PageContainer>
        {categories.length > 0 && (
          <motion.div
            className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-none"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <button
              onClick={() => setCatFilter('')}
              className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-medium transition-all ${
                !catFilter ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setCatFilter(cat.id); setQuery(''); }}
                className={`shrink-0 flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-medium transition-all ${
                  catFilter === cat.id ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SkeletonCard />
            </motion.div>
          ) : totalResults === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={<Search className="h-6 w-6" />}
                title="Sin resultados"
                description={query ? `No encontramos resultados para "${query}"` : 'No hay restaurantes disponibles'}
              />
            </motion.div>
          ) : (
            <motion.div
              key="results"
              className="space-y-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {!catFilter && products.length > 0 && (
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Platillos <span className="text-foreground">({products.length})</span>
                    </h3>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {products.map((p, i) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.3 }}
                      >
                        <ProductCard
                          name={p.name}
                          price={p.price}
                          description={p.description}
                          image={p.image_url ?? undefined}
                          category={p.category_name}
                          isAvailable={p.is_available}
                        />
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {catFilter ? selectedCat?.name ?? 'Categoría' : 'Restaurantes'} <span className="text-foreground">({businesses.length})</span>
                  </h3>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {businesses.map((biz, i) => (
                    <motion.div
                      key={biz.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                    >
                      <Link href={`/cliente/business/${biz.slug}`}>
                        <BusinessCardPremium
                          name={biz.name}
                          image={biz.banner_url ?? biz.logo_url ?? undefined}
                          category={biz.category_name}
                          rating={biz.rating}
                          reviewCount={biz.review_count}
                          deliveryTime={biz.delivery_time}
                          deliveryFee={biz.delivery_fee}
                          isOpen={biz.is_open}
                          isFeatured={biz.is_featured}
                          distance={biz.distance}
                        />
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </PageContainer>
    </div>
  );
}
