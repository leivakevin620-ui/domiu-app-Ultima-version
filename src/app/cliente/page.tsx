"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, UtensilsCrossed, Store, Wine, Pill, Percent, Bell, Star, Clock, Bike, ChevronRight, Zap, TrendingUp, Gift, MapPin } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { useNotificaciones } from "@/context/NotificationContext";

type Negocio = {
  id: string; nombre: string; categoria: string; descripcion: string;
  logo: string; rating: number; tiempo_estimado: string; domicilio_cost: number;
  abierto: boolean; destacado: boolean; calificacion: number;
};

const categories = [
  { label: "Restaurantes", icon: UtensilsCrossed, color: "#FF6B35", emoji: "🍔" },
  { label: "Tiendas", icon: Store, color: "#00E676", emoji: "🛒" },
  { label: "Licoreras", icon: Wine, color: "#D500F9", emoji: "🍷" },
  { label: "Droguerías", icon: Pill, color: "#448AFF", emoji: "💊" },
  { label: "Promociones", icon: Percent, color: "#FF5252", emoji: "🔥" },
];

export default function ClienteHome() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [loading, setLoading] = useState(true);
  const { noLeidas, solicitarPermiso } = useNotificaciones();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSupabaseClient()
      .from("negocios")
      .select("*")
      .eq("activo", true)
      .order("destacado", { ascending: false })
      .then(({ data }) => {
        if (data) setNegocios(data);
        setLoading(false);
      });
  }, []);

  const destacados = negocios.filter((n) => n.destacado);
  const filtered = search ? negocios.filter((n) => n.nombre.toLowerCase().includes(search.toLowerCase())) : [];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header premium */}
      <div className="px-5 pt-5 pb-2">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] flex items-center justify-center text-black font-black text-lg shadow-lg shadow-[var(--primary)]/25 animate-scale-in">
              D
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">
                Domi<span className="gradient-text">U</span>
              </h1>
              <p className="text-[11px] text-[var(--text-muted)] font-medium -mt-0.5">Magdalena</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-white/5 text-xs text-[var(--text-secondary)]">
              <MapPin size={12} className="text-[var(--success)]" />
              Santa Marta
            </div>
            <button onClick={() => { solicitarPermiso(); }} className="relative w-10 h-10 rounded-2xl bg-[var(--bg-card)] flex items-center justify-center border border-white/5 hover:border-[var(--primary)]/30 transition-all active:scale-90">
              <Bell size={18} className="text-[var(--text-secondary)]" />
              {noLeidas > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-[var(--error)] to-[#FF1744] text-white text-[9px] font-bold flex items-center justify-center shadow-lg shadow-red-500/30 animate-scale-in">
                  {noLeidas > 9 ? "9+" : noLeidas}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Hero Section */}
        <div className="hero-section p-5 mb-6 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-black mb-1 leading-tight">
              ¿Qué vas a pedir <span className="gradient-text">hoy</span>?
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-5">Descubre los mejores negocios cerca de ti</p>
            <form onSubmit={(e) => { e.preventDefault(); if (search.trim()) router.push(`/cliente/negocios?busqueda=${encodeURIComponent(search.trim())}`); }} className="relative">
              <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input type="text" placeholder="Buscar negocios, productos..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="search-bar pl-12" />
            </form>
          </div>
        </div>

        {/* Search Results */}
        {search && (
          <div className="mb-6 animate-fade-up">
            <p className="text-sm text-[var(--text-secondary)] mb-3 font-medium">Resultados para &quot;{search}&quot;</p>
            {filtered.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <Search size={40} className="mx-auto text-[var(--text-muted)]/30 mb-3" />
                <p className="text-[var(--text-secondary)]">No encontramos resultados</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {filtered.map((n) => (
                  <button key={n.id} onClick={() => router.push(`/cliente/negocio/${n.id}`)}
                    className="glass-card flex items-center gap-4 p-4 text-left w-full active:scale-[0.98] transition-all">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--primary)]/20 to-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)] font-bold text-lg shrink-0 shadow-inner">
                      {n.nombre[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[15px] truncate">{n.nombre}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">{n.categoria}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-[11px] text-[var(--primary)] font-semibold">★ {n.rating || n.calificacion || "—"}</span>
                        <span className="text-[11px] text-[var(--text-muted)]">🕐 {n.tiempo_estimado}</span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-[var(--text-muted)] shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick categories */}
        {!search && (
          <>
            <div className="mb-7">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[1.5px]">Categorías</h3>
              </div>
              <div className="cat-grid">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const catKey = cat.label === "Droguerías" ? "Droguerias" : cat.label;
                  return (
                    <button key={cat.label} onClick={() => router.push(`/cliente/negocios?categoria=${catKey}`)}
                      className="cat-item">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ background: `${cat.color}15` }}>
                        {cat.emoji}
                      </div>
                      <span className="text-[11px] font-semibold text-[var(--text-secondary)] leading-tight text-center">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Promo Banner */}
            <div className="mb-7">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={14} className="text-[var(--primary)]" />
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[1.5px]">Promociones</h3>
              </div>
              <div className="glass-card p-5 bg-gradient-to-r from-[var(--primary)]/5 to-transparent flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--primary)]/20 to-[var(--primary)]/5 flex items-center justify-center text-2xl animate-float">
                  🎉
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-base">¡Bienvenido!</h4>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">Usa <span className="font-bold text-[var(--primary)]">BIENVENIDO10</span> y obtén 10% OFF</p>
                  <button onClick={() => router.push("/cliente/negocios")}
                    className="mt-2 px-4 py-1.5 rounded-full bg-[var(--primary)] text-black text-xs font-bold hover:brightness-110 transition-all active:scale-95">
                    Ordenar ahora
                  </button>
                </div>
              </div>
            </div>

            {/* Featured */}
            {loading ? (
              <div className="grid gap-3">
                {[1,2,3].map((i) => (
                  <div key={i} className="card-modern p-4">
                    <div className="flex gap-3">
                      <div className="skeleton w-16 h-16 rounded-2xl" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-4 w-3/4" />
                        <div className="skeleton h-3 w-1/2" />
                        <div className="skeleton h-3 w-1/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : destacados.length > 0 ? (
              <div className="mb-7">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-[var(--primary)]" />
                    <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[1.5px]">Destacados</h3>
                  </div>
                  <button onClick={() => router.push("/cliente/negocios")} className="text-xs text-[var(--primary)] font-semibold flex items-center gap-1 hover:underline">
                    Ver todos <ChevronRight size={12} />
                  </button>
                </div>
                <div className="grid gap-3">
                  {destacados.map((n, idx) => (
                    <button key={n.id} onClick={() => router.push(`/cliente/negocio/${n.id}`)}
                      className="biz-card p-4 text-left w-full animate-fade-up" style={{ animationDelay: `${idx * 80}ms` }}>
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--primary)]/20 to-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)] font-bold text-xl shrink-0 shadow-inner">
                          {n.nombre[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-[15px] truncate">{n.nombre}</h4>
                            <span className={`badge shrink-0 ${n.abierto ? "badge-success" : "badge-error"}`}>
                              {n.abierto ? "Abierto" : "Cerrado"}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1">{n.descripcion}</p>
                          <div className="flex items-center gap-4 mt-2.5">
                            <span className="flex items-center gap-1 text-xs text-[var(--primary)] font-semibold">
                              <Star size={12} fill="var(--primary)" stroke="none" /> {n.rating || n.calificacion || "—"}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                              <Clock size={12} /> {n.tiempo_estimado}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                              <Bike size={12} /> ${n.domicilio_cost?.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* All businesses CTA */}
            <div className="text-center mb-6">
              <button onClick={() => router.push("/cliente/negocios")}
                className="btn-primary w-full text-sm flex items-center justify-center gap-2">
                Explorar todos los negocios <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}

        {/* Skeleton for home */}
        {!search && loading && (
          <div className="space-y-3 mb-6">
            {[1,2,3,4].map((i) => (
              <div key={i} className="card-modern p-4 animate-fade-up">
                <div className="flex gap-3">
                  <div className="skeleton w-16 h-16 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-2/3" />
                    <div className="skeleton h-3 w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
