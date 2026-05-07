"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, UtensilsCrossed, Store, Wine, Pill, Percent } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

type Negocio = {
  id: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  logo: string;
  rating: number;
  tiempo_estimado: string;
  domicilio_cost: number;
  abierto: boolean;
  destacado: boolean;
};

const categories = [
  { label: "Restaurantes", icon: UtensilsCrossed, color: "#FACC15" },
  { label: "Tiendas", icon: Store, color: "#22C55E" },
  { label: "Licoreras", icon: Wine, color: "#A855F7" },
  { label: "Droguerías", icon: Pill, color: "#3B82F6" },
  { label: "Promociones", icon: Percent, color: "#EF4444" },
];

export default function ClienteHome() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [negocios, setNegocios] = useState<Negocio[]>([]);

  useEffect(() => {
    getSupabaseClient()
      .from("negocios")
      .select("*")
      .eq("activo", true)
      .order("destacado", { ascending: false })
      .then(({ data }) => {
        if (data) setNegocios(data);
      });
  }, []);

  const destacados = negocios.filter((n) => n.destacado);
  const filtered = search
    ? negocios.filter((n) => n.nombre.toLowerCase().includes(search.toLowerCase()) || n.categoria.toLowerCase().includes(search.toLowerCase()))
    : [];

  const handleCategory = (cat: string) => {
    router.push(`/cliente/negocios?categoria=${cat}`);
  };

  const handleNegocio = (id: string) => {
    router.push(`/cliente/negocio/${id}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/cliente/negocios?busqueda=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-6">
        <div className="w-9 h-9 rounded-full bg-domi-yellow flex items-center justify-center text-domi-black font-black text-sm">D</div>
        <div>
          <h1 className="text-lg font-black leading-tight">
            Domi<span className="text-domi-yellow">U</span>
          </h1>
          <p className="text-[10px] text-white/40 font-medium -mt-0.5">Magdalena</p>
        </div>
      </div>

      {/* Greeting */}
      <h2 className="text-xl font-bold mb-2">Hola, ¿qué deseas pedir hoy?</h2>
      <p className="text-sm text-white/50 mb-5">Encuentra todo lo que necesitas cerca de ti</p>

      {/* Search */}
      <form onSubmit={handleSearch} className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          placeholder="Buscar negocios o productos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-domi-dark border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white placeholder-white/30 outline-none focus:border-domi-yellow/50 transition-all"
        />
      </form>

      {/* Search results */}
      {search && (
        <div className="mb-6">
          <p className="text-xs text-white/40 mb-3">Resultados para &quot;{search}&quot;</p>
          {filtered.length === 0 ? (
            <div className="text-center py-8 bg-domi-dark rounded-2xl">
              <Search size={32} className="mx-auto text-white/20 mb-2" />
              <p className="text-sm text-white/40">No encontramos resultados</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((n) => (
                <button key={n.id} onClick={() => handleNegocio(n.id)} className="flex items-center gap-3 bg-domi-dark rounded-xl p-3 text-left hover:bg-white/5 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-domi-yellow/20 flex items-center justify-center text-domi-yellow font-bold text-lg shrink-0">{n.nombre[0]}</div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{n.nombre}</p>
                    <p className="text-xs text-white/40">{n.categoria}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Categories */}
      <div className="mb-7">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Categorías</h3>
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const catKey = cat.label === "Droguerías" ? "Droguerias" : cat.label === "Promociones" ? "Promociones" : cat.label;
            return (
              <button key={cat.label} onClick={() => handleCategory(catKey)} className="flex flex-col items-center gap-2 min-w-[76px]">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: `${cat.color}20`, border: `2px solid ${cat.color}40` }}>
                  <Icon size={26} style={{ color: cat.color }} />
                </div>
                <span className="text-[11px] font-medium text-white/70 text-center leading-tight">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Featured businesses */}
      {destacados.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Destacados</h3>
            <button onClick={() => router.push("/cliente/negocios")} className="text-xs text-domi-yellow font-medium">Ver todos</button>
          </div>
          <div className="grid gap-3">
            {destacados.map((n) => (
              <button key={n.id} onClick={() => handleNegocio(n.id)} className="bg-domi-dark rounded-2xl p-4 text-left hover:bg-white/5 transition-all active:scale-[0.98]">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl bg-domi-yellow/20 flex items-center justify-center text-domi-yellow font-bold text-xl shrink-0">{n.nombre[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-base truncate">{n.nombre}</h4>
                      <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${n.abierto ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                        {n.abierto ? "Abierto" : "Cerrado"}
                      </div>
                    </div>
                    <p className="text-xs text-white/50 mt-0.5 line-clamp-1">{n.descripcion}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-domi-yellow">★ {n.rating}</span>
                      <span className="text-xs text-white/40">🕐 {n.tiempo_estimado}</span>
                      <span className="text-xs text-white/40">🏍 ${n.domicilio_cost.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Browse all */}
      <button onClick={() => router.push("/cliente/negocios")} className="w-full mt-5 py-3.5 rounded-2xl bg-domi-yellow text-domi-black font-bold text-sm hover:brightness-110 transition-all active:scale-[0.98]">
        Explorar todos los negocios
      </button>
    </div>
  );
}
