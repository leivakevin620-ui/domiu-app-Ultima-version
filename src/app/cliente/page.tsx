'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bike,
  ChevronRight,
  Clock3,
  Coffee,
  MapPin,
  Pill,
  Search,
  ShoppingBasket,
  Sparkles,
  Star,
  Store,
  UtensilsCrossed,
} from 'lucide-react';
import { marketplaceService } from '@/services/marketplace';
import type { MarketplaceBusiness, MarketplaceCategory } from '@/services/marketplace';

const popularSearches = ['Hamburguesas', 'Pizza', 'Pollo', 'Almuerzos', 'Farmacia', 'Mercado'];

const serviceCards = [
  {
    title: 'Restaurantes',
    description: 'Comida local y tus platos favoritos',
    icon: UtensilsCrossed,
    href: '/cliente/search?q=restaurante',
    className: 'from-[#FFF1A3] to-[#FFD400]',
  },
  {
    title: 'Mercados',
    description: 'Productos para tu hogar',
    icon: ShoppingBasket,
    href: '/cliente/search?q=supermercado',
    className: 'from-[#E5F8E9] to-[#BDECC8]',
  },
  {
    title: 'Farmacias',
    description: 'Cuidado personal y medicamentos',
    icon: Pill,
    href: '/cliente/search?q=farmacia',
    className: 'from-[#E7F2FF] to-[#BCD9FF]',
  },
  {
    title: 'Café y postres',
    description: 'Antojos, bebidas y panadería',
    icon: Coffee,
    href: '/cliente/search?q=cafe',
    className: 'from-[#F7EBDD] to-[#EACFAE]',
  },
];

function deliveryLabel(value: string | undefined) {
  if (!value) return 'Tarifa según distancia';
  const normalized = value.toLowerCase();
  if (normalized.includes('gratis') || normalized === '$0' || normalized === '0') {
    return 'Tarifa según distancia';
  }
  return value;
}

