'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { marketplaceService, MarketplaceBusiness, MarketplaceCategory } from '@/services/marketplace';
import { Search, MapPin, ChevronRight, Star, Clock, Shield, Zap, CreditCard, Smartphone, Heart, ArrowRight } from 'lucide-react';

const CATEGORIES_HARDCODED = [
  { name: 'Comida Rápida', icon: '🍔', slug: 'comida-rapida' },
  { name: 'Pizza', icon: '🍕', slug: 'pizza' },
  { name: 'Sushi', icon: '🍣', slug: 'sushi' },
  { name: 'Café', icon: '☕', slug: 'cafe' },
  { name: 'Saludable', icon: '🥗', slug: 'saludable' },
  { name: 'Mexicana', icon: '🌮', slug: 'mexicana' },
  { name: 'Helados', icon: '🍦', slug: 'helados' },
  { name: 'Mariscos', icon: '🦐', slug: 'mariscos' },
  { name: 'Italiana', icon: '🍝', slug: 'italiana' },
  { name: 'Asiática', icon: '🥟', slug: 'asiatica' },
  { name: 'Postres', icon: '🧁', slug: 'postres' },
  { name: 'Bebidas', icon: '🧋', slug: 'bebidas' },
];

const HOW_IT_WORKS = [
  { step: '1', title: 'Elige tu comida', desc: 'Explora restaurantes y platos cerca de ti', icon: '📱' },
  { step: '2', title: 'Haz tu pedido', desc: 'Personaliza y paga seguro desde la app', icon: '🛒' },
  { step: '3', title: 'Recibe en casa', desc: 'Seguimiento en tiempo real hasta tu puerta', icon: '🚀' },
];

const STATS = [
  { value: '50+', label: 'Restaurantes' },
  { value: '1,000+', label: 'Pedidos diarios' },
  { value: '4.8', label: 'Rating promedio' },
  { value: '15', label: 'Minutos promedio' },
];

const TESTIMONIALS = [
  { name: 'María García', role: 'Cliente frecuente', avatar: '👩', text: 'DomiU me salva cuando no quiero cocinar. La comida llega rápido y caliente.' },
  { name: 'Carlos Mendoza', role: 'Repartidor', avatar: '👨', text: 'Trabajar con DomiU me ha dado flexibilidad y buenos ingresos. Las propinas ayudan mucho.' },
  { name: 'Ana Martínez', role: 'Dueña de restaurante', avatar: '👩‍🍳', text: 'DomiU ha duplicado mis ventas. La plataforma es fácil de usar y el soporte es excelente.' },
];

