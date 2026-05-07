"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import {
  Package, MapPin, Phone, MessageCircle, Check, Navigation,
  Clock, DollarSign, TrendingUp, Wallet, Truck, AlertTriangle,
  Copy, RefreshCw, User, Store, ChevronRight
} from "lucide-react";

const estadoLabel: Record<string, string> = {
  recibido: "Recibido",
  en_preparacion: "Preparacion",
  listo_para_recoger: "Listo",
  asignado: "Asignado",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const estadoColor: Record<string, string> = {
  recibido: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  en_preparacion: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  listo_para_recoger: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  asignado: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  en_camino: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  entregado: "bg-green-500/10 text-green-400 border-green-500/20",
  cancelado: "bg-red-500/10 text-red-400 border-red-500/20",
};

const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v || 0);

interface PedidoMarket {
  id: string;
  codigo: string;
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_direccion: string;
  nota: string;
  subtotal: number;
  domicilio: number;
  total: number;
  estado: string;
  estado_negocio: string;
  repartidor_id: string;
  costo_envio: number;
  comision_empresa: number;
  pago_repartidor: number;
  ganancia_empresa: number;
  recogido_en: string | null;
  entregado_en: string | null;
  created_at: string;
  negocios: { nombre: string } | null;
}

interface Props {
  riderId: string;
  riderName: string;
}

