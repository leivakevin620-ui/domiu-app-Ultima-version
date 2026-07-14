'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageContainer } from '@/components/ui/page-container';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ProductCard } from '@/components/delivery/product-card';
import { ProductCustomizationDialog } from '@/components/delivery/product-customization-dialog';
import { marketplaceService, type MarketplaceBusiness, type MarketplaceProduct } from '@/services/marketplace';
import { useCart, type CartCustomization } from '@/contexts/CartContext';
import { ArrowLeft, Clock, MapPin, ShoppingBag, Star } from 'lucide-react';
import Link from 'next/link';

const CATEGORY_ICONS: Record<string, string> = {
  'Alitas ahumadas': '🍗',
  'Sándwiches': '🥪',
  Tenders: '🍗',
  Adicionales: '🍟',
  Bebidas: '🥤',
  Cervezas: '🍺',
  Otros: '🍽️',
};

function sectionId(category: string) {
  return `categoria-${category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}`;
}

export default function BusinessPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { addItem, items, businessId, itemCount } = useCart();
  const [business, setBusiness] = useState<MarketplaceBusiness | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [customizing, setCustomizing] = useState<MarketplaceProduct | null>(null);

  useEffect(() => {
    const load = async () => {
      const biz = await marketplaceService.getBusinessBySlug(slug);
      if (!biz) {
        setLoading(false);
        return;
      }
      setBusiness(biz);
      setProducts(await marketplaceService.getProducts(biz.id));
      setLoading(false);
    };
    void load();
  }, [slug]);

  const grouped = useMemo(() => products.reduce<Record<string, MarketplaceProduct[]>>((result, product) => {
    const category = product.category_name || 'Otros';
    (result[category] ??= []).push(product);
    return result;
  }, {}), [products]);

  if (loading) return <SkeletonCard />;
  if (!business) return <PageContainer><EmptyState title="Negocio no encontrado" description="El restaurante no existe o está inactivo." /></PageContainer>;

  const sameBusiness = businessId === business.id;
  const cartTotal = sameBusiness ? items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) : 0;
  const categories = Object.entries(grouped);

  const handleAdd = (product: MarketplaceProduct) => {
    if (product.metadata?.product_type === 'wings') {
      setCustomizing(product);
      return;
    }
    addItem(product, business.id, business.name);
  };

  const confirmCustomization = (product: MarketplaceProduct, customization: CartCustomization, unitPrice: number) => {
    addItem(product, business.id, business.name, { customization, unitPrice });
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <button onClick={() => router.back()} className="rounded-xl p-2 hover:bg-muted" aria-label="Volver"><ArrowLeft className="h-5 w-5" /></button>
          <span className="truncate text-sm font-semibold">{business.name}</span>
          <Link href="/cliente/cart" className="relative ml-auto rounded-xl p-2 hover:bg-muted"><ShoppingBag className="h-5 w-5" />{sameBusiness && itemCount > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{itemCount}</span>}</Link>
        </div>
      </header>

      <div className="h-52 bg-muted bg-cover bg-center" style={business.banner_url ? { backgroundImage: `url(${business.banner_url})` } : undefined} />

      <PageContainer className="relative -mt-10">
        <section className="mb-5 rounded-3xl border bg-card p-5 shadow-lg">
          <div className="flex gap-4">
            <div className="h-20 w-20 shrink-0 rounded-2xl bg-muted bg-cover bg-center" style={business.logo_url ? { backgroundImage: `url(${business.logo_url})` } : undefined} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{business.name}</h1><span className={`rounded-full px-2 py-1 text-xs font-semibold ${business.is_open ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>{business.is_open ? 'Abierto' : 'Cerrado'}</span></div>
              <p className="mt-1 text-sm text-muted-foreground">{business.description}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground"><span className="flex items-center gap-1"><Star className="h-4 w-4" />{business.rating}</span><span className="flex items-center gap-1"><Clock className="h-4 w-4" />{business.delivery_time}</span><span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{business.distance ?? 'Santa Marta'}</span></div>
        </section>

        {products.length === 0 ? (
          <EmptyState title="Sin productos disponibles" description="Este negocio aún no tiene menú." />
        ) : (
          <>
            <nav className="sticky top-14 z-30 -mx-4 mb-7 overflow-x-auto border-y bg-background/95 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border">
              <div className="flex min-w-max gap-2">
                {categories.map(([category, categoryProducts]) => (
                  <a key={category} href={`#${sectionId(category)}`} className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-semibold shadow-sm transition hover:border-primary hover:text-primary">
                    <span>{CATEGORY_ICONS[category] || '🍽️'}</span>
                    <span>{category}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{categoryProducts.length}</span>
                  </a>
                ))}
              </div>
            </nav>

            <div className="space-y-10">
              {categories.map(([category, categoryProducts]) => (
                <section id={sectionId(category)} key={category} className="scroll-mt-32">
                  <div className="mb-4 flex items-end justify-between gap-3 border-b pb-3">
                    <div><p className="text-xs font-bold uppercase tracking-widest text-primary">{CATEGORY_ICONS[category] || '🍽️'} Menú</p><h2 className="mt-1 text-xl font-black">{category}</h2></div>
                    <span className="text-xs text-muted-foreground">{categoryProducts.length} productos</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {categoryProducts.map((product) => (
                      <ProductCard key={product.id} name={product.name} price={product.price} image={product.image_url ?? undefined} description={product.description} category={product.category_name} isAvailable={business.is_open && product.is_available} inCart={sameBusiness && items.some((item) => item.product.id === product.id)} onAdd={() => handleAdd(product)} onViewCart={() => router.push('/cliente/cart')} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </PageContainer>

      {sameBusiness && itemCount > 0 && <Link href="/cliente/cart" className="fixed bottom-20 left-4 right-4 z-40 flex items-center justify-between rounded-2xl bg-primary p-4 font-bold text-primary-foreground shadow-xl lg:bottom-4 lg:left-auto lg:w-96"><span>Ver carrito ({itemCount})</span><span>${cartTotal.toLocaleString('es-CO')}</span></Link>}
      {customizing && <ProductCustomizationDialog product={customizing} open onClose={() => setCustomizing(null)} onConfirm={(customization, unitPrice) => confirmCustomization(customizing, customization, unitPrice)} />}
    </div>
  );
}