const FEATURES_LIST = [
  { icon: Zap, title: 'Entrega rápida', desc: 'Promedio de 15 min en Santa Marta' },
  { icon: Shield, title: 'Pago seguro', desc: 'Datos protegidos con encriptación' },
  { icon: CreditCard, title: 'Sin efectivo', desc: 'Paga con tarjeta, Nequi o Daviplata' },
  { icon: Smartphone, title: 'Fácil de usar', desc: 'App intuitiva para todos' },
  { icon: Heart, title: 'Mejores precios', desc: 'Ofertas exclusivas cada semana' },
  { icon: MapPin, title: 'Cobertura total', desc: 'Santa Marta y áreas cercanas' },
];

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, profile, isLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [featured, setFeatured] = useState<MarketplaceBusiness[]>([]);
  const [recommended, setRecommended] = useState<MarketplaceBusiness[]>([]);

  useEffect(() => {
    if (isAuthenticated && profile && !isLoading) {
      const dashboardMap: Record<string, string> = {
        customer: '/cliente',
        merchant: '/negocio',
        courier: '/repartidor',
        admin: '/admin',
      };
      router.push(dashboardMap[profile.role] || '/cliente');
    }
  }, [isAuthenticated, profile, isLoading, router]);

  useEffect(() => {
    const load = async () => {
      try {
        const [cats, feat, rec] = await Promise.all([
          marketplaceService.getCategories(),
          marketplaceService.getFeaturedBusinesses(),
          marketplaceService.getRecommendedBusinesses(),
        ]);
        setCategories(cats);
        setFeatured(feat);
        setRecommended(rec);
      } catch {
        // silently fail - static content still shows
      }
    };
    load();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/cliente?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground animate-pulse">
            D
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Cargando...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Redirigiendo...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              D
            </div>
            <span className="text-lg font-bold text-foreground">DomiU</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--color-primary)_0%,_transparent_70%)] opacity-[0.08]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background to-background" />
        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8 lg:pb-32 lg:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground">
                Santa Marta, Magdalena
              </span>
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              La comida que amas,{' '}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                en tu puerta
              </span>
            </h1>
            <p className="mx-auto mb-8 max-w-xl text-base text-muted-foreground sm:text-lg">
              Descubre los mejores restaurantes de Santa Marta. Pide online y recibe en minutos.
            </p>

            {/* Search + Address */}
            <div className="mx-auto max-w-2xl">
              <form onSubmit={handleSearch} className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-lg shadow-primary/5">
                <div className="flex items-center gap-2 border-r border-border px-3 py-1">
                  <MapPin className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Santa Marta</span>
                </div>
                <div className="flex flex-1 items-center gap-2 px-1">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Busca un restaurante o plato..."
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Buscar</span>
                </button>
              </form>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>Populares:</span>
                {['Pizza', 'Sushi', 'Hamburguesas', 'Café'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => router.push(`/cliente?search=${encodeURIComponent(tag)}`)}
                    className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:text-foreground transition-all"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Bar */}
      <section className="border-y border-border/40 bg-card/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 divide-x divide-border/40 md:grid-cols-6">
            {FEATURES_LIST.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex items-center gap-3 px-4 py-4 md:py-5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/5">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">{f.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">Categorías</h2>
              <p className="mt-1 text-sm text-muted-foreground">Encuentra lo que se te antoje</p>
            </div>
            {categories.length > 0 && (
              <Link href="/cliente" className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Ver todo <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6">
            {(categories.length > 0 ? categories : CATEGORIES_HARDCODED as any).slice(0, 12).map((cat: any) => (
              <Link
                key={cat.id || cat.name}
                href={`/cliente?category=${cat.id || cat.slug}`}
                className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/20 hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-xl transition-all group-hover:bg-primary/10 group-hover:scale-110">
                  {cat.icon}
                </div>
                <span className="text-xs font-medium text-foreground text-center leading-tight">{cat.name}</span>
                {cat.business_count !== undefined && (
                  <span className="text-[10px] text-muted-foreground">{cat.business_count} negocios</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Businesses */}
      {featured.length > 0 && (
        <section className="bg-card/30 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground sm:text-2xl">Destacados</h2>
                <p className="mt-1 text-sm text-muted-foreground">Los mejores calificados de Santa Marta</p>
              </div>
              <Link href="/cliente" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Ver todo <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((biz) => (
                <Link
                  key={biz.id}
                  href={`/cliente/negocio/${biz.slug}`}
                  className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/20 hover:shadow-lg hover:-translate-y-0.5"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-lg font-bold text-primary">
                      {biz.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{biz.name}</p>
                      <p className="text-xs text-muted-foreground">{biz.category_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-warning" fill="currentColor" />
                      {biz.rating.toFixed(1)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {biz.delivery_time}
                    </span>
                    <span className="ml-auto font-medium text-primary">${parseFloat(biz.delivery_fee.replace('$', '')).toFixed(1)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recommended */}
      {recommended.length > 0 && (
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground sm:text-2xl">Recomendados</h2>
                <p className="mt-1 text-sm text-muted-foreground">Basado en tu ubicación</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recommended.map((biz) => (
                <Link
                  key={biz.id}
                  href={`/cliente/negocio/${biz.slug}`}
                  className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/20 hover:shadow-lg hover:-translate-y-0.5"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-lg font-bold text-primary">
                      {biz.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{biz.name}</p>
                      <p className="text-xs text-muted-foreground">{biz.category_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-warning" fill="currentColor" />
                      {biz.rating.toFixed(1)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {biz.delivery_time}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How It Works */}
      <section className="border-t border-border/40 bg-card/30 py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">¿Cómo funciona?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Tres pasos para disfrutar tu comida</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {HOW_IT_WORKS.map((item, idx) => (
              <div key={item.title} className="relative rounded-xl border border-border bg-card p-6 text-center">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-md">
                  {item.step}
                </div>
                <div className="mt-2 mb-4 text-3xl">{item.icon}</div>
                <h3 className="mb-1 text-sm font-semibold text-foreground">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
                {idx < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden sm:block absolute -right-3 top-1/2 -translate-y-1/2 text-muted-foreground/30">
                    <ChevronRight className="h-5 w-5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-card p-6 text-center">
                <p className="text-2xl font-bold text-foreground sm:text-3xl">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Promo CTA */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/10 p-8 sm:p-12">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--color-primary)_0%,_transparent_60%)] opacity-[0.05]" />
            <div className="relative">
              <div className="max-w-lg">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Nuevo en DomiU</p>
                <h2 className="mb-3 text-2xl font-bold text-foreground sm:text-3xl">
                  Primer pedido sin costo de envío
                </h2>
                <p className="mb-6 text-sm text-muted-foreground">
                  Usa el código <span className="font-bold text-foreground">DOMIU15</span> en tu primer pedido y recibe el envío totalmente gratis. Válido en todos los restaurantes.
                </p>
                <Link
                  href="/register"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
                >
                  Ordenar ahora <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-t border-border/40 bg-card/30 py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">Lo que dicen nuestros usuarios</h2>
            <p className="mt-2 text-sm text-muted-foreground">Miles de personas confían en DomiU</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="rounded-xl border border-border bg-card p-6">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/5 text-lg">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-3 text-2xl font-bold text-foreground sm:text-3xl">
            ¿Listo para pedir?
          </h2>
          <p className="mb-8 text-sm text-muted-foreground">
            Únete a miles de clientes en Santa Marta que ya disfrutan DomiU
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
            >
              Crear cuenta gratis <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-6 text-sm font-semibold text-foreground transition-all hover:bg-card/80"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                  D
                </div>
                <span className="text-base font-bold text-foreground">DomiU</span>
              </Link>
              <p className="text-xs text-muted-foreground leading-relaxed">
                La plataforma de delivery más rápida de Santa Marta. Conectamos restaurantes, clientes y repartidores.
              </p>
            </div>
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground">Descubre</h4>
              <ul className="space-y-2">
                {['Restaurantes', 'Categorías', 'Ofertas', 'Ciudades'].map((item) => (
                  <li key={item}>
                    <Link href="/cliente" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground">Legal</h4>
              <ul className="space-y-2">
                {['Términos', 'Privacidad', 'Cookies', 'Trabaja con nosotros'].map((item) => (
                  <li key={item}>
                    <Link href="/terminos" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground">Contacto</h4>
              <ul className="space-y-2">
                <li className="text-xs text-muted-foreground">Santa Marta, Magdalena</li>
                <li className="text-xs text-muted-foreground">hola@domiu.app</li>
                <li className="text-xs text-muted-foreground">+57 300 123 4567</li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-border/40 pt-6 text-center">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} DomiU. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
