'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPin, RefreshCw } from 'lucide-react';
import { BottomNavigation } from '@/components/ui/bottom-navigation';
import { Footer } from '@/components/ui/footer';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { DomiULogo, DomiUMark } from '@/components/brand/DomiULogo';
import { getBrowserClient } from '@/lib/db/supabase';

const navItems = [
  { label: 'Inicio', href: '/cliente', icon: <span className="text-lg">🏠</span> },
  { label: 'Pedidos', href: '/cliente/pedidos', icon: <span className="text-lg">📋</span> },
  { label: 'Solicitudes', href: '/cliente/solicitudes', icon: <span className="text-lg">📝</span> },
  { label: 'Soporte', href: '/soporte', icon: <span className="text-lg">💬</span> },
  { label: 'Perfil', href: '/cliente/perfil', icon: <span className="text-lg">👤</span> },
];

const ADDRESS_ONBOARDING_PATH = '/cliente/configuracion/direcciones';

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, profile, error, retrySession } = useAuth();
  const { itemCount } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const [checkingAddress, setCheckingAddress] = useState(true);

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

  if (isLoading || (profile && checkingAddress && !pathname.startsWith(ADDRESS_ONBOARDING_PATH))) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm space-y-5 text-center">
          <DomiULogo className="justify-center" markClassName="h-14 w-14" variant="dark" />
          <div className="mx-auto h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="mx-auto h-3 w-56 animate-pulse rounded bg-muted" />
          <p className="text-xs text-muted-foreground">Verificando tu ubicación de entrega…</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5">
        <section className="domiu-brand-surface w-full max-w-md rounded-3xl p-6 text-center">
          <DomiUMark className="mx-auto h-16 w-16" />
          <h1 className="mt-4 text-xl font-black">No pudimos abrir tu sesión</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error || 'Tu sesión finalizó. Inicia sesión nuevamente.'}</p>
          <button type="button" onClick={() => void retrySession()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20">
            <RefreshCw className="h-4 w-4" /> Reintentar
          </button>
          <Link href="/login" className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-border px-4 py-3 text-sm font-bold hover:border-primary/50 hover:text-primary">Ir al inicio de sesión</Link>
        </section>
      </div>
    );
  }

  return (
    <ChatProvider userId={profile.id} userRole="customer">
      <div className="min-h-[100dvh] max-w-full overflow-x-hidden bg-background pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <header className="sticky top-0 z-30 border-b border-primary/15 bg-[#1A1D21]/92 px-3 pt-[env(safe-area-inset-top)] shadow-[0_12px_32px_-24px_rgba(0,0,0,.9)] backdrop-blur-xl sm:px-6">
          <div className="flex h-14 items-center justify-between sm:h-16">
            <Link href="/cliente" className="flex min-w-0 items-center" aria-label="DomiU Magdalena - Inicio">
              <DomiULogo className="scale-[0.92] origin-left sm:scale-100" markClassName="h-9 w-9 sm:h-10 sm:w-10" variant="dark" />
            </Link>

            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
              <NotificationBell />
              <Link href="/cliente/configuracion" title="Configuración" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"><span className="text-lg">⚙️</span></Link>
              <Link href="/cliente/cart" title="Carrito" className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary">
                <span className="text-lg">🛒</span>
                {itemCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground">{itemCount > 9 ? '9+' : itemCount}</span>}
              </Link>
            </div>
          </div>
        </header>

        <main className="min-w-0 overflow-x-hidden px-3 sm:px-6">{children}</main>
        <div className="hidden lg:block"><Footer /></div>
        <BottomNavigation items={navItems} />
      </div>
    </ChatProvider>
  );
}
