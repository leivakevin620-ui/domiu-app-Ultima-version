"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Home, ListOrdered, MapPin, DollarSign, User, LogOut, Phone, MessageCircle, Copy, Loader2 } from "lucide-react";

const ESTADOS_FLUJO = ["Pendiente", "Asignado", "Aceptado", "Recogido", "En camino", "Entregado"];

function formatMoney(v: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v || 0);
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function RiderApp() {
  const { user, profile, logout } = useAuth();
  const sb = getSupabaseClient();
  const [tab, setTab] = useState("inicio");
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [riderData, setRiderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [estadoRider, setEstadoRider] = useState("No disponible");
  const subRef = useRef<any>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const { data: rider } = await sb.from("repartidores").select("*").eq("user_id", user.id).single();
      setRiderData(rider);
      if (rider) {
        setEstadoRider(rider.estado || "No disponible");
        const { data } = await sb.from("pedidos").select("*").eq("repartidor_id", rider.id).order("created_at", { ascending: false });
        setPedidos(data || []);
      }
    } catch (e) {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!user || !riderData) return;

    if (subRef.current) {
      sb.removeChannel(subRef.current);
    }

    const channel = supabase
      .channel("rider_pedidos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos", filter: `repartidor_id=eq.${riderData.id}` },
        () => loadData()
      )
      .subscribe();

    subRef.current = channel;

    return () => {
      sb.removeChannel(channel);
    };
  }, [user, riderData, loadData]);

  async function updateEstado(id: string, nuevo: string) {
    const { error } = await sb.from("pedidos").update({ estado: nuevo }).eq("id", id);
    if (!error) {
      toast.success(`Estado: ${nuevo}`);
      if (nuevo === "Entregado") {
        setEstadoRider("Disponible");
        await sb.from("repartidores").update({ estado: "Disponible" }).eq("id", riderData.id);
      }
      loadData();
    } else toast.error(error.message);
  }

  async function cambiarEstadoRider(estado: string) {
    if (!riderData) return;
    const { error } = await sb.from("repartidores").update({ estado }).eq("id", riderData.id);
    if (!error) {
      setEstadoRider(estado);
      toast.success(`Ahora est�s: ${estado}`);
    } else toast.error(error.message);
  }

  const entregados = pedidos.filter((p) => p.estado === "Entregado");
  const activos = pedidos.filter((p) => !["Entregado", "Cancelado"].includes(p.estado));
  const ganancia = entregados.reduce((a, b) => a + (b.pago_repartidor || 0), 0);

  function copyInfo(p: any) {
    const text = `Pedido: #${p.codigo}\nCliente: ${p.cliente}\nContacto: ${p.telefono}\nDirecci�n: ${p.direccion}\nBarrio: ${p.barrio}\nTarifa: ${formatMoney(p.precio)}\nTu pago: ${formatMoney(p.pago_repartidor)}\nFecha: ${formatearFecha(p.created_at)}`;
    navigator.clipboard.writeText(text);
    toast.success("Copiado al portapapeles");
  }

  function getEstadoColor(estado: string) {
    switch (estado) {
      case "Pendiente": return "bg-slate-700 text-slate-300";
      case "Asignado": return "bg-yellow-500/20 text-yellow-400";
      case "Aceptado": return "bg-blue-500/20 text-blue-400";
      case "Recogido": return "bg-purple-500/20 text-purple-400";
      case "En camino": return "bg-indigo-500/20 text-indigo-400";
      case "Entregado": return "bg-green-500/20 text-green-400";
      case "Cancelado": return "bg-red-500/20 text-red-400";
      default: return "bg-slate-700 text-slate-300";
    }
  }

  const estadoColors: Record<string, string> = {
    "Disponible": "bg-green-500 text-white",
    "Ocupado": "bg-yellow-500 text-black",
    "No disponible": "bg-red-500 text-white",
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-yellow-400" size={48} /></div>;

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden">
      <header className="bg-slate-900 p-4 flex justify-between items-center border-b border-slate-800 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-slate-900 font-bold">
            {(profile?.nombre || riderData?.nombre || "R")?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="font-bold text-white text-sm">{profile?.nombre || riderData?.nombre}</h1>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${estadoColors[estadoRider] || "bg-slate-700 text-slate-400"}`}>
              {estadoRider}
            </span>
          </div>
        </div>
        <button onClick={() => { logout(); }} className="text-slate-400 hover:text-white"><LogOut size={20} /></button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-24">
        {tab === "inicio" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-400">Ganancia Turno</p>
                <p className="text-xl font-bold text-yellow-400">{formatMoney(ganancia)}</p>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-400">Entregados</p>
                <p className="text-xl font-bold text-green-400">{entregados.length}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-slate-400 mb-2 font-semibold">Tu disponibilidad</p>
              <div className="flex gap-2">
                <button onClick={() => cambiarEstadoRider("Disponible")} className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-bold transition ${estadoRider === "Disponible" ? "bg-green-500 text-white shadow-lg shadow-green-500/30" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>Disponible</button>
                <button onClick={() => cambiarEstadoRider("Ocupado")} className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-bold transition ${estadoRider === "Ocupado" ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/30" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>Ocupado</button>
                <button onClick={() => cambiarEstadoRider("No disponible")} className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-bold transition ${estadoRider === "No disponible" ? "bg-red-500 text-white shadow-lg shadow-red-500/30" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>No disponible</button>
              </div>
            </div>

            <h3 className="font-bold text-white mt-4">Pedidos Activos ({activos.length})</h3>
            {activos.length === 0 ? <p className="text-slate-500 text-center py-8">Sin pedidos pendientes</p> :
              activos.map((p) => (
                <div key={p.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                  <div className="flex justify-between mb-1">
                    <span className="text-yellow-400 font-bold">{p.codigo}</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${getEstadoColor(p.estado)}`}>{p.estado}</span>
                  </div>
                  <h4 className="text-white font-semibold">{p.cliente}</h4>
                  <p className="text-sm text-slate-400">{p.direccion}</p>
                  {p.barrio && <p className="text-xs text-slate-500">{p.barrio}</p>}
                </div>
              ))
            }
          </div>
        )}

        {tab === "pedidos" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Mis Pedidos</h2>
            {activos.length === 0 ? <p className="text-slate-500 text-center py-8">No hay pedidos activos</p> :
              activos.map((p) => (
                <div key={p.id} className="bg-slate-900 p-5 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-yellow-400 font-bold">{p.codigo}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ml-2 ${getEstadoColor(p.estado)}`}>{p.estado}</span>
                    </div>
                    <span className="text-sm text-slate-400">{formatearFecha(p.created_at)}</span>
                  </div>
                  <h3 className="text-white text-lg font-bold">{p.cliente}</h3>
                  <p className="text-slate-400 mb-1">{p.direccion}</p>
                  {p.barrio && <p className="text-sm text-slate-500 mb-3">Barrio: {p.barrio}</p>}
                  <p className="text-sm text-slate-400 mb-4">Tel: {p.telefono || "N/A"}</p>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {p.telefono && <a href={`https://wa.me/57${p.telefono.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm font-semibold hover:bg-green-500/30 transition"><MessageCircle size={16} /> WhatsApp</a>}
                    {p.telefono && <a href={`tel:${p.telefono}`} className="flex items-center justify-center gap-2 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-700 transition"><Phone size={16} /> Llamar</a>}
                    <button onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(p.direccion)}`, "_blank")} className="flex items-center justify-center gap-2 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-semibold hover:bg-blue-500/30 transition"><MapPin size={16} /> Mapa</button>
                    <button onClick={() => copyInfo(p)} className="flex items-center justify-center gap-2 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-700 transition"><Copy size={16} /> Copiar</button>
                  </div>

                  {p.notas && <p className="text-sm text-yellow-400/80 bg-yellow-400/10 p-2 rounded-lg mb-3">Nota: {p.notas}</p>}

                  <div className="space-y-2">
                    {(p.estado === "Pendiente" || p.estado === "Asignado") && <button onClick={() => updateEstado(p.id, "Aceptado")} className="w-full py-3 bg-yellow-400 text-slate-900 font-bold rounded-lg hover:bg-yellow-300 transition">Aceptar Pedido</button>}
                    {p.estado === "Aceptado" && <button onClick={() => updateEstado(p.id, "Recogido")} className="w-full py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-400 transition">Recogido</button>}
                    {p.estado === "Recogido" && <button onClick={() => updateEstado(p.id, "En camino")} className="w-full py-3 bg-purple-500 text-white font-bold rounded-lg hover:bg-purple-400 transition">En Camino</button>}
                    {p.estado === "En camino" && <button onClick={() => updateEstado(p.id, "Entregado")} className="w-full py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-400 transition">Entregado</button>}
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {tab === "mapa" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Ruta de Pedidos</h2>
            {activos.length === 0 ? <p className="text-slate-500 text-center py-8">No hay direcciones para visitar</p> :
              activos.map((p) => (
                <div key={p.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="text-yellow-400 text-sm font-bold">{p.codigo}</span>
                    <p className="text-white">{p.direccion}</p>
                    {p.barrio && <p className="text-xs text-slate-500">{p.barrio}</p>}
                  </div>
                  <button onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(p.direccion)}`, "_blank")} className="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold text-sm hover:bg-blue-400 transition">Ir</button>
                </div>
              ))
            }
          </div>
        )}

        {tab === "liquidacion" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Mi Liquidaci�n</h2>
            <div className="bg-yellow-400/10 p-6 rounded-xl border border-yellow-400/30 text-center">
              <p className="text-yellow-400 text-sm">Total a Recibir</p>
              <h1 className="text-4xl font-bold text-yellow-400">{formatMoney(ganancia)}</h1>
              <p className="text-slate-400 text-sm mt-1">{entregados.length} pedidos entregados</p>
            </div>
            {entregados.length > 0 ? (
              <div className="space-y-2">
                {entregados.map((p) => (
                  <div key={p.id} className="flex justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div>
                      <span className="text-yellow-400 text-sm font-semibold">{p.codigo}</span>
                      <p className="text-slate-400 text-xs">{p.cliente}</p>
                    </div>
                    <span className="text-green-400 font-bold">{formatMoney(p.pago_repartidor)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-slate-500 text-center py-8">A�n no hay entregas</p>}
          </div>
        )}

        {tab === "perfil" && (
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
            <h2 className="text-xl font-bold text-white">Mi Perfil</h2>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Nombre</span>
                <span className="text-white font-semibold">{profile?.nombre || riderData?.nombre}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Tel�fono</span>
                <span className="text-white font-semibold">{riderData?.telefono || "No registrado"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Documento</span>
                <span className="text-white font-semibold">{riderData?.documento || "No registrado"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Veh�culo</span>
                <span className="text-white font-semibold">{riderData?.vehiculo || "No registrado"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Placa</span>
                <span className="text-white font-semibold">{riderData?.placa || "No registrado"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Email</span>
                <span className="text-white font-semibold text-sm">{profile?.email}</span>
              </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-around items-center p-2 z-50">
        {[{ id: "inicio", icon: Home }, { id: "pedidos", icon: ListOrdered }, { id: "mapa", icon: MapPin }, { id: "liquidacion", icon: DollarSign }, { id: "perfil", icon: User }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center p-2 rounded transition ${tab === t.id ? "text-yellow-400" : "text-slate-500 hover:text-slate-300"}`}>
            <t.icon size={20} />
            <span className="text-[9px] mt-1 capitalize">{t.id}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
