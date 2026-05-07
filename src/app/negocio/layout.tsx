"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Store, ClipboardList, Package, Settings, LogOut, Bell, Menu, X, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NegocioProvider, useNegocio } from "@/context/negocio/NegocioContext";

const tabs = [
  { href: "/negocio", label: "Inicio", icon: LayoutDashboard },
  { href: "/negocio/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/negocio/productos", label: "Productos", icon: Package },
  { href: "/negocio/perfil", label: "Perfil", icon: Settings },
];

function NegocioNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const { negocio } = useNegocio();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) => href === "/negocio" ? pathname === "/negocio" : pathname.startsWith(href);
  const hideNav = pathname.includes("/pedido/");

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-domi-dark border-r border-white/10 min-h-screen fixed left-0 top-0 z-50 p-4">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 rounded-xl bg-domi-yellow flex items-center justify-center text-domi-black font-black text-sm">D</div>
          <div>
            <p className="font-bold text-sm text-white">Domi<span className="text-domi-yellow">U</span></p>
            <p className="text-[10px] text-white/40">Panel del negocio</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.href} onClick={() => router.push(tab.href)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive(tab.href) ? "bg-domi-yellow text-domi-black" : "text-white/60 hover:bg-white/5 hover:text-white"}`}>
                <Icon size={20} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 pt-4 mt-4">
          <div className="px-2 mb-3">
            <p className="text-sm font-semibold text-white truncate">{negocio?.nombre || "Cargando..."}</p>
            <p className="text-[10px] text-white/40">{negocio?.categoria}</p>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut size={20} />
            Cerrar sesion
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-domi-dark border-b border-white/10 sticky top-0 z-40">
        <button onClick={() => setMenuOpen(!menuOpen)} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">Domi<span className="text-domi-yellow">U</span></span>
          <span className="text-[10px] text-white/40">| {negocio?.nombre || "Negocio"}</span>
        </div>
        <div className="w-9 h-9" />
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-domi-black/80 backdrop-blur-sm" onClick={() => setMenuOpen(false)}>
          <div className="bg-domi-dark w-72 h-full p-4 pt-16 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button key={tab.href} onClick={() => { router.push(tab.href); setMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive(tab.href) ? "bg-domi-yellow text-domi-black" : "text-white/60 hover:bg-white/5"}`}>
                    <Icon size={20} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-white/10 pt-4 mt-4">
              <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10">
                <LogOut size={20} />
                Cerrar sesion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      {!hideNav && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-domi-dark border-t border-white/10">
          <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.href} onClick={() => router.push(tab.href)} className="flex flex-col items-center gap-0.5 py-1 px-3 min-w-0">
                  <Icon size={22} className={isActive(tab.href) ? "text-domi-yellow" : "text-white/50"} />
                  <span className={`text-[10px] font-medium ${isActive(tab.href) ? "text-domi-yellow" : "text-white/50"}`}>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}

export default function NegocioLayout({ children }: { children: React.ReactNode }) {
  const { profile, initialized, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!initialized) {
    return <div className="flex items-center justify-center h-screen bg-domi-black"><div className="w-8 h-8 border-2 border-domi-yellow border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!profile || profile.rol !== "negocio") {
    return (
      <div className="flex items-center justify-center h-screen bg-domi-black text-white px-6">
        <div className="text-center max-w-sm">
          <Store size={48} className="mx-auto text-domi-yellow mb-4" />
          <h2 className="text-xl font-bold mb-2">Acceso restringido</h2>
          <p className="text-white/50 text-sm mb-6">Debes iniciar sesion como negocio para acceder a este panel.</p>
          <button onClick={() => router.push("/login")} className="px-8 py-3 rounded-xl bg-domi-yellow text-domi-black font-bold text-sm">Ir a login</button>
        </div>
      </div>
    );
  }

  return (
    <NegocioProvider userId={user?.id || ""}>
      <div className="min-h-screen bg-domi-black text-white">
        <NegocioNav />
        <main className="md:ml-64 pb-20 md:pb-8">
          <div className="max-w-6xl mx-auto px-4 py-6">
            {children}
          </div>
        </main>
      </div>
    </NegocioProvider>
  );
}
