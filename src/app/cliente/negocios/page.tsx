"use client";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Search, Star, Clock, Bike, ChevronRight, TrendingUp, SlidersHorizontal } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

type Negocio = {
  id: string; nombre: string; categoria: string; descripcion: string;
  logo: string; rating: number; calificacion: number; tiempo_estimado: string;
  domicilio_cost: number; abierto: boolean;
};

function NegociosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoria = searchParams.get("categoria") || "";
  const busqueda = searchParams.get("busqueda") || "";
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [filter, setFilter] = useState(categoria);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getSupabaseClient()
      .from("negocios")
      .select("*")
      .eq("activo", true)
      .order("destacado", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        let f = data;
        if (categoria) f = f.filter((n) => n.categoria === categoria);
        if (busqueda) { const q = busqueda.toLowerCase(); f = f.filter((n) => n.nombre.toLowerCase().includes(q) || n.descripcion.toLowerCase().includes(q)); }
        setNegocios(f);
        setFilter(categoria);
        setLoading(false);
      });
  }, [categoria, busqueda]);

  const categories = ["", "Restaurantes", "Tiendas", "Licoreras", "Droguerias", "Promociones"];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-5 pt-5 pb-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="w-11 h-11 rounded-2xl bg-[var(--bg-card)] flex items-center justify-center border border-white/5 hover:border-[var(--primary)]/30 transition-all active:scale-90">
          <ArrowLeft size={18} className="text-[var(--text-secondary)]" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Negocios</h1>
          {negocios.length > 0 && <p className="text-xs text-[var(--text-muted)]">{negocios.length} resultados</p>}
        </div>
        <button className="w-11 h-11 rounded-2xl bg-[var(--bg-card)] flex items-center justify-center border border-white/5 hover:border-[var(--primary)]/30 transition-all active:scale-90">
          <SlidersHorizontal size={18} className="text-[var(--text-secondary)]" />
        </button>
      </div>

      {/* Search query display */}
      {busqueda && (
        <div className="glass-card p-4 mb-5 animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center">
              <Search size={16} className="text-[var(--primary)]" />
            </div>
            <div>
              <p className="text-sm font-medium">Resultados para</p>
              <p className="text-lg font-bold gradient-text">&quot;{busqueda}&quot;</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scroll-hide">
        {categories.map((cat) => (
          <button key={cat || "todas"} onClick={() => { setFilter(cat); router.push(cat ? `/cliente/negocios?categoria=${cat}` : "/cliente/negocios"); }}
            className={`chip transition-all active:scale-95 ${filter === cat ? "chip-active" : "chip-inactive"}`}>
            {cat || "Todas"}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid gap-3">
          {[1,2,3,4].map((i) => (
            <div key={i} className="card-modern p-4 animate-fade-up">
              <div className="flex gap-3">
                <div className="skeleton w-16 h-16 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-2/3" />
                  <div className="skeleton h-3 w-1/2" />
                  <div className="skeleton h-3 w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && negocios.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-2xl bg-[var(--bg-card)] flex items-center justify-center mx-auto mb-4">
            <Search size={36} className="text-[var(--text-muted)]/40" />
          </div>
          <p className="text-[var(--text-secondary)] font-medium">No hay negocios en esta categoría</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Prueba con otra categoría</p>
        </div>
      ) : !loading && (
        <div className="grid gap-3">
          {negocios.map((n, idx) => (
            <button key={n.id} onClick={() => router.push(`/cliente/negocio/${n.id}`)}
              className="biz-card p-4 text-left w-full animate-fade-up" style={{ animationDelay: `${idx * 60}ms` }}>
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
                <ChevronRight size={16} className="text-[var(--text-muted)] shrink-0 mt-4" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NegociosPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)]"><div className="w-10 h-10 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>}>
      <NegociosContent />
    </Suspense>
  );
}
