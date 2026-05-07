"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Store, ClipboardList, Package, TrendingUp, DollarSign, Clock, ChevronRight, Bell } from "lucide-react";
import { useNegocio } from "@/context/negocio/NegocioContext";
import { getSupabaseClient } from "@/lib/supabase";

export default function NegocioDashboard() {
  const router = useRouter();
  const { negocio } = useNegocio();
  const [stats, setStats] = useState({ pendientes: 0, preparacion: 0, listos: 0, ventasHoy: 0, productosActivos: 0 });

  useEffect(() => {
    if (!negocio?.id) return;
    const fetchStats = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [pedidos, productos] = await Promise.all([
        getSupabaseClient().from("pedidos_cliente").select("estado_negocio, total, created_at").eq("negocio_id", negocio.id),
        getSupabaseClient().from("productos").select("id, disponible").eq("negocio_id", negocio.id),
      ]);
      const pendientes = (pedidos.data || []).filter((p) => p.estado_negocio === "recibido").length;
      const preparacion = (pedidos.data || []).filter((p) => p.estado_negocio === "en_preparacion").length;
      const listos = (pedidos.data || []).filter((p) => p.estado_negocio === "listo_para_recoger").length;
      const ventasHoy = (pedidos.data || []).filter((p) => new Date(p.created_at) >= today).reduce((s, p) => s + (p.total || 0), 0);
      const productosActivos = (productos.data || []).filter((p) => p.disponible).length;
      setStats({ pendientes, preparacion, listos, ventasHoy, productosActivos });
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [negocio?.id]);

  if (!negocio) return null;

  const cards = [
    { label: "Pedidos pendientes", value: stats.pendientes, icon: ClipboardList, color: "bg-yellow-500/20 text-yellow-400", href: "/negocio/pedidos" },
    { label: "En preparacion", value: stats.preparacion, icon: Clock, color: "bg-blue-500/20 text-blue-400", href: "/negocio/pedidos" },
    { label: "Listos para recoger", value: stats.listos, icon: Bell, color: "bg-green-500/20 text-green-400", href: "/negocio/pedidos" },
    { label: "Ventas del dia", value: `$${stats.ventasHoy.toLocaleString()}`, icon: DollarSign, color: "bg-purple-500/20 text-purple-400", href: "" },
    { label: "Productos activos", value: stats.productosActivos, icon: Package, color: "bg-orange-500/20 text-orange-400", href: "/negocio/productos" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-domi-yellow/20 to-domi-yellow/5 flex items-center justify-center text-domi-yellow font-bold text-2xl border border-white/10">
          {negocio.nombre[0]}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{negocio.nombre}</h1>
          <p className="text-sm text-white/50 mt-0.5">{negocio.categoria}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${negocio.abierto ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
              {negocio.abierto ? "Abierto" : "Cerrado"}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button key={card.label} onClick={() => card.href && router.push(card.href)} className={`bg-domi-dark rounded-2xl p-4 text-left hover:bg-white/5 transition-all active:scale-[0.98] ${card.href ? "cursor-pointer" : "cursor-default"}`}>
              <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center mb-3`}>
                <Icon size={20} />
              </div>
              <p className="text-2xl font-bold mb-1">{card.value}</p>
              <p className="text-xs text-white/50">{card.label}</p>
            </button>
          );
        })}
      </div>

      {/* Recent orders */}
      <div className="bg-domi-dark rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-base">Pedidos recientes</h2>
          <button onClick={() => router.push("/negocio/pedidos")} className="text-xs text-domi-yellow font-medium flex items-center gap-1">
            Ver todos <ChevronRight size={14} />
          </button>
        </div>
        <RecentOrders negocioId={negocio.id} />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => router.push("/negocio/productos")} className="bg-domi-dark rounded-2xl p-5 text-left hover:bg-white/5 transition-all active:scale-[0.98]">
          <Package size={24} className="text-domi-yellow mb-2" />
          <p className="font-semibold text-sm">Gestionar productos</p>
          <p className="text-xs text-white/40 mt-0.5">Agregar, editar o desactivar</p>
        </button>
        <button onClick={() => router.push("/negocio/perfil")} className="bg-domi-dark rounded-2xl p-5 text-left hover:bg-white/5 transition-all active:scale-[0.98]">
          <Store size={24} className="text-domi-yellow mb-2" />
          <p className="font-semibold text-sm">Mi perfil</p>
          <p className="text-xs text-white/40 mt-0.5">Editar info del negocio</p>
        </button>
      </div>
    </div>
  );
}

function RecentOrders({ negocioId }: { negocioId: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!negocioId) return;
    const fetchOrders = async () => {
      const { data } = await getSupabaseClient()
        .from("pedidos_cliente")
        .select("id, codigo, cliente_nombre, total, estado_negocio, created_at")
        .eq("negocio_id", negocioId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (data) setOrders(data);
    };
    fetchOrders();
    const sub = getSupabaseClient()
      .channel("negocio-pedidos")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pedidos_cliente", filter: `negocio_id=eq.${negocioId}` }, () => fetchOrders())
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [negocioId]);

  if (orders.length === 0) {
    return <p className="text-sm text-white/30 py-4 text-center">No hay pedidos recientes</p>;
  }

  return (
    <div className="space-y-2">
      {orders.map((o) => {
        const estadoMap: Record<string, string> = { recibido: "text-yellow-400", en_preparacion: "text-blue-400", listo_para_recoger: "text-green-400" };
        return (
          <button key={o.id} onClick={() => router.push(`/negocio/pedido/${o.id}`)} className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
            <div className="min-w-0">
              <p className="text-sm font-semibold">#{o.codigo}</p>
              <p className="text-xs text-white/50 truncate">{o.cliente_nombre}</p>
            </div>
            <div className="text-right">
              <p className={`text-xs font-semibold ${estadoMap[o.estado_negocio] || "text-white/50"}`}>{o.estado_negocio?.replace("_", " ")}</p>
              <p className="text-xs text-white/40">${o.total.toLocaleString()}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
