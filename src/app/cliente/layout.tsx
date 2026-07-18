'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Menu, RefreshCw, Search, ShoppingCart, UserRound } from 'lucide-react';
import { BottomNavigation } from '@/components/ui/bottom-navigation';
import { Footer } from '@/components/ui/footer';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { DomiULogo, DomiUMark } from '@/components/brand/DomiULogo';
import { getBrowserClient } from '@/lib/db/supabase';

const navItems = [
  { label: 'Inicio', href: '/cliente', icon: <span className="text-lg">🏠</span> },
  { label: 'Pedidos', href: '/cliente/pedidos', icon: <span className="text-lg">📋</span> },
  { label: 'Buscar', href: '/cliente/search', icon: <Search className="h-5 w-5" /> },
  { label: 'Soporte', href: '/soporte', icon: <span className="text-lg">💬</span> },
  { label: 'Perfil', href: '/cliente/perfil', icon: <UserRound className="h-5 w-5" /> },
];

const ADDRESS_ONBOARDING_PATH = '/cliente/configuracion/direcciones';

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, profile, error, retrySession } = useAuth();
  const { itemCount } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const [checkingAddress, setCheckingAddress] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isLoading && !profile && !error) router.replace('/login');
  }, [error, isLoading, profile, router]);

  useEffect(() => {
    if (isLoading || !profile?.id) {
      if (!isLoading) setCheckingAddress(false);
      return;
    }

    let active = true;
    const checkExactAddress = async () => {
      setCheckingAddress(true);
      try {
        const supabase = getBrowserClient();
        const { data, error: addressError } = await supabase
          .from('addresses')
          .select('id')
          .eq('user_id', profile.id)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle();

        if (!active) return;
        if (addressError) {
          console.error('[CustomerOnboarding] No se pudo validar la dirección:', addressError);
          return;
        }
        if (!data && !pathname.startsWith(ADDRESS_ONBOARDING_PATH)) {
          router.replace(`${ADDRESS_ONBOARDING_PATH}?onboarding=1`);
        }
      } finally {
        if (active) setCheckingAddress(false);
      }
    };

    void checkExactAddress();
    return () => {
      active = false;
    };
  }, [isLoading, pathname, profile?.id, router]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    router.push(query ? `/cliente/search?q=${encodeURIComponent(query)}` : '/cliente/search');
  };

  if (isLoading || (profile && checkingAddress && !pathname.startsWith(ADDRESS_ONBOARDING_PATH))) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#F7F8FA] px-6 text-[#17191F]">
        <div className="w-full max-w-sm space-y-5 text-center">
          <DomiULogo className="justify-center" showTagline />
          <div className="mx-auto h-5 w-40 animate-pulse rounded-full bg-[#E4E7EC]" />
          <div className="mx-auto h-3 w-56 animate-pulse rounded-full bg-[#EEF0F3]" />
          <p className="text-xs text-[#68707D]">Verificando tu ubicación de entrega…</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#F7F8FA] px-5 text-[#17191F]">
        <section className="w-full max-w-md rounded-3xl border border-[#E4E7EC] bg-white p-6 text-center shadow-xl shadow-black/5">
          <DomiUMark className="mx-auto h-20 w-24" />
          <h1 className="mt-4 text-xl font-black">No pudimos abrir tu sesión</h1>
          <p className="mt-2 text-sm text-[#68707D]">{error || 'Tu sesión finalizó. Inicia sesión nuevamente.'}</p>
          <button type="button" onClick={() => void retrySession()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFD400] px-4 py-3 text-sm font-black text-[#17191F] shadow-lg shadow-[#FFD400]/25">
            <RefreshCw className="h-4 w-4" /> Reintentar
          </button>
          <Link href="/login" className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-[#DDE1E7] px-4 py-3 text-sm font-bold hover:border-[#FFD400]">Ir al inicio de sesión</Link>
        </section>
      </div>
    );
  }

  const displayName = profile.first_name?.trim() || 'Cliente';

  return (
    <ChatProvider userId={profile.id} userRole="customer">
      <div className="min-h-[100dvh] max-w-full overflow-x-hidden bg-[#F7F8FA] pb-[calc(5rem+env(safe-area-inset-bottom))] text-[#17191F] lg:pb-0 [--background:#F7F8FA] [--foreground:#17191F] [--card:#FFFFFF] [--card-foreground:#17191F] [--primary:#FFD400] [--primary-foreground:#17191F] [--muted:#EEF0F3] [--muted-foreground:#68707D] [--border:#E2E6EC]">
        <header className="sticky top-0 z-40 border-b border-[#E4E7EC] bg-white/95 pt-[env(safe-area-inset-top)] shadow-sm backdrop-blur-xl">
          <div className="mx-auto max-w-[1480px] px-3 sm:px-5 lg:px-7">
            <div className="flex h-16 items-center gap-2 sm:gap-4">
              <Link href="/cliente/perfil" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#343840] transition hover:bg-[#F2F4F7]" aria-label="Abrir perfil">
                <Menu className="h-6 w-6" />
              </Link>

              <Link href="/cliente" className="flex shrink-0 items-center" aria-label="DomiU Magdalena - Inicio">
                <DomiULogo className="origin-left scale-[0.88] sm:scale-100" />
              </Link>

              <Link href="/cliente/direcciones" className="hidden shrink-0 items-center gap-2 border-l border-[#E4E7EC] pl-4 text-sm font-bold text-[#292D34] hover:text-[#8A6C00] md:flex">
                <MapPin className="h-5 w-5 text-[#D6A900]" /> Santa Marta
              </Link>

              <form onSubmit={handleSearch} className="hidden min-w-0 flex-1 md:block">
                <div className="relative mx-auto max-w-3xl">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#777E89]" />
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Busca comercios, comidas, farmacias o productos…" className="h-11 w-full rounded-2xl border border-transparent bg-[#F3F5F7] pl-12 pr-4 text-sm font-medium text-[#20232A] outline-none placeholder:text-[#8A919D] focus:border-[#FFD400] focus:bg-white" />
                </div>
              </form>

              <div className="ml-auto flex shrink-0 items-center gap-1">
                <NotificationBell />
                <Link href="/cliente/perfil" className="hidden h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#343840] hover:bg-[#F2F4F7] sm:flex">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF3A3] text-xs font-black text-[#604D00]">{displayName.charAt(0).toUpperCase()}</span>
                  <span className="hidden xl:inline">{displayName}</span>
                </Link>
                <Link href="/cliente/cart" title="Carrito" className="relative flex h-10 w-10 items-center justify-center rounded-xl text-[#343840] hover:bg-[#F2F4F7]">
                  <ShoppingCart className="h-5 w-5" />
                  {itemCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-[#FFD400] px-1 text-[10px] font-black text-[#17191F]">{itemCount > 9 ? '9+' : itemCount}</span>}
                </Link>
              </div>
            </div>

            <form onSubmit={handleSearch} className="pb-3 md:hidden">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#777E89]" />
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Busca en DomiU…" className="h-11 w-full rounded-2xl border border-[#E4E7EC] bg-[#F6F7F9] pl-12 pr-4 text-sm font-medium outline-none focus:border-[#FFD400] focus:bg-white" />
              </div>
            </form>
          </div>
        </header>

        <main className="min-w-0 overflow-x-hidden">{children}</main>
        <div className="hidden lg:block"><Footer /></div>
        <BottomNavigation items={navItems} />
      </div>
    </ChatProvider>
  );
}
