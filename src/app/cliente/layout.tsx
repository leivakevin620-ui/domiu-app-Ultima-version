"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, ClipboardList, ShoppingCart, User } from "lucide-react";
import { CartProvider } from "@/context/CartContext";

const tabs = [
  { href: "/cliente", label: "Inicio", icon: Home },
  { href: "/cliente/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/cliente/carrito", label: "Carrito", icon: ShoppingCart },
  { href: "/cliente/perfil", label: "Perfil", icon: User },
];

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const hideNav = pathname.includes("/checkout") || pathname.includes("/confirmacion") || pathname.includes("/seguimiento");

  return (
    <CartProvider>
      <div className="min-h-screen bg-domi-black text-white flex flex-col">
        <main className="flex-1 pb-20 overflow-y-auto">{children}</main>
        {!hideNav && (
          <nav className="fixed bottom-0 left-0 right-0 z-50 bg-domi-dark border-t border-white/10 safe-area-bottom">
            <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
              {tabs.map((tab) => {
                const isActive = tab.href === "/cliente" ? pathname === "/cliente" : pathname.startsWith(tab.href);
                const Icon = tab.icon;
                return (
                  <button key={tab.href} onClick={() => router.push(tab.href)} className="flex flex-col items-center gap-0.5 py-1 px-3 min-w-0">
                    <Icon size={22} className={isActive ? "text-domi-yellow" : "text-white/50"} />
                    <span className={`text-[10px] font-medium ${isActive ? "text-domi-yellow" : "text-white/50"}`}>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </CartProvider>
  );
}
