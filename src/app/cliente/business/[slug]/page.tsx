'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageContainer } from '@/components/ui/page-container';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { marketplaceService } from '@/services/marketplace';
import { useCart } from '@/contexts/CartContext';
import type { MarketplaceBusiness, MarketplaceProduct } from '@/services/marketplace';
import { Star, Clock, MapPin, ArrowLeft, ShoppingBag, Plus, Minus, Check } from 'lucide-react';
import Link from 'next/link';

export default function BusinessPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { addItem, items, businessId, itemCount } = useCart();

  const [business, setBusiness] = useState<MarketplaceBusiness | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

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

  const handleAdd = (product: MarketplaceProduct) => {
    if (!business) return;
    addItem(product, business.id, business.name);
    setAddedIds((prev) => new Set(prev).add(product.id));
    setTimeout(() => setAddedIds((prev) => { const next = new Set(prev); next.delete(product.id); return next; }), 1200);
  };

  if (loading) return <LoadingState />;

  if (!business) {
    return (
      <PageContainer>
        <EmptyState title="Negocio no encontrado" description="El restaurante que buscas no existe o ha sido dado de baja." />
      </PageContainer>
    );
  }

  const isSameBusiness = businessId === business.id;

  return (
    <PageContainer className="pb-24">
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{business.name}</h1>
              <Badge variant={business.is_open ? 'success' : 'destructive'}>
                {business.is_open ? 'Abierto' : 'Cerrado'}
              </Badge>
            </div>
            <p className="mb-4 max-w-lg text-sm text-muted-foreground">{business.description}</p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-warning text-warning" />
                {business.rating} ({business.review_count})
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {business.delivery_time}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {business.distance ?? '0.5 km'}
              </span>
              <span className="font-medium text-foreground">{business.delivery_fee} envío</span>
            </div>
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Menú</h2>
        {products.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="h-6 w-6" />}
            title="Sin productos disponibles"
            description="Este negocio aún no ha agregado productos a su menú."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {products.map((product) => {
              const inCart = isSameBusiness && items.some((i) => i.product.id === product.id);
              const justAdded = addedIds.has(product.id);
              return (
                <div
                  key={product.id}
                  className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                    <div className="flex h-full items-center justify-center text-2xl text-muted-foreground/30">
                      🍽️
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col justify-between min-w-0">
                    <div>
                      <h4 className="text-sm font-medium text-foreground truncate">{product.name}</h4>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{product.description}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">${product.price.toFixed(2)}</span>
                      {business.is_open && product.is_available && (
                        justAdded ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success text-white">
                            <Check className="h-4 w-4" />
                          </div>
                        ) : inCart ? (
                          <Link
                            href="/cliente/cart"
                            className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                          >
                            <ShoppingBag className="h-3.5 w-3.5" />
                            En carrito
                          </Link>
                        ) : (
                          <button
                            onClick={() => handleAdd(product)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {isSameBusiness && itemCount > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-20 p-4 lg:bottom-0">
          <Link
            href="/cliente/cart"
            className="flex items-center justify-between rounded-xl bg-primary px-6 py-3.5 text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <ShoppingBag className="h-5 w-5" />
              Ver pedido ({itemCount})
            </span>
            <span className="text-sm font-semibold">
              ${items.reduce((sum, i) => sum + i.product.price * i.quantity, 0).toFixed(2)}
            </span>
          </Link>
        </div>
      )}
    </PageContainer>
  );
}
