'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { PageContainer } from '@/components/ui/page-container';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { marketplaceService } from '@/services/marketplace';
import { useCart } from '@/contexts/CartContext';
import type { MarketplaceBusiness, MarketplaceProduct } from '@/services/marketplace';
import { ProductCard } from '@/components/delivery/product-card';
import { Star, Clock, MapPin, ArrowLeft, ShoppingBag, Heart } from 'lucide-react';
import Link from 'next/link';

export default function BusinessPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { addItem, items, businessId, itemCount } = useCart();

  const [business, setBusiness] = useState<MarketplaceBusiness | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('all');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    async function load() {
      const biz = await marketplaceService.getBusinessBySlug(slug);
      if (!biz) { setLoading(false); return; }
      setBusiness(biz);
      const prods = await marketplaceService.getProducts(biz.id);
      setProducts(prods);
      setLoading(false);
    }
    load();
  }, [slug]);

  const categories = [...new Set(products.map((p) => p.category_name).filter(Boolean))] as string[];
  const tabs = [{ key: 'all', label: 'Todo' }, ...categories.map((c) => ({ key: c, label: c }))];

  const grouped = products.reduce<Record<string, MarketplaceProduct[]>>((acc, p) => {
    const key = p.category_name || 'Otros';
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const handleAdd = (product: MarketplaceProduct) => {
    if (!business) return;
    addItem(product, business.id, business.name);
    setAddedIds((prev) => new Set(prev).add(product.id));
    setTimeout(() => setAddedIds((prev) => { const next = new Set(prev); next.delete(product.id); return next; }), 1200);
  };

  const scrollToCategory = useCallback((key: string) => {
    setActiveTab(key);
    if (key === 'all') return;
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (loading) return <SkeletonCard />;

  if (!business) {
    return (
      <PageContainer>
        <EmptyState title="Negocio no encontrado" description="El restaurante que buscas no existe o ha sido dado de baja." />
      </PageContainer>
    );
  }

  const isSameBusiness = businessId === business.id;
  const cartTotal = isSameBusiness ? items.reduce((sum, i) => sum + i.product.price * i.quantity, 0) : 0;

  return (
    <div className="min-h-screen bg-background pb-32 lg:pb-24">
      <div className="sticky top-0 z-30 bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-foreground truncate">{business.name}</span>
          <div className="ml-auto flex items-center gap-1">
            <button className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Heart className="h-5 w-5" />
            </button>
            <Link href="/cliente/cart" className="relative flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <ShoppingBag className="h-5 w-5" />
              {isSameBusiness && itemCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      <div className="relative h-48 sm:h-56 md:h-64 overflow-hidden bg-muted">
        {business.banner_url ? (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${business.banner_url})` }} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      <PageContainer className="-mt-16 relative z-10">
        <motion.div
          className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-end gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 text-3xl font-bold text-primary shadow-xl ring-4 ring-background">
              {business.logo_url ? (
                <div className="h-full w-full rounded-2xl bg-cover bg-center" style={{ backgroundImage: `url(${business.logo_url})` }} />
              ) : (
                business.name.charAt(0)
              )}
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{business.name}</h1>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${business.is_open ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                  {business.is_open ? 'Abierto' : 'Cerrado'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{business.description}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="mb-6 flex flex-wrap items-center gap-4 text-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <span className="flex items-center gap-1.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {business.rating} ({business.review_count})
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {business.delivery_time}
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {business.distance ?? '0.5 km'}
          </span>
          <span className="font-semibold text-foreground">{business.delivery_fee}</span>
        </motion.div>

        {tabs.length > 1 && (
          <div className="sticky top-14 z-20 -mx-4 mb-6 overflow-x-auto bg-background/70 px-4 backdrop-blur-xl scrollbar-none">
            <div className="flex gap-2 pb-3 pt-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => scrollToCategory(tab.key)}
                  className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-medium transition-all ${
                    activeTab === tab.key
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {products.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={<ShoppingBag className="h-6 w-6" />}
                title="Sin productos disponibles"
                description="Este negocio aún no ha agregado productos a su menú."
              />
            </motion.div>
          ) : (
            <motion.div
              key="menu"
              className="space-y-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'all' ? (
                Object.entries(grouped).map(([category, catProducts]) => (
                  <section key={category} ref={(el) => { sectionRefs.current[category] = el; }}>
                    <h2 className="mb-4 text-base font-bold text-foreground">{category}</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {catProducts.map((product, i) => {
                        const inCart = isSameBusiness && items.some((item) => item.product.id === product.id);
                        return (
                          <motion.div
                            key={product.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05, duration: 0.3 }}
                          >
                            <ProductCard
                              name={product.name}
                              price={product.price}
                              image={product.image_url ?? undefined}
                              description={product.description}
                              category={product.category_name}
                              isAvailable={business.is_open && product.is_available}
                              isAdded={addedIds.has(product.id)}
                              inCart={inCart}
                              onAdd={() => handleAdd(product)}
                              onViewCart={() => router.push('/cliente/cart')}
                            />
                          </motion.div>
                        );
                      })}
                    </div>
                  </section>
                ))
              ) : (
                grouped[activeTab] && (
                  <section>
                    <h2 className="mb-4 text-base font-bold text-foreground">{activeTab}</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {grouped[activeTab].map((product, i) => {
                        const inCart = isSameBusiness && items.some((item) => item.product.id === product.id);
                        return (
                          <motion.div
                            key={product.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05, duration: 0.3 }}
                          >
                            <ProductCard
                              name={product.name}
                              price={product.price}
                              image={product.image_url ?? undefined}
                              description={product.description}
                              category={product.category_name}
                              isAvailable={business.is_open && product.is_available}
                              isAdded={addedIds.has(product.id)}
                              inCart={inCart}
                              onAdd={() => handleAdd(product)}
                              onViewCart={() => router.push('/cliente/cart')}
                            />
                          </motion.div>
                        );
                      })}
                    </div>
                  </section>
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </PageContainer>

      {isSameBusiness && itemCount > 0 && (
        <motion.div
          className="fixed bottom-16 left-0 right-0 z-20 p-4 lg:bottom-0"
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <Link
            href="/cliente/cart"
            className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary to-primary/90 px-6 py-4 text-primary-foreground shadow-2xl shadow-primary/30 transition-all hover:shadow-primary/40 active:scale-[0.98]"
          >
            <span className="flex items-center gap-2.5 text-sm font-medium">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-xs font-bold">{itemCount}</span>
              Ver pedido
            </span>
            <span className="text-lg font-bold">${cartTotal.toFixed(2)}</span>
          </Link>
        </motion.div>
      )}
    </div>
  );
}
