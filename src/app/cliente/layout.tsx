'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

import { useCart } from '@/contexts/CartContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BottomNavigation } from '@/components/ui/bottom-navigation';
import { Footer } from '@/components/ui/footer';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Home, ClipboardList, Heart, User, ShoppingBag, Ticket } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';

const navItems = [
  { label: 'Inicio', href: '/cliente', icon: <Home className="h-5 w-5" /> },
  { label: 'Pedidos', href: '/cliente/pedidos', icon: <ClipboardList className="h-5 w-5" /> },
  { label: 'Cupones', href: '/cliente/cupones', icon: <Ticket className="h-5 w-5" /> },
  { label: 'Favoritos', href: '/cliente/favoritos', icon: <Heart className="h-5 w-5" /> },
  { label: 'Perfil', href: '/cliente/perfil', icon: <User className="h-5 w-5" /> },
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

  if (isLoading) {
    return <SkeletonCard />;
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              D
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">DomiU</h2>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Link
              href="/cliente/cart"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ShoppingBag className="h-[18px] w-[18px]" />
              {itemCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <Footer />
      <BottomNavigation items={navItems} />
    </div>
  );
}
