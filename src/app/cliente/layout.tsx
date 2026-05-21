"use client";
import { usePathname, useRouter } from "next/navigation";
import { Home, ClipboardList, ShoppingCart, User, Bell } from "lucide-react";
import { CartProvider, useCart } from "@/context/CartContext";
import { NotificationProvider, useNotificaciones } from "@/context/NotificationContext";

function NavBoton({ href, icon: Icon, label, badge }: { href: string; icon: any; label: string; badge?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = href === "/cliente" ? pathname === "/cliente" : pathname.startsWith(href);

  return (
    <button onClick={() => router.push(href)} className="relative flex flex-col items-center gap-1 py-1 px-4 min-w-0 transition-all duration-200 active:scale-90">
      <div className={`relative p-2 rounded-xl transition-all duration-200 ${isActive ? "bg-[var(--primary)]/10" : ""}`}>
        <Icon size={22} className={`transition-colors duration-200 ${isActive ? "text-[var(--primary)]" : "text-[var(--text-muted)]"}`} />
        {badge && badge > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-gradient-to-br from-[var(--error)] to-[#FF1744] text-white text-[9px] font-bold flex items-center justify-center shadow-lg shadow-red-500/30 animate-scale-in">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </div>
      <span className={`text-[10px] font-semibold tracking-wide transition-colors duration-200 ${isActive ? "text-[var(--primary)]" : "text-[var(--text-muted)]"}`}>{label}</span>
      {isActive && <div className="absolute -top-0.5 w-6 h-0.5 rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] animate-scale-in" />}
    </button>
  );
}

function NavContent() {
  const { totalItems } = useCart();
  const { noLeidas } = useNotificaciones();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom bg-[var(--bg-card)]/90 backdrop-blur-xl border-t border-white/5">
      <div className="flex items-center justify-around h-[68px] max-w-lg mx-auto">
        <NavBoton href="/cliente" icon={Home} label="Inicio" />
        <NavBoton href="/cliente/negocios" icon={ShoppingCart} label="Explorar" />
        <NavBoton href="/cliente/pedidos" icon={ClipboardList} label="Pedidos" />
        <NavBoton href="/cliente/perfil" icon={User} label="Perfil" badge={noLeidas} />
      </div>
    </nav>
  );
}

function ClienteContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname.includes("/checkout") || pathname.includes("/confirmacion") || pathname.includes("/seguimiento") || pathname.includes("/chat");

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col">
      <main className={`flex-1 overflow-y-auto ${hideNav ? "" : "pb-[72px]"}`}>{children}</main>
      {!hideNav && <NavContent />}
    </div>
  );
}

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <NotificationProvider>
        <ClienteContent>{children}</ClienteContent>
      </NotificationProvider>
    </CartProvider>
  );
}
