"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Package, Search, Clock, ChevronRight } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

type Pedido = {
  id: string;
  codigo: string;
  total: number;
  estado: string;
  created_at: string;
  negocios: { nombre: string } | null;
};

const estadoColor: Record<string, string> = {
  recibido: "text-yellow-400",
  preparacion: "text-blue-400",
  asignado: "text-purple-400",
  camino: "text-orange-400",
  entregado: "text-green-400",
  cancelado: "text-red-400",
};

const estadoLabel: Record<string, string> = {
  recibido: "Recibido",
  preparacion: "Preparación",
  asignado: "Asignado",
  camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export default function PedidosPage() {
  const router = useRouter();
  const [telefono, setTelefono] = useState("");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telefono.trim()) return;
    setLoading(true);
    setSearched(true);
    const { data } = await getSupabaseClient()
      .from("pedidos_cliente")
      .select("*, negocios(nombre)")
      .eq("cliente_telefono", telefono.trim())
      .order("created_at", { ascending: false });
    if (data) setPedidos(data);
    setLoading(false);
  };

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-full bg-domi-yellow/20 flex items-center justify-center">
          <ClipboardList size={18} className="text-domi-yellow" />
        </div>
        <h1 className="text-lg font-bold">Mis pedidos</h1>
      </div>

      {/* Search by phone */}
      <form onSubmit={handleSearch} className="relative mb-6">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="tel"
          placeholder="Buscar por tu teléfono..."
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          className="w-full bg-domi-dark border border-white/10 rounded-2xl py-3.5 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none focus:border-domi-yellow/50"
        />
      </form>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-domi-yellow border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!searched && !loading && (
        <div className="text-center py-16">
          <Package size={40} className="mx-auto text-white/20 mb-3" />
          <p className="text-white/50 text-sm">Ingresa tu número de teléfono para ver tus pedidos</p>
        </div>
      )}

      {searched && !loading && pedidos.length === 0 && (
        <div className="text-center py-16">
          <Package size={40} className="mx-auto text-white/20 mb-3" />
          <p className="text-white/50 text-sm">No encontramos pedidos con este teléfono</p>
        </div>
      )}

      {pedidos.length > 0 && (
        <div className="grid gap-3">
          {pedidos.map((p) => (
            <button key={p.id} onClick={() => router.push(`/cliente/seguimiento/${p.codigo}`)} className="bg-domi-dark rounded-2xl p-4 text-left hover:bg-white/5 transition-all active:scale-[0.98]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm">#{p.codigo}</span>
                <span className={`text-xs font-semibold ${estadoColor[p.estado] || "text-white/50"}`}>
                  {estadoLabel[p.estado] || p.estado}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/50">{p.negocios?.nombre || "Negocio"}</p>
                  <p className="text-xs text-white/30 mt-0.5 flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(p.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-domi-yellow text-sm">${p.total.toLocaleString()}</span>
                  <ChevronRight size={16} className="text-white/20" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
