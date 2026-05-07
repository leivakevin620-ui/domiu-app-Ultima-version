"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Search, Star, Clock, Bike } from "lucide-react";
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
};

function NegociosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoria = searchParams.get("categoria") || "";
  const busqueda = searchParams.get("busqueda") || "";
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [filter, setFilter] = useState(categoria);

  useEffect(() => {
    getSupabaseClient()
      .from("negocios")
      .select("*")
      .eq("activo", true)
      .order("destacado", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        let filtered = data;
        if (categoria) filtered = filtered.filter((n) => n.categoria === categoria);
        if (busqueda) {
          const q = busqueda.toLowerCase();
          filtered = filtered.filter((n) => n.nombre.toLowerCase().includes(q) || n.descripcion.toLowerCase().includes(q));
        }
        setNegocios(filtered);
        setFilter(categoria);
      });
  }, [categoria, busqueda]);

  const categories = ["", "Restaurantes", "Tiendas", "Licoreras", "Droguerias", "Promociones"];

  const handleNegocio = (id: string) => router.push(`/cliente/negocio/${id}`);

  return (
    <div className="px-4 pt-5 pb-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-domi-dark flex items-center justify-center hover:bg-white/10 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold">Negocios</h1>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat || "todas"}
            onClick={() => {
              setFilter(cat);
              router.push(cat ? `/cliente/negocios?categoria=${cat}` : "/cliente/negocios");
            }}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filter === cat ? "bg-domi-yellow text-domi-black" : "bg-domi-dark text-white/60 hover:bg-white/10"
            }`}
          >
            {cat || "Todas"}
          </button>
        ))}
      </div>

      {/* Results */}
      {negocios.length === 0 ? (
        <div className="text-center py-16">
          <Search size={40} className="mx-auto text-white/20 mb-3" />
          <p className="text-white/50 text-sm">No hay negocios en esta categoría</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {negocios.map((n) => (
            <button key={n.id} onClick={() => handleNegocio(n.id)} className="bg-domi-dark rounded-2xl p-4 text-left hover:bg-white/5 transition-all active:scale-[0.98]">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl bg-domi-yellow/20 flex items-center justify-center text-domi-yellow font-bold text-xl shrink-0">{n.nombre[0]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-sm truncate">{n.nombre}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${n.abierto ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {n.abierto ? "Abierto" : "Cerrado"}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-0.5 line-clamp-1">{n.descripcion}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1 text-xs text-domi-yellow">
                      <Star size={12} /> {n.rating}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-white/40">
                      <Clock size={12} /> {n.tiempo_estimado}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-white/40">
                      <Bike size={12} /> ${n.domicilio_cost.toLocaleString()}
                    </span>
                  </div>
                </div>
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
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-domi-black"><div className="w-8 h-8 border-2 border-domi-yellow border-t-transparent rounded-full animate-spin" /></div>}>
      <NegociosContent />
    </Suspense>
  );
}
