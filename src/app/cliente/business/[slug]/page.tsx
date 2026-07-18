'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { PageContainer } from '@/components/ui/page-container';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ProductPlaceholder } from '@/components/ui/placeholders';
import { ProductCustomizationDialog } from '@/components/delivery/product-customization-dialog';
import { marketplaceService, type MarketplaceBusiness, type MarketplaceProduct } from '@/services/marketplace';
import { useCart, type CartCustomization } from '@/contexts/CartContext';
import { formatCOP } from '@/lib/formatters/currency';
import { ArrowLeft, Check, Clock, MapPin, Plus, ShoppingBag, Star, Store, X } from 'lucide-react';
import Link from 'next/link';

const CATEGORY_ICONS: Record<string, string> = {
  'Alitas ahumadas': '🍗',
  Alitas: '🍗',
  Sándwiches: '🥪',
  Sandwiches: '🥪',
  Hamburguesas: '🍔',
  Tenders: '🍗',
  Adicionales: '🍟',
  Bebidas: '🥤',
  Cervezas: '🍺',
  Pizzas: '🍕',
  Pastas: '🍝',
  Panadería: '🥐',
  Despensa: '🛒',
  'Lácteos y huevos': '🥛',
  'Frutas y verduras': '🥬',
  'Dolor y bienestar': '💊',
  'Primeros auxilios': '🩹',
  Licores: '🍾',
  Vinos: '🍷',
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
  const [detailProduct, setDetailProduct] = useState<MarketplaceProduct | null>(null);
  const [activeCategory, setActiveCategory] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const biz = await marketplaceService.getBusinessBySlug(slug);
        if (!active || !biz) return;
        setBusiness(biz);
        const menu = await marketplaceService.getProducts(biz.id);
        if (!active) return;
        setProducts(menu);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [slug]);

  const grouped = useMemo(
    () => products.reduce<Record<string, MarketplaceProduct[]>>((result, product) => {
      const category = product.category_name || 'Otros';
      (result[category] ??= []).push(product);
      return result;
    }, {}),
    [products],
  );

  const categories = useMemo(() => Object.entries(grouped), [grouped]);

  useEffect(() => {
    if (!activeCategory && categories[0]?.[0]) setActiveCategory(categories[0][0]);
  }, [activeCategory, categories]);

  if (loading) return <SkeletonCard />;
  if (!business) return <PageContainer><EmptyState title="Negocio no encontrado" description="El comercio no existe o está inactivo." /></PageContainer>;

  const sameBusiness = businessId === business.id;
  const cartTotal = sameBusiness ? items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) : 0;
  const isPreview = business.catalog_status !== 'live';
  const isLiquorStore = business.business_type === 'liquor_store';

  const handleAdd = (product: MarketplaceProduct) => {
    setDetailProduct(null);
    if (product.metadata?.product_type === 'wings') {
      setCustomizing(product);
      return;
    }
    addItem(product, business.id, business.name);
  };

  const confirmCustomization = (product: MarketplaceProduct, customization: CartCustomization, unitPrice: number) => {
    addItem(product, business.id, business.name, { customization, unitPrice });
  };

  const selectCategory = (category: string) => {
    setActiveCategory(category);
    document.getElementById(sectionId(category))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-32">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:px-4">
          <button onClick={() => router.back()} className="rounded-xl p-2 hover:bg-muted" aria-label="Volver"><ArrowLeft className="h-5 w-5" /></button>
          <span className="truncate text-sm font-semibold">{business.name}</span>
          {!isPreview && <Link href="/cliente/cart" className="relative ml-auto rounded-xl p-2 hover:bg-muted"><ShoppingBag className="h-5 w-5" />{sameBusiness && itemCount > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{itemCount}</span>}</Link>}
        </div>
      </header>

      {business.banner_url ? (
        <div className="h-36 bg-muted bg-cover bg-center sm:h-52" style={{ backgroundImage: `url(${business.banner_url})` }} />
      ) : (
        <div className="relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br from-[#FFF9DC] via-[#FFF0A3] to-[#FFD400] sm:h-52">
          <div className="absolute -left-16 -top-20 h-56 w-56 rounded-full border-[34px] border-white/35" />
          <Store className="h-12 w-12 text-[#6E5700]" />
        </div>
      )}

      <PageContainer className="relative -mt-7 px-0 sm:-mt-10 sm:px-4">
        <section className="mx-3 mb-4 rounded-2xl border bg-card p-4 shadow-lg sm:mx-0 sm:mb-5 sm:rounded-3xl sm:p-5">
          <div className="flex gap-3 sm:gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-white p-1 shadow-sm sm:h-20 sm:w-20">
              {business.logo_url ? <img src={business.logo_url} alt={`Logo de ${business.name}`} className="h-full w-full object-contain" /> : <Store className="h-7 w-7 text-[#B38C00]" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-black sm:text-2xl">{business.name}</h1>
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold sm:text-xs ${isPreview ? 'bg-[#17191F] text-white' : business.is_open ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                  {isPreview ? 'Catálogo de referencia' : business.is_open ? 'Abierto' : 'Cerrado'}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground sm:text-sm">{business.description}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {!isPreview && <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" />{business.rating}</span>}
                {!isPreview && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{business.delivery_time}</span>}
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{business.distance ?? 'Santa Marta'}</span>
              </div>
            </div>
          </div>

          {isPreview && (
            <div className="mt-4 rounded-2xl border border-[#F1D45A] bg-[#FFF8D0] p-4 text-sm font-semibold leading-relaxed text-[#665100]">
              El catálogo ya contiene productos, precios e imágenes digitales de referencia. Los pedidos permanecerán deshabilitados hasta que el propietario confirme marcas, inventario, precios e imágenes oficiales.
            </div>
          )}
          {isLiquorStore && (
            <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm font-semibold text-violet-950">
              Venta exclusiva para mayores de 18 años. La entrega requerirá verificación de identidad.
            </div>
          )}
        </section>

        {products.length === 0 ? (
          <div className="px-3 sm:px-0">
            <EmptyState
              title={isPreview ? 'Catálogo en preparación' : 'Sin productos disponibles'}
              description={isPreview ? 'DomiU está estructurando este catálogo antes de habilitar pedidos.' : 'Este negocio aún no tiene menú.'}
            />
          </div>
        ) : (
          <>
            <nav className="sticky top-14 z-30 mb-5 border-y bg-background/96 py-3 backdrop-blur-xl sm:rounded-2xl sm:border">
              <div className="flex snap-x gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-4">
                {categories.map(([category, categoryProducts]) => {
                  const image = categoryProducts.find((product) => product.image_url)?.image_url;
                  const selected = activeCategory === category;
                  return (
                    <button key={category} type="button" onClick={() => selectCategory(category)} className="w-[72px] shrink-0 snap-start text-center">
                      <span className={`relative mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border-2 bg-muted shadow-sm transition ${selected ? 'border-primary ring-2 ring-primary/15' : 'border-transparent'}`}>
                        {image ? <Image src={image} alt={category} fill sizes="56px" className="object-cover" /> : <span className="text-2xl">{CATEGORY_ICONS[category] || '🍽️'}</span>}
                      </span>
                      <span className={`mt-1.5 block line-clamp-2 text-[10px] font-bold leading-tight ${selected ? 'text-primary' : 'text-foreground'}`}>{category}</span>
                    </button>
                  );
                })}
              </div>
            </nav>

            <div className="space-y-8 px-3 sm:px-0">
              {categories.map(([category, categoryProducts]) => (
                <section id={sectionId(category)} key={category} className="scroll-mt-36">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div><p className="text-[10px] font-bold uppercase tracking-widest text-primary">{CATEGORY_ICONS[category] || '🍽️'} Categoría</p><h2 className="mt-0.5 text-lg font-black sm:text-xl">{category}</h2></div>
                    <span className="text-[10px] text-muted-foreground">{categoryProducts.length} productos</span>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {categoryProducts.map((product) => {
                      const inCart = sameBusiness && items.some((item) => item.product.id === product.id);
                      const available = business.is_open && product.is_available;
                      const referenceImage = product.metadata?.image_status === 'reference';
                      return (
                        <article key={product.id} onClick={() => setDetailProduct(product)} className={`group flex cursor-pointer gap-3 rounded-2xl border bg-card p-3 shadow-sm transition active:scale-[0.99] sm:hover:border-primary/40 sm:hover:shadow-md ${!available ? 'opacity-75' : ''}`}>
                          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-28 sm:w-28">
                            {product.image_url ? <Image src={product.image_url} alt={product.name} fill sizes="112px" className="object-cover" /> : <ProductPlaceholder />}
                            {referenceImage && <span className="absolute bottom-1 left-1 rounded-md bg-black/75 px-1.5 py-1 text-[8px] font-bold text-white">Imagen digital</span>}
                            {!available && <div className="absolute right-1 top-1 rounded-md bg-black/70 px-1.5 py-1 text-[8px] font-bold text-white">No habilitado</div>}
                          </div>

                          <div className="flex min-w-0 flex-1 flex-col">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">{product.category_name}</p>
                            <h3 className="mt-0.5 line-clamp-2 text-sm font-black leading-tight sm:text-base">{product.name}</h3>
                            {product.description && <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">{product.description}</p>}
                            <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                              <div><span className="block text-base font-black sm:text-lg">{formatCOP(product.price)}</span>{isPreview && <span className="text-[9px] font-semibold text-muted-foreground">Precio de referencia</span>}</div>
                              {available && (
                                <button type="button" onClick={(event) => { event.stopPropagation(); handleAdd(product); }} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ${inCart ? 'bg-success text-white' : 'bg-primary text-primary-foreground'}`} aria-label={`Agregar ${product.name}`}>
                                  {inCart ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </PageContainer>

      {sameBusiness && itemCount > 0 && !isPreview && <Link href="/cliente/cart" className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-3 right-3 z-40 flex items-center justify-between rounded-2xl bg-primary p-4 font-bold text-primary-foreground shadow-xl lg:bottom-4 lg:left-auto lg:right-4 lg:w-96"><span>Ver carrito ({itemCount})</span><span>{formatCOP(cartTotal)}</span></Link>}

      {detailProduct && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" onClick={() => setDetailProduct(null)}>
          <section className="max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-card shadow-2xl sm:max-w-lg sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
            <div className="relative h-56 w-full overflow-hidden bg-muted sm:h-72">
              {detailProduct.image_url ? <Image src={detailProduct.image_url} alt={detailProduct.name} fill sizes="(max-width: 640px) 100vw, 512px" className="object-cover" priority /> : <ProductPlaceholder />}
              {detailProduct.metadata?.image_status === 'reference' && <span className="absolute bottom-3 left-3 rounded-lg bg-black/75 px-2 py-1 text-[10px] font-bold text-white">Imagen digital de referencia</span>}
              <button type="button" onClick={() => setDetailProduct(null)} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-5">
              <div><p className="text-xs font-bold uppercase tracking-wider text-primary">{detailProduct.category_name || 'Producto'}</p><h2 className="mt-1 text-2xl font-black">{detailProduct.name}</h2></div>
              <p className="text-sm leading-relaxed text-muted-foreground">{detailProduct.description || 'Producto disponible para pedir en DomiU.'}</p>
              {isPreview && <p className="rounded-xl bg-[#FFF8D0] p-3 text-xs font-semibold text-[#665100]">El precio, el inventario y la presentación deben ser confirmados por el comercio antes de habilitar pedidos.</p>}
              <div className="flex items-center justify-between border-t pt-4"><span className="text-2xl font-black">{formatCOP(detailProduct.price)}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${business.is_open && detailProduct.is_available ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>{business.is_open && detailProduct.is_available ? 'Disponible' : 'No habilitado'}</span></div>
              {business.is_open && detailProduct.is_available && <button type="button" onClick={() => handleAdd(detailProduct)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-sm font-black text-primary-foreground"><Plus className="h-5 w-5" />{detailProduct.metadata?.product_type === 'wings' ? 'Elegir opciones' : 'Agregar al carrito'}</button>}
            </div>
          </section>
        </div>
      )}

      {customizing && <ProductCustomizationDialog product={customizing} open onClose={() => setCustomizing(null)} onConfirm={(customization, unitPrice) => confirmCustomization(customizing, customization, unitPrice)} />}
    </div>
  );
}
