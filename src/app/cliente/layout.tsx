'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { BottomNavigation } from '@/components/ui/bottom-navigation';
import { Footer } from '@/components/ui/footer';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Home, ClipboardList, User, ShoppingBag, FileText, LifeBuoy, Settings } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';

const navItems = [
  { label: 'Inicio', href: '/cliente', icon: <Home className="h-5 w-5" /> },
  { label: 'Pedidos', href: '/cliente/pedidos', icon: <ClipboardList className="h-5 w-5" /> },
  { label: 'Solicitudes', href: '/cliente/solicitudes', icon: <FileText className="h-5 w-5" /> },
  { label: 'Soporte', href: '/soporte', icon: <LifeBuoy className="h-5 w-5" /> },
  { label: 'Perfil', href: '/cliente/perfil', icon: <User className="h-5 w-5" /> },
];

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, profile } = useAuth();
  const { itemCount } = useCart();
  const router = useRouter();
  const pathname = usePathname();

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
              href="/cliente/solicitudes"
              title="Solicitudes"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <FileText className="h-[18px] w-[18px]" />
            </Link>

            <Link
              href="/cliente/configuracion"
              title="Configuración"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Settings className="h-[18px] w-[18px]" />
            </Link>

            <Link
              href="/cliente/cart"
              title="Carrito"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ShoppingBag className="h-[18px] w-[18px]" />
              {itemCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6">
        {pathname === '/cliente' && (
          <section className="mx-auto mt-5 max-w-6xl rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-background p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Trabaja o vende con DomiU
            </p>
            <h1 className="mt-2 text-2xl font-black text-foreground">
              Solicita activar tu cuenta
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Puedes pedir acceso para ser repartidor o registrar tu negocio. El administrador revisará tus datos y aprobará o rechazará la solicitud.
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/cliente/solicitudes/repartidor"
                className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90"
              >
                Quiero ser repartidor
              </Link>

              <Link
                href="/cliente/solicitudes/negocio"
                className="inline-flex items-center justify-center rounded-2xl border border-border bg-background px-5 py-3 text-sm font-bold text-foreground transition hover:bg-muted"
              >
                Registrar mi negocio
              </Link>
            </div>
          </section>
        )}

        {children}
      </main>

      <Footer />
      <BottomNavigation items={navItems} />
    </div>
  );
}
