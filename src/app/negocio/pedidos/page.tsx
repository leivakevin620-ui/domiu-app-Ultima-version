"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Search, ChevronRight, RefreshCw } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { useNegocio } from "@/context/negocio/NegocioContext";

export default function PedidosPage() {
  const router = useRouter();
  const { negocio } = useNegocio();
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [filtro, setFiltro] = useState("todos");

  useEffect(() => {
    if (!negocio?.id) return;
    const fetchPedidos = async () => {
      let query = getSupabaseClient()
        .from("pedidos_cliente")
        .select("*")
        .eq("negocio_id", negocio.id)
        .order("created_at", { ascending: false });
      if (filtro !== "todos") query = query.eq("estado_negocio", filtro);
      const { data } = await query;
      if (data) setPedidos(data);
    };
    fetchPedidos();
    const sub = getSupabaseClient()
      .channel("negocio-pedidos-lista")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos_cliente", filter: `negocio_id=eq.${negocio.id}` }, () => fetchPedidos())
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [negocio?.id, filtro]);

  const filtros = [
    { key: "todos", label: "Todos" },
    { key: "recibido", label: "Recibidos" },
    { key: "en_preparacion", label: "Preparacion" },
    { key: "listo_para_recoger", label: "Listos" },
  ];

  const estadoColor: Record<string, string> = {
    recibido: "text-yellow-400 bg-yellow-500/10",
    en_preparacion: "text-blue-400 bg-blue-500/10",
    listo_para_recoger: "text-green-400 bg-green-500/10",
  };

  const estadoLabel: Record<string, string> = {
    recibido: "Recibido",
    en_preparacion: "Preparacion",
    listo_para_recoger: "Listo",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Pedidos</h1>
        <button onClick={() => setFiltro(filtro)} className="text-xs text-white/40 flex items-center gap-1">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-5 scrollbar-none">
        {filtros.map((f) => (
          <button key={f.key} onClick={() => setFiltro(f.key)} className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${filtro === f.key ? "bg-domi-yellow text-domi-black" : "bg-domi-dark text-white/60 hover:bg-white/10"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {pedidos.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList size={40} className="mx-auto text-white/20 mb-3" />
          <p className="text-white/50 text-sm">No hay pedidos</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {pedidos.map((p) => (
            <button key={p.id} onClick={() => router.push(`/negocio/pedido/${p.id}`)} className="bg-domi-dark rounded-2xl p-4 text-left hover:bg-white/5 transition-all active:scale-[0.98]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">#{p.codigo}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${estadoColor[p.estado_negocio] || "text-white/50 bg-white/10"}`}>
                    {estadoLabel[p.estado_negocio] || p.estado_negocio}
                  </span>
                </div>
                <span className="text-xs text-white/30">{new Date(p.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{p.cliente_nombre}</p>
                  <p className="text-xs text-white/50">{p.cliente_direccion}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-domi-yellow text-sm">${p.total.toLocaleString()}</p>
                  <ChevronRight size={16} className="text-white/20 ml-auto" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