function BusinessCard({ business }: { business: MarketplaceBusiness }) {
  const cover = business.banner_url || business.logo_url;

  return (
    <Link
      href={`/cliente/business/${business.slug}`}
      className="group min-w-0 overflow-hidden rounded-3xl border border-[#E4E7EC] bg-white shadow-[0_10px_32px_-24px_rgba(16,24,40,.38)] transition duration-200 hover:-translate-y-1 hover:border-[#F2C900] hover:shadow-[0_20px_45px_-25px_rgba(16,24,40,.42)]"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-[#FFF8D4] to-[#F1F3F6]">
        {cover ? (
          <img
            src={cover}
            alt={business.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Store className="h-12 w-12 text-[#C5A000]" />
          </div>
        )}

        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span className={business.is_open ? 'rounded-full bg-white/95 px-3 py-1 text-[11px] font-black text-[#087443] shadow-sm' : 'rounded-full bg-white/95 px-3 py-1 text-[11px] font-black text-[#667085] shadow-sm'}>
            {business.is_open ? 'Abierto' : 'Cerrado'}
          </span>
          {business.is_featured && (
            <span className="rounded-full bg-[#FFD400] px-3 py-1 text-[11px] font-black text-[#17191F] shadow-sm">Destacado</span>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#ECEEF2] bg-white shadow-sm">
            {business.logo_url ? (
              <img src={business.logo_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-1" />
            ) : (
              <Store className="h-6 w-6 text-[#B38C00]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-base font-black text-[#1D2026]">{business.name}</h3>
                <p className="mt-0.5 truncate text-xs font-medium text-[#737B87]">{business.category_name || 'Comercio local'}</p>
              </div>
              <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-[#A4AAB3] transition group-hover:translate-x-0.5 group-hover:text-[#9C7A00]" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-[#555D68]">
          <span className="inline-flex items-center gap-1">
            <Star className="h-4 w-4 fill-[#FFB800] text-[#FFB800]" />
            {Number(business.rating || 0).toFixed(1)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-4 w-4 text-[#707782]" />
            {business.delivery_time || '30-45 min'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Bike className="h-4 w-4 text-[#707782]" />
            {deliveryLabel(business.delivery_fee)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function ClienteHome() {
  const [businesses, setBusinesses] = useState<MarketplaceBusiness[]>([]);
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    Promise.all([marketplaceService.getBusinesses({}), marketplaceService.getCategories()])
      .then(([businessData, categoryData]) => {
        setBusinesses(businessData);
        setCategories(categoryData);
      })
      .catch(() => {
        setBusinesses([]);
        setCategories([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredBusinesses = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    return businesses.filter((business) => {
      const matchesCategory = selectedCategory === 'all' || business.category_id === selectedCategory;
      const matchesQuery = !normalizedQuery || `${business.name} ${business.category_name} ${business.description}`.toLocaleLowerCase('es').includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [businesses, query, selectedCategory]);

  const featured = businesses.filter((business) => business.is_featured).slice(0, 10);
  const categoryCount = categories.reduce((sum, category) => sum + category.business_count, 0);

  return (
    <div className="pb-12">
      <section className="border-b border-[#E7E9ED] bg-white">
        <div className="mx-auto grid max-w-[1480px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.2fr_.8fr] lg:px-8 lg:py-12">
          <div className="rounded-[2rem] bg-gradient-to-br from-[#FFF8D6] via-[#FFF0A0] to-[#FFD400] p-6 shadow-[0_24px_70px_-38px_rgba(104,83,0,.55)] sm:p-9">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#6D5700] backdrop-blur">
              <Sparkles className="h-4 w-4" /> Marketplace local de Santa Marta
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.045em] text-[#15171B] sm:text-5xl lg:text-6xl">
              Todo lo que necesitas, cerca de ti.
            </h1>
            <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-[#4C4B43] sm:text-lg">
              Encuentra restaurantes, supermercados, farmacias y comercios locales organizados en una sola experiencia DomiU.
            </p>

            <div className="mt-7 rounded-2xl bg-white p-2 shadow-[0_14px_40px_-24px_rgba(30,30,20,.35)]">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex h-12 shrink-0 items-center gap-2 rounded-xl bg-[#F7F8FA] px-4 text-sm font-black text-[#343840]">
                  <MapPin className="h-5 w-5 text-[#C49A00]" /> Santa Marta
                </div>
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7C838D]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="¿Qué quieres pedir hoy?"
                    className="h-12 w-full rounded-xl bg-[#F7F8FA] pl-12 pr-4 text-sm font-semibold text-[#22252B] outline-none placeholder:text-[#858C96] focus:bg-white focus:ring-2 focus:ring-[#FFD400]"
                  />
                </div>
                <button type="button" onClick={() => document.getElementById('comercios')?.scrollIntoView({ behavior: 'smooth' })} className="h-12 rounded-xl bg-[#17191F] px-6 text-sm font-black text-white transition hover:bg-[#2A2E35]">
                  Buscar
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {popularSearches.map((term) => (
                <button key={term} type="button" onClick={() => setQuery(term)} className="rounded-full border border-black/10 bg-white/70 px-3.5 py-2 text-xs font-black text-[#45484E] transition hover:border-black/25 hover:bg-white">
                  {term}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {serviceCards.map(({ title, description, icon: Icon, href, className }) => (
              <Link key={title} href={href} className={`group flex min-h-44 flex-col justify-between rounded-3xl bg-gradient-to-br ${className} p-5 text-[#1B1D21] transition hover:-translate-y-1 hover:shadow-xl`}>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/75 shadow-sm">
                  <Icon className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-lg font-black">{title}</h2>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-black/60">{description}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-black">Explorar <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1480px] space-y-10 px-4 py-9 sm:px-6 lg:px-8">
        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#A17D00]">Explora por categoría</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[#1B1E24]">¿Qué necesitas hoy?</h2>
            </div>
            <span className="hidden text-sm font-bold text-[#747B86] sm:block">{categoryCount || businesses.length} comercios disponibles</span>
          </div>

          <div className="mt-5 flex gap-3 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button type="button" onClick={() => setSelectedCategory('all')} className={selectedCategory === 'all' ? 'flex min-w-28 flex-col items-center rounded-2xl border border-[#FFD400] bg-[#FFF8D0] p-4 shadow-sm' : 'flex min-w-28 flex-col items-center rounded-2xl border border-[#E3E6EB] bg-white p-4 shadow-sm transition hover:border-[#FFD400]'}>
              <span className="text-3xl">✨</span>
              <span className="mt-2 text-sm font-black">Todos</span>
              <span className="mt-1 text-[11px] font-bold text-[#7B828C]">{businesses.length}</span>
            </button>
            {categories.map((category) => (
              <button key={category.id} type="button" onClick={() => setSelectedCategory(category.id)} className={selectedCategory === category.id ? 'flex min-w-28 flex-col items-center rounded-2xl border border-[#FFD400] bg-[#FFF8D0] p-4 shadow-sm' : 'flex min-w-28 flex-col items-center rounded-2xl border border-[#E3E6EB] bg-white p-4 shadow-sm transition hover:border-[#FFD400]'}>
                <span className="text-3xl">{category.icon || '🍽️'}</span>
                <span className="mt-2 max-w-24 truncate text-sm font-black">{category.name}</span>
                <span className="mt-1 text-[11px] font-bold text-[#7B828C]">{category.business_count}</span>
              </button>
            ))}
          </div>
        </section>

        {featured.length > 0 && selectedCategory === 'all' && !query && (
          <section>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#A17D00]">Recomendados</p>
                <h2 className="mt-1 text-2xl font-black text-[#1B1E24]">Los más destacados</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {featured.map((business) => <BusinessCard key={business.id} business={business} />)}
            </div>
          </section>
        )}

        <section id="comercios" className="scroll-mt-36">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#A17D00]">Marketplace DomiU</p>
              <h2 className="mt-1 text-2xl font-black text-[#1B1E24]">Todos los comercios</h2>
              <p className="mt-1 text-sm font-medium text-[#717985]">
                {filteredBusinesses.length} resultado{filteredBusinesses.length === 1 ? '' : 's'} disponibles.
              </p>
            </div>
            {(query || selectedCategory !== 'all') && (
              <button type="button" onClick={() => { setQuery(''); setSelectedCategory('all'); }} className="rounded-xl border border-[#DDE1E7] bg-white px-4 py-2 text-sm font-black text-[#3A3F47] hover:border-[#FFD400]">
                Limpiar filtros
              </button>
            )}
          </div>

          {loading ? (
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => <div key={index} className="aspect-[4/3] animate-pulse rounded-3xl bg-[#E7E9ED]" />)}
            </div>
          ) : filteredBusinesses.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-dashed border-[#CBD0D8] bg-white p-10 text-center">
              <Store className="mx-auto h-10 w-10 text-[#A6ADB7]" />
              <h3 className="mt-4 text-lg font-black">No encontramos comercios con esos filtros</h3>
              <p className="mt-1 text-sm text-[#747C87]">Prueba otra categoría o cambia el término de búsqueda.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredBusinesses.map((business) => <BusinessCard key={business.id} business={business} />)}
            </div>
          )}
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Link href="/cliente/solicitudes/negocio" className="group flex items-center gap-5 rounded-3xl bg-[#17191F] p-6 text-white shadow-xl shadow-black/10 transition hover:-translate-y-1">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#FFD400] text-[#17191F]"><Store className="h-8 w-8" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FFD400]">Comercios aliados</p>
              <h2 className="mt-1 text-xl font-black">Registra tu negocio en DomiU</h2>
              <p className="mt-1 text-sm text-white/65">Vende en línea y recibe pedidos desde tu propio panel.</p>
            </div>
            <ChevronRight className="h-6 w-6 transition group-hover:translate-x-1" />
          </Link>

          <Link href="/cliente/solicitudes/repartidor" className="group flex items-center gap-5 rounded-3xl border border-[#E1E4E9] bg-white p-6 shadow-xl shadow-black/5 transition hover:-translate-y-1 hover:border-[#FFD400]">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#FFF3A3] text-[#7A6000]"><Bike className="h-8 w-8" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#A17D00]">Repartidores</p>
              <h2 className="mt-1 text-xl font-black">Trabaja entregando con DomiU</h2>
              <p className="mt-1 text-sm text-[#747C87]">Solicita acceso y administra tus entregas desde la aplicación.</p>
            </div>
            <ChevronRight className="h-6 w-6 text-[#8C939D] transition group-hover:translate-x-1" />
          </Link>
        </section>
      </div>
    </div>
  );
}
