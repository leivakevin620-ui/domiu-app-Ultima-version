"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Package, Search, Clock, ChevronRight, Filter } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

type Pedido = {
  id: string; codigo: string; total: number; estado: string; created_at: string;
  negocios: { nombre: string } | null;
};

const estadoColor: Record<string, string> = {
  recibido: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  preparacion: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  asignado: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  camino: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  entregado: "text-green-400 bg-green-500/10 border-green-500/20",
  cancelado: "text-red-400 bg-red-500/10 border-red-500/20",
};

const estadoLabel: Record<string, string> = {
  recibido: "Recibido", preparacion: "Preparación", asignado: "Asignado",
  camino: "En camino", entregado: "Entregado", cancelado: "Cancelado",
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
    setLoading(true); setSearched(true);
    const { data } = await getSupabaseClient()
      .from("pedidos_cliente")
      .select("*, negocios(nombre)")
      .eq("cliente_telefono", telefono.trim())
      .order("created_at", { ascending: false });
    if (data) setPedidos(data);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-5 pt-6 pb-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[var(--primary)]/20 to-[var(--primary)]/5 flex items-center justify-center">
            <ClipboardList size={20} className="text-[var(--primary)]" />
          </div>
          <h1 className="text-xl font-bold">Mis pedidos</h1>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="relative mb-6">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input type="tel" placeholder="Buscar por tu teléfono..." value={telefono} onChange={(e) => setTelefono(e.target.value)}
          className="search-bar pl-10" />
      </form>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!searched && !loading && (
        <div className="text-center py-20 animate-fade-up">
          <div className="w-20 h-20 rounded-3xl bg-[var(--bg-card)] flex items-center justify-center mx-auto mb-4">
            <Search size={36} className="text-[var(--text-muted)]/30" />
          </div>
          <p className="text-[var(--text-secondary)] font-medium">Busca tus pedidos</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Ingresa tu número de teléfono</p>
        </div>
      )}

      {searched && !loading && pedidos.length === 0 && (
        <div className="text-center py-20 animate-fade-up">
          <div className="w-20 h-20 rounded-3xl bg-[var(--bg-card)] flex items-center justify-center mx-auto mb-4">
            <Package size={36} className="text-[var(--text-muted)]/30" />
          </div>
          <p className="text-[var(--text-secondary)] font-medium">No encontramos pedidos</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Verifica el número de teléfono</p>
        </div>
      )}

      {pedidos.length > 0 && (
        <div className="grid gap-3">
          {pedidos.map((p, idx) => (
            <button key={p.id} onClick={() => router.push(`/cliente/seguimiento/${p.codigo}`)}
              className="glass-card p-5 text-left w-full active:scale-[0.98] transition-all animate-fade-up" style={{ animationDelay: `${idx * 60}ms` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-sm">#{p.codigo}</span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${estadoColor[p.estado] || "text-[var(--text-secondary)] bg-[var(--bg-card)] border-white/5"}`}>
                  {estadoLabel[p.estado] || p.estado}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{p.negocios?.nombre || "Negocio"}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1.5">
                    <Clock size={11} />
                    {new Date(p.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold gradient-text text-sm">${p.total.toLocaleString()}</span>
                  <ChevronRight size={16} className="text-[var(--text-muted)]" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
