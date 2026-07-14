'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BottomNavigation } from '@/components/ui/bottom-navigation';
import { Footer } from '@/components/ui/footer';
import { SkeletonCard } from '@/components/ui/skeleton';
import { NotificationBell } from '@/components/notifications/NotificationBell';

const navItems = [
  { label: 'Inicio', href: '/cliente', icon: <span className="text-lg">🏠</span> },
  { label: 'Pedidos', href: '/cliente/pedidos', icon: <span className="text-lg">📋</span> },
  { label: 'Solicitudes', href: '/cliente/solicitudes', icon: <span className="text-lg">📝</span> },
  { label: 'Soporte', href: '/soporte', icon: <span className="text-lg">💬</span> },
  { label: 'Perfil', href: '/cliente/perfil', icon: <span className="text-lg">👤</span> },
];

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, profile } = useAuth();
  const { itemCount } = useCart();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !profile) {
      router.replace('/login');
    }
  }, [isLoading, profile, router]);

  if (isLoading) return <SkeletonCard />;
  if (!profile) return null;

  return (
    <ChatProvider userId={profile.id} userRole="customer">
      <div className="min-h-screen bg-background pb-16 lg:pb-0">
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <Link href="/cliente" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                D
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">DomiU</h2>
            </Link>

            <div className="flex items-center gap-1">
              <NotificationBell />

              <Link
                href="/cliente/configuracion"
                title="Configuración"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span className="text-lg">⚙️</span>
              </Link>

              <Link
                href="/cliente/cart"
                title="Carrito"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span className="text-lg">🛒</span>
                {itemCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </header>

        <main className="px-4 sm:px-6">{children}</main>
        <Footer />
        <BottomNavigation items={navItems} />
      </div>
    </ChatProvider>
  );
}
