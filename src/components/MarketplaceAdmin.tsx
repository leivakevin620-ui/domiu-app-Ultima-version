"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Package, Users, Search, Filter, X, ChevronDown, ChevronUp,
  DollarSign, Truck, TrendingUp, Clock, Phone, MapPin, Store,
  CheckCircle, AlertCircle, RefreshCw, ChevronRight, MessageCircle
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

const ESTADOS = ["recibido", "en_preparacion", "listo_para_recoger", "asignado", "en_camino", "entregado", "cancelado"];

const estadoColor: Record<string, string> = {
  recibido: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  en_preparacion: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  listo_para_recoger: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  asignado: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  en_camino: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  entregado: "bg-green-500/10 text-green-400 border-green-500/20",
  cancelado: "bg-red-500/10 text-red-400 border-red-500/20",
};

const estadoLabel: Record<string, string> = {
  recibido: "Recibido",
  en_preparacion: "Preparacion",
  listo_para_recoger: "Listo",
  asignado: "Asignado",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v || 0);

function waLink(num: string, msg: string) {
  return `https://wa.me/57${num.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
}

type PedidoMarket = {
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
  repartidor_id: string | null;
  costo_envio: number;
  comision_empresa: number;
  pago_repartidor: number;
  ganancia_empresa: number;
  created_at: string;
  negocios: { nombre: string } | null;
  repartidores: { nombre: string; vehiculo: string; telefono: string } | null;
};

export default function MarketplaceAdmin() {
  const sb = getSupabaseClient();
  const [pedidos, setPedidos] = useState<PedidoMarket[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fEstado, setFEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [detalle, setDetalle] = useState<string | null>(null);
  const [asignando, setAsignando] = useState<string | null>(null);
  const [repartidorSel, setRepartidorSel] = useState("");

  const fetchPedidos = useCallback(async () => {
    if (!sb) return;
    let q = sb.from("pedidos_cliente").select("*, negocios(nombre), repartidores!left(nombre, vehiculo, telefono)").order("created_at", { ascending: false });
    if (fEstado) q = q.eq("estado", fEstado);
    const { data } = await q;
    if (data) setPedidos(data);
    setLoading(false);
  }, [fEstado, sb]);

  const fetchReps = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb.from("repartidores").select("*");
    if (data) setReps(data);
  }, [sb]);

  useEffect(() => { fetchPedidos(); }, [fetchPedidos]);
  useEffect(() => { fetchReps(); }, [fetchReps]);

  // Realtime
  useEffect(() => {
    if (!sb) return;
    const sub = sb.channel("admin-marketplace").on("postgres_changes", { event: "*", schema: "public", table: "pedidos_cliente" }, () => fetchPedidos()).subscribe();
    return () => { sub.unsubscribe(); };
  }, [sb, fetchPedidos]);

  const cambiarEstado = async (id: string, nuevoEstado: string) => {
    const update: any = { estado: nuevoEstado, actualizado_en: new Date().toISOString() };
    if (nuevoEstado === "en_preparacion") update.estado_negocio = "en_preparacion";
    if (nuevoEstado === "listo_para_recoger") update.estado_negocio = "listo_para_recoger";
    if (nuevoEstado === "asignado" || nuevoEstado === "en_camino" || nuevoEstado === "entregado") {
      update.estado_negocio = nuevoEstado === "asignado" ? "listo_para_recoger" : nuevoEstado === "en_camino" ? "listo_para_recoger" : "listo_para_recoger";
    }
    const comision = Math.round((update.costo_envio || 0) * 0.2);
    if (nuevoEstado === "entregado") {
      update.comision_empresa = comision;
      update.pago_repartidor = (update.costo_envio || 0) - comision;
      update.ganancia_empresa = comision;
    }
    await sb.from("pedidos_cliente").update(update).eq("id", id);
    fetchPedidos();
  };

  const asignarRepartidor = async () => {
    if (!asignando || !repartidorSel) return;
    const rep = reps.find((r: any) => r.id === repartidorSel);
    await sb.from("pedidos_cliente").update({
      repartidor_id: repartidorSel,
      estado: "asignado",
      estado_negocio: "listo_para_recoger",
      actualizado_en: new Date().toISOString(),
    }).eq("id", asignando);
    setAsignando(null);
    setRepartidorSel("");
    fetchPedidos();
  };

  const filtered = busqueda ? pedidos.filter((p) =>
    p.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.cliente_telefono.includes(busqueda)
  ) : pedidos;

  // Stats
  const stats = {
    totalVendido: pedidos.filter((p) => p.estado === "entregado").reduce((s, p) => s + p.total, 0),
    enviosCobrados: pedidos.filter((p) => p.estado === "entregado").reduce((s, p) => s + (p.domicilio || 0), 0),
    comision: pedidos.filter((p) => p.estado === "entregado").reduce((s, p) => s + (p.comision_empresa || Math.round((p.domicilio || 0) * 0.2)), 0),
    ganancia: pedidos.filter((p) => p.estado === "entregado").reduce((s, p) => s + (p.ganancia_empresa || Math.round((p.domicilio || 0) * 0.2)), 0),
    pagoRep: pedidos.filter((p) => p.estado === "entregado").reduce((s, p) => s + (p.pago_repartidor || (p.domicilio || 0) - Math.round((p.domicilio || 0) * 0.2)), 0),
    pendientes: pedidos.filter((p) => p.estado === "recibido" || p.estado === "en_preparacion" || p.estado === "listo_para_recoger").length,
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <DollarSign size={18} className="text-yellow-400 mb-2" />
          <p className="text-lg font-bold text-white">{fmt(stats.totalVendido)}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total vendido</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <Truck size={18} className="text-blue-400 mb-2" />
          <p className="text-lg font-bold text-white">{fmt(stats.enviosCobrados)}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Envios cobrados</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <TrendingUp size={18} className="text-green-400 mb-2" />
          <p className="text-lg font-bold text-white">{fmt(stats.comision)}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Comision DomiU</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <Users size={18} className="text-purple-400 mb-2" />
          <p className="text-lg font-bold text-white">{fmt(stats.pagoRep)}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Pago repartidor</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <Package size={18} className="text-orange-400 mb-2" />
          <p className="text-lg font-bold text-white">{fmt(stats.ganancia)}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Ganancia empresa</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" placeholder="Buscar por codigo, cliente, telefono..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/50 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-yellow-400" />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          <button onClick={() => setFEstado("")} className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap ${!fEstado ? "bg-yellow-400 text-slate-900" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>Todos</button>
          {ESTADOS.map((est) => (
            <button key={est} onClick={() => setFEstado(est)} className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap ${fEstado === est ? "bg-yellow-400 text-slate-900" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>{estadoLabel[est]}</button>
          ))}
        </div>
        <button onClick={fetchPedidos} className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700"><RefreshCw size={16} /></button>
      </div>

      {/* Assign rider modal */}
      {asignando && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setAsignando(null)}>
          <div className="bg-slate-900 rounded-2xl p-6 max-w-sm w-full border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-white">Asignar repartidor</h3><button onClick={() => setAsignando(null)}><X size={20} className="text-slate-400" /></button></div>
            <select value={repartidorSel} onChange={(e) => setRepartidorSel(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white text-sm mb-4 outline-none focus:border-yellow-400">
              <option value="">Seleccionar repartidor</option>
              {reps.filter((r: any) => r.activo !== false).map((r: any) => (
                <option key={r.id} value={r.id}>{r.nombre} - {r.vehiculo} - {r.telefono}</option>
              ))}
            </select>
            {reps.filter((r: any) => r.activo !== false).length === 0 && <p className="text-xs text-slate-500 mb-4">No hay repartidores activos</p>}
            <div className="flex gap-2">
              <button onClick={() => setAsignando(null)} className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-400 font-semibold text-sm">Cancelar</button>
              <button onClick={asignarRepartidor} disabled={!repartidorSel} className="flex-1 py-3 rounded-xl bg-yellow-400 text-slate-900 font-bold text-sm disabled:opacity-50">Asignar</button>
            </div>
          </div>
        </div>
      )}

      {/* Orders table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50 text-slate-400 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Codigo</th>
                <th className="text-left px-4 py-3 font-semibold">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Negocio</th>
                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Total</th>
                <th className="text-left px-4 py-3 font-semibold">Estado</th>
                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Repartidor</th>
                <th className="text-left px-4 py-3 font-semibold">Hora</th>
                <th className="text-left px-4 py-3 font-semibold">Accion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500">No hay pedidos</td></tr>
              ) : (
                filtered.map((p) => (
                  <>
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => setDetalle(detalle === p.id ? null : p.id)}>
                      <td className="px-4 py-3 font-mono text-yellow-400 font-bold text-xs">#{p.codigo}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-white text-sm">{p.cliente_nombre}</p>
                        <p className="text-[11px] text-slate-500">{p.cliente_telefono}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-sm hidden md:table-cell">{p.negocios?.nombre || "-"}</td>
                      <td className="px-4 py-3 font-semibold text-white hidden lg:table-cell">{fmt(p.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${estadoColor[p.estado] || "bg-slate-700 text-slate-400"}`}>
                          {estadoLabel[p.estado] || p.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm hidden lg:table-cell">
                        {p.repartidores ? (
                          <div><p className="text-white text-sm">{p.repartidores.nombre}</p><p className="text-[11px] text-slate-500">{p.repartidores.vehiculo}</p></div>
                        ) : <span className="text-slate-600">Sin asignar</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{new Date(p.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="px-4 py-3">
                        {detalle === p.id ? <ChevronUp size={18} className="text-yellow-400" /> : <ChevronDown size={18} className="text-slate-500" />}
                      </td>
                    </tr>
                    {detalle === p.id && (
                      <tr key={`${p.id}-detalle`}>
                        <td colSpan={8} className="px-4 py-4 bg-slate-800/20">
                          <div className="grid md:grid-cols-2 gap-4">
                            {/* Info cliente */}
                            <div className="bg-slate-800/50 rounded-xl p-4">
                              <h4 className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">Datos del cliente</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2"><Phone size={14} className="text-slate-500" /><a href={`tel:${p.cliente_telefono}`} className="text-white hover:text-yellow-400">{p.cliente_telefono}</a></div>
                                <div className="flex items-center gap-2"><MapPin size={14} className="text-slate-500" /><span className="text-slate-300">{p.cliente_direccion}</span></div>
                                {p.nota && <div className="flex items-start gap-2"><span className="text-slate-500 text-[10px] mt-0.5">NOTA:</span><span className="text-slate-400 italic">&quot;{p.nota}&quot;</span></div>}
                                <a href={waLink(p.cliente_telefono, `Hola ${p.cliente_nombre}, soy de DomiU Magdalena. Tu pedido #${p.codigo} esta: ${estadoLabel[p.estado]}`)} target="_blank" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-semibold mt-2 hover:bg-green-500/20">
                                  <MessageCircle size={14} /> WhatsApp
                                </a>
                              </div>
                            </div>
                            {/* Acciones */}
                            <div className="bg-slate-800/50 rounded-xl p-4">
                              <h4 className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">Acciones</h4>
                              <div className="flex flex-wrap gap-1.5">
                                {ESTADOS.map((est) => {
                                  const idx = ESTADOS.indexOf(est);
                                  const currentIdx = ESTADOS.indexOf(p.estado);
                                  const disabled = est === p.estado || (idx < currentIdx && est !== "cancelado");
                                  return (
                                    <button key={est} onClick={() => cambiarEstado(p.id, est)} disabled={disabled} className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border ${est === p.estado ? "bg-yellow-400/20 text-yellow-400 border-yellow-400/30" : disabled ? "bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed" : "bg-slate-700 text-slate-300 border-slate-600 hover:bg-yellow-400/10 hover:text-yellow-400"}`}>
                                    {estadoLabel[est]}
                                  </button>
                                  );
                                })}
                              </div>
                            </div>
                            {/* Asignar repartidor */}
                            <div className="bg-slate-800/50 rounded-xl p-4">
                              <h4 className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">Repartidor</h4>
                              {p.repartidores ? (
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">{p.repartidores.nombre[0]}</div>
                                  <div><p className="font-semibold text-white text-sm">{p.repartidores.nombre}</p><p className="text-[11px] text-slate-500">{p.repartidores.vehiculo}</p></div>
                                </div>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); setAsignando(p.id); }} className="px-4 py-2 rounded-xl bg-yellow-400/10 text-yellow-400 text-xs font-semibold border border-yellow-400/20 hover:bg-yellow-400/20">
                                  Asignar repartidor
                                </button>
                              )}
                            </div>
                            {/* Financiero */}
                            <div className="bg-slate-800/50 rounded-xl p-4">
                              <h4 className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">Resumen financiero</h4>
                              <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between"><span className="text-slate-400">Subtotal</span><span className="text-white">{fmt(p.subtotal)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Envio</span><span className="text-white">{fmt(p.domicilio)}</span></div>
                                <div className="h-px bg-slate-700 my-1.5" />
                                <div className="flex justify-between font-bold"><span className="text-white">Total</span><span className="text-yellow-400">{fmt(p.total)}</span></div>
                                <div className="h-px bg-slate-700 my-1.5" />
                                <div className="flex justify-between text-xs"><span className="text-slate-500">Comision DomiU</span><span className="text-green-400">{fmt(p.comision_empresa || Math.round((p.domicilio || 0) * 0.2))}</span></div>
                                <div className="flex justify-between text-xs"><span className="text-slate-500">Pago repartidor</span><span className="text-blue-400">{fmt(p.pago_repartidor || (p.domicilio - Math.round((p.domicilio || 0) * 0.2)))}</span></div>
                                <div className="flex justify-between text-xs"><span className="text-slate-500">Ganancia empresa</span><span className="text-purple-400">{fmt(p.ganancia_empresa || Math.round((p.domicilio || 0) * 0.2))}</span></div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
