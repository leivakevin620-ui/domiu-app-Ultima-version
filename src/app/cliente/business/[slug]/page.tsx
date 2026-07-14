'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageContainer } from '@/components/ui/page-container';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ProductCard } from '@/components/delivery/product-card';
import { ProductCustomizationDialog } from '@/components/delivery/product-customization-dialog';
import { marketplaceService, type MarketplaceBusiness, type MarketplaceProduct } from '@/services/marketplace';
import { useCart, type CartCustomization } from '@/contexts/CartContext';
import { ArrowLeft, ShoppingBag, Star, Clock, MapPin } from 'lucide-react';
import Link from 'next/link';

export default function BusinessPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { addItem, items, businessId, itemCount } = useCart();
  const [business, setBusiness] = useState<MarketplaceBusiness | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [customizing, setCustomizing] = useState<MarketplaceProduct | null>(null);

  useEffect(() => { (async () => { const biz = await marketplaceService.getBusinessBySlug(slug); if (!biz) return setLoading(false); setBusiness(biz); setProducts(await marketplaceService.getProducts(biz.id)); setLoading(false); })(); }, [slug]);
  if (loading) return <SkeletonCard />;
  if (!business) return <PageContainer><EmptyState title="Negocio no encontrado" description="El restaurante no existe o está inactivo." /></PageContainer>;

  const grouped = products.reduce<Record<string, MarketplaceProduct[]>>((result, product) => { const category = product.category_name || 'Otros'; (result[category] ??= []).push(product); return result; }, {});
  const sameBusiness = businessId === business.id;
  const cartTotal = sameBusiness ? items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) : 0;

  const handleAdd = (product: MarketplaceProduct) => {
    if (product.metadata?.product_type === 'wings') { setCustomizing(product); return; }
    addItem(product, business.id, business.name);
  };
  const confirmCustomization = (product: MarketplaceProduct, customization: CartCustomization, unitPrice: number) => addItem(product, business.id, business.name, { customization, unitPrice });

  return <div className="min-h-screen bg-background pb-32">
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-xl"><div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4"><button onClick={() => router.back()} className="rounded-xl p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></button><span className="truncate text-sm font-semibold">{business.name}</span><Link href="/cliente/cart" className="relative ml-auto rounded-xl p-2 hover:bg-muted"><ShoppingBag className="h-5 w-5" />{sameBusiness && itemCount > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{itemCount}</span>}</Link></div></header>
    <div className="h-52 bg-cover bg-center" style={business.banner_url ? { backgroundImage: `url(${business.banner_url})` } : undefined} />
    <PageContainer className="-mt-10 relative">
      <div className="mb-5 rounded-3xl border bg-card p-5 shadow-lg"><div className="flex gap-4"><div className="h-20 w-20 shrink-0 rounded-2xl bg-muted bg-cover bg-center" style={business.logo_url ? { backgroundImage: `url(${business.logo_url})` } : undefined} /><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{business.name}</h1><span className={`rounded-full px-2 py-1 text-xs font-semibold ${business.is_open ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>{business.is_open ? 'Abierto' : 'Cerrado'}</span></div><p className="mt-1 text-sm text-muted-foreground">{business.description}</p></div></div><div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground"><span className="flex items-center gap-1"><Star className="h-4 w-4" />{business.rating}</span><span className="flex items-center gap-1"><Clock className="h-4 w-4" />{business.delivery_time}</span><span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{business.distance ?? 'Santa Marta'}</span></div></div>
      {products.length === 0 ? <EmptyState title="Sin productos disponibles" description="Este negocio aún no tiene menú." /> : <div className="space-y-8">{Object.entries(grouped).map(([category, categoryProducts]) => <section key={category}><h2 className="mb-4 text-lg font-bold">{category}</h2><div className="grid gap-4 sm:grid-cols-2">{categoryProducts.map((product) => <ProductCard key={product.id} name={product.name} price={product.price} image={product.image_url ?? undefined} description={product.description} category={product.category_name} isAvailable={business.is_open && product.is_available} inCart={sameBusiness && items.some((item) => item.product.id === product.id)} onAdd={() => handleAdd(product)} onViewCart={() => router.push('/cliente/cart')} />)}</div></section>)}</div>}
    </PageContainer>
    {sameBusiness && itemCount > 0 && <Link href="/cliente/cart" className="fixed bottom-20 left-4 right-4 z-30 flex items-center justify-between rounded-2xl bg-primary p-4 font-bold text-primary-foreground shadow-xl lg:bottom-4 lg:left-auto lg:w-96"><span>Ver carrito ({itemCount})</span><span>${cartTotal.toLocaleString('es-CO')}</span></Link>}
    {customizing && <ProductCustomizationDialog product={customizing} open onClose={() => setCustomizing(null)} onConfirm={(customization, unitPrice) => confirmCustomization(customizing, customization, unitPrice)} />}
  </div>;
}