export default function RiderMarketplace({ riderId, riderName }: Props) {
  const sb = getSupabaseClient();
  const [pedidos, setPedidos] = useState<PedidoMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"ok" | "err">("ok");
  const subRef = useRef<any>(null);

  // GPS
  const [gpsActivo, setGpsActivo] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<"esperando" | "activo" | "detenido" | "error">("esperando");
  const gpsWatchRef = useRef<number | null>(null);

  const ok = (m: string) => { setToast(m); setToastType("ok"); setTimeout(() => setToast(""), 3000); };
  const fail = (m: string) => { setToast(m); setToastType("err"); setTimeout(() => setToast(""), 5000); };

  const fetchPedidos = useCallback(async () => {
    if (!sb || !riderId) return;
    const { data } = await sb
      .from("pedidos_cliente")
      .select("*, negocios(nombre)")
      .eq("repartidor_id", riderId)
      .order("created_at", { ascending: false });
    if (data) setPedidos(data);
    setLoading(false);
  }, [sb, riderId]);

  useEffect(() => { fetchPedidos(); }, [fetchPedidos]);

  // Realtime
  useEffect(() => {
    if (!sb || !riderId) return;
    if (subRef.current) sb.removeChannel(subRef.current);
    const sub = sb
      .channel(`rider-marketplace-${riderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos_cliente", filter: `repartidor_id=eq.${riderId}` }, () => fetchPedidos())
      .subscribe();
    subRef.current = sub;
    return () => { sb.removeChannel(sub); };
  }, [sb, riderId, fetchPedidos]);

  const cambiarEstado = async (id: string, nuevoEstado: string) => {
    const update: any = { estado: nuevoEstado };
    if (nuevoEstado === "recogido") update.recogido_en = new Date().toISOString();
    if (nuevoEstado === "entregado") update.entregado_en = new Date().toISOString();
    const { error } = await sb.from("pedidos_cliente").update(update).eq("id", id);
    if (error) { fail("Error: " + error.message); return; }
    ok(`Pedido: ${estadoLabel[nuevoEstado]}`);
    fetchPedidos();
  };

  // GPS
  const activarGps = () => {
    if (!navigator.geolocation) { fail("GPS no soportado"); return; }
    setGpsStatus("esperando");
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setGpsActivo(true);
        setGpsStatus("activo");
        sb.from("ubicaciones_repartidores").upsert({
          repartidor_id: riderId, nombre_repartidor: riderName,
          latitud: lat, longitud: lng, estado: "ocupado",
          ultima_actualizacion: new Date().toISOString(),
        }).then(() => {});
      },
      () => { setGpsStatus("error"); fail("Error GPS"); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    gpsWatchRef.current = watchId;
    ok("GPS activado");
  };

  const desactivarGps = () => {
    if (gpsWatchRef.current !== null) { navigator.geolocation.clearWatch(gpsWatchRef.current); gpsWatchRef.current = null; }
    setGpsActivo(false); setGpsStatus("detenido"); ok("GPS detenido");
  };

  useEffect(() => () => { if (gpsWatchRef.current !== null) navigator.geolocation.clearWatch(gpsWatchRef.current); }, []);

  const activos = pedidos.filter((p) => !["entregado", "cancelado"].includes(p.estado));
  const entregados = pedidos.filter((p) => p.estado === "entregado");
  const totalGanancia = entregados.reduce((s, p) => s + (p.pago_repartidor || 0), 0);

  const copiarInfo = (p: PedidoMarket) => {
    const txt = `Pedido #${p.codigo}\nCliente: ${p.cliente_nombre}\nTel: ${p.cliente_telefono}\nDireccion: ${p.cliente_direccion}\nTotal: ${fmt(p.total)}\nPago repartidor: ${fmt(p.pago_repartidor)}\nEstado: ${estadoLabel[p.estado]}`;
    navigator.clipboard.writeText(txt).then(() => ok("Copiado")).catch(() => fail("Error"));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl font-bold text-sm shadow-lg"
          style={{ background: toastType === "ok" ? "#10b981" : "#ef4444", color: "#fff" }}>
          {toast}
        </div>
      )}

      {/* GPS */}
      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${gpsActivo ? "bg-green-500/20" : "bg-yellow-500/20"}`}>
              <Navigation size={20} className={gpsActivo ? "text-green-400" : "text-yellow-400"} />
            </div>
            <div>
              <p className="text-white font-bold text-sm">GPS {gpsActivo ? "Activo" : "Inactivo"}</p>
              <p className="text-slate-500 text-[10px]">{gpsStatus}</p>
            </div>
          </div>
          <button onClick={gpsActivo ? desactivarGps : activarGps}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${gpsActivo ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-green-500/20 text-green-400 hover:bg-green-500/30"}`}>
            {gpsActivo ? "Detener" : "Activar"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900 rounded-xl p-3 border border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Activos</p>
          <p className="text-xl font-bold text-yellow-400">{activos.length}</p>
        </div>
        <div className="bg-slate-900 rounded-xl p-3 border border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Entregados</p>
          <p className="text-xl font-bold text-green-400">{entregados.length}</p>
        </div>
        <div className="bg-slate-900 rounded-xl p-3 border border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Ganancia</p>
          <p className="text-sm font-bold text-yellow-400">{fmt(totalGanancia)}</p>
        </div>
      </div>

      {/* Orders */}
      {pedidos.length === 0 ? (
        <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 text-center">
          <Package size={40} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-semibold">No hay pedidos del marketplace</p>
          <p className="text-slate-600 text-sm mt-1">Los pedidos asignados apareceran aqui</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-white font-bold text-sm flex items-center gap-2">
            <Package size={16} className="text-yellow-400" />
            Pedidos Marketplace ({pedidos.length})
          </h3>
          {pedidos.map((p) => (
            <div key={p.id} className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400 font-bold text-sm">#{p.codigo}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${estadoColor[p.estado] || "bg-slate-700 text-slate-400"}`}>
                    {estadoLabel[p.estado] || p.estado}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {new Date(p.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              {/* Info */}
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-slate-500 shrink-0" />
                  <span className="text-white font-semibold text-sm">{p.cliente_nombre}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-slate-500 shrink-0" />
                  <span className="text-slate-400 text-sm">{p.cliente_direccion}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Store size={14} className="text-slate-500 shrink-0" />
                  <span className="text-slate-400 text-sm">{p.negocios?.nombre || "-"}</span>
                </div>
                {p.nota && (
                  <div className="flex items-start gap-2">
                    <span className="text-slate-500 text-[10px] mt-0.5 shrink-0">NOTA:</span>
                    <span className="text-slate-400 italic text-sm">"{p.nota}"</span>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="flex justify-between items-center bg-slate-800/50 rounded-xl px-3 py-2 mb-3">
                <span className="text-slate-400 text-xs">Total</span>
                <div className="text-right">
                  <p className="text-white font-bold">{fmt(p.total)}</p>
                  {p.estado === "entregado" && p.pago_repartidor > 0 && (
                    <p className="text-green-400 text-[10px]">Ganas: {fmt(p.pago_repartidor)}</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 mb-3">
                {p.estado === "asignado" && (
                  <button onClick={() => cambiarEstado(p.id, "recogido")} className="flex-1 py-2.5 bg-blue-500/20 text-blue-400 rounded-xl text-xs font-bold hover:bg-blue-500/30 transition">
                    <span className="flex items-center justify-center gap-1.5"><Package size={14} /> Recogido</span>
                  </button>
                )}
                {p.estado === "recogido" && (
                  <button onClick={() => cambiarEstado(p.id, "en_camino")} className="flex-1 py-2.5 bg-purple-500/20 text-purple-400 rounded-xl text-xs font-bold hover:bg-purple-500/30 transition">
                    <span className="flex items-center justify-center gap-1.5"><Navigation size={14} /> En camino</span>
                  </button>
                )}
                {p.estado === "en_camino" && (
                  <button onClick={() => cambiarEstado(p.id, "entregado")} className="flex-1 py-2.5 bg-green-500/20 text-green-400 rounded-xl text-xs font-bold hover:bg-green-500/30 transition">
                    <span className="flex items-center justify-center gap-1.5"><Check size={14} /> Entregado</span>
                  </button>
                )}
              </div>

              {/* Utils */}
              {(p.estado !== "entregado" && p.estado !== "cancelado") && (
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(p.cliente_direccion)}`, "_blank")}
                    className="py-2 rounded-lg bg-slate-800 text-slate-400 text-[10px] font-semibold hover:bg-slate-700 transition flex items-center justify-center gap-1">
                    <MapPin size={12} /> Maps
                  </button>
                  <button onClick={() => window.open(`https://wa.me/57${p.cliente_telefono.replace(/\D/g, "")}`, "_blank")}
                    className="py-2 rounded-lg bg-green-500/10 text-green-400 text-[10px] font-semibold hover:bg-green-500/20 transition flex items-center justify-center gap-1">
                    <MessageCircle size={12} /> WA
                  </button>
                  <button onClick={() => { if (p.cliente_telefono) window.open(`tel:${p.cliente_telefono}`, "_blank"); }}
                    className="py-2 rounded-lg bg-slate-800 text-slate-400 text-[10px] font-semibold hover:bg-slate-700 transition flex items-center justify-center gap-1">
                    <Phone size={12} /> Llamar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
