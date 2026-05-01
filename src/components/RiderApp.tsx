"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Home, ListOrdered, MapPin, DollarSign, User, LogOut, Phone, MessageCircle, Copy, Loader2, Clock, AlertTriangle } from "lucide-react";

function RealTimeClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      const h = d.getHours();
      setTime(p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() + " " + p(h % 12 || 12) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()) + " " + (h >= 12 ? "PM" : "AM"));
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);
  return <span className="text-xs text-slate-500 font-mono">{time}</span>;
}

export default function RiderApp() {
  const { user, profile, logout } = useAuth();
  const [tab, setTab] = useState("inicio");
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [riderData, setRiderData] = useState<any>(null);
  const [locales, setLocales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportText, setReportText] = useState("");

  const loadData = useCallback(async () => {
    if (!user) return;
    const { data: rider } = await supabase.from("repartidores").select("*").eq("user_id", user.id).single();
    setRiderData(rider);
    const { data: locs } = await supabase.from("locales").select("*");
    setLocales(locs || []);
    if (rider) {
      const { data } = await supabase.from("pedidos").select("*").eq("repartidor_id", rider.id).order("created_at", { ascending: false });
      setPedidos(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); const i = setInterval(loadData, 10000); return () => clearInterval(i); }, [loadData]);

  async function updateEstado(id: string, nuevo: string) {
    const { error } = await supabase.from("pedidos").update({ estado: nuevo }).eq("id", id);
    if (!error) loadData();
  }

  async function setEstado(estado: string) {
    if (!riderData) return;
    const { error } = await supabase.from("repartidores").update({ estado }).eq("id", riderData.id);
    if (!error) loadData();
  }

  async function reportarProblema(id: string) {
    if (!reportText.trim()) return;
    const { error } = await supabase.from("pedidos").update({ estado: "Problema" }).eq("id", id);
    if (!error) { setReportText(""); setReportingId(null); loadData(); }
  }

  const entregados = pedidos.filter(p => p.estado === "Entregado");
  const activos = pedidos.filter(p => !["Entregado", "Cancelado"].includes(p.estado));
  const ganancia = entregados.reduce((a, b) => a + (b.pago_repartidor || 0), 0);

  function copyInfo(p: any) {
    const loc = locales.find(l => l.id === p.local_id)?.nombre || "Sin local";
    const fecha = new Date(p.created_at).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const text = "Pedido: #" + p.codigo + "\nCliente: " + p.cliente + "\nContacto: " + p.telefono + "\nDireccion: " + p.direccion + "\nLocal: " + loc + "\nTarifa: $" + p.precio + "\nFecha y hora: " + fecha;
    navigator.clipboard.writeText(text);
  }

  function getLocalName(localId: string) {
    const loc = locales.find(l => l.id === localId);
    return loc ? loc.nombre : "Sin local";
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-yellow-400" size={48} /></div>;

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* HEADER */}
      <header className="bg-slate-900 px-4 py-3 flex justify-between items-center border-b border-slate-800 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-slate-900 font-bold text-lg">
            {profile?.nombre?.charAt(0)}
          </div>
          <div>
            <h1 className="font-bold text-white text-sm">{profile?.nombre}</h1>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                riderData?.estado === 'Disponible' ? 'bg-green-500 text-white' :
                riderData?.estado === 'Ocupado' ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-slate-400'
              }`}>{riderData?.estado || 'No disponible'}</span>
              <RealTimeClock />
            </div>
          </div>
        </div>
        <button onClick={logout} className="text-slate-400 hover:text-white"><LogOut size={20}/></button>
      </header>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">

        {/* INICIO */}
        {tab === "inicio" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400 mb-1">Ganancia Turno</p>
                <p className="text-2xl font-black text-yellow-400">${ganancia.toLocaleString()}</p>
              </div>
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400 mb-1">Entregados</p>
                <p className="text-2xl font-black text-green-400">{entregados.length}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Disponibilidad</p>
              <div className="flex gap-2">
                <button onClick={() => setEstado('Disponible')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${riderData?.estado === 'Disponible' ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-slate-800 text-slate-300'}`}>Disponible</button>
                <button onClick={() => setEstado('Ocupado')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${riderData?.estado === 'Ocupado' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-slate-800 text-slate-300'}`}>Ocupado</button>
                <button onClick={() => setEstado('No disponible')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${riderData?.estado === 'No disponible' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-slate-800 text-slate-300'}`}>No disp.</button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Pedidos Activos ({activos.length})</p>
              {activos.length === 0 ? (
                <div className="text-center py-10 bg-slate-900 rounded-2xl border border-slate-800">
                  <Clock size={32} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-slate-500 text-sm">Sin pedidos pendientes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activos.map(p => (
                    <div key={p.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-yellow-400 font-bold text-sm">#{p.codigo}</span>
                          <p className="text-white font-semibold">{p.cliente}</p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 font-bold">{p.estado}</span>
                      </div>
                      <p className="text-sm text-slate-400">{p.direccion}</p>
                      <p className="text-xs text-slate-500 mt-1">{getLocalName(p.local_id)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* PEDIDOS */}
        {tab === "pedidos" && (
          <div className="space-y-4">
            <p className="text-lg font-bold text-white">Mis Pedidos ({activos.length})</p>
            {activos.length === 0 && (
              <div className="text-center py-10 bg-slate-900 rounded-2xl border border-slate-800">
                <ListOrdered size={32} className="mx-auto text-slate-600 mb-2" />
                <p className="text-slate-500 text-sm">No hay pedidos activos</p>
              </div>
            )}
            {activos.map(p => (
              <div key={p.id} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-yellow-400 font-bold text-lg">#{p.codigo}</span>
                    <span className="ml-2 text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 font-bold">{p.estado}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-slate-800/50 p-3 rounded-xl"><p className="text-xs text-slate-500">Cliente</p><p className="text-white font-semibold">{p.cliente}</p></div>
                  <div className="bg-slate-800/50 p-3 rounded-xl"><p className="text-xs text-slate-500">Telefono</p><p className="text-white">{p.telefono}</p></div>
                  <div className="bg-slate-800/50 p-3 rounded-xl col-span-2"><p className="text-xs text-slate-500">Direccion</p><p className="text-white">{p.direccion}</p></div>
                  <div className="bg-slate-800/50 p-3 rounded-xl"><p className="text-xs text-slate-500">Local</p><p className="text-white">{getLocalName(p.local_id)}</p></div>
                  <div className="bg-slate-800/50 p-3 rounded-xl"><p className="text-xs text-slate-500">Tarifa</p><p className="text-yellow-400 font-bold">${p.precio?.toLocaleString()}</p></div>
                  <div className="bg-slate-800/50 p-3 rounded-xl"><p className="text-xs text-slate-500">Pago</p><p className="text-white">{p.metodo_pago || "Efectivo"}</p></div>
                  <div className="bg-slate-800/50 p-3 rounded-xl"><p className="text-xs text-slate-500">Fecha</p><p className="text-white text-xs">{new Date(p.created_at).toLocaleString("es-CO")}</p></div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <a href={"https://wa.me/57" + p.telefono} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-3 bg-green-500/10 text-green-400 rounded-xl font-semibold text-sm border border-green-500/20"><MessageCircle size={16}/> WhatsApp</a>
                  <a href={"tel:" + p.telefono} className="flex items-center justify-center gap-2 py-3 bg-slate-800 text-slate-300 rounded-xl font-semibold text-sm"><Phone size={16}/> Llamar</a>
                  <button onClick={() => window.open("https://maps.google.com/?q=" + encodeURIComponent(p.direccion))} className="flex items-center justify-center gap-2 py-3 bg-blue-500/10 text-blue-400 rounded-xl font-semibold text-sm border border-blue-500/20"><MapPin size={16}/> Mapa</button>
                  <button onClick={() => copyInfo(p)} className="flex items-center justify-center gap-2 py-3 bg-slate-800 text-slate-300 rounded-xl font-semibold text-sm"><Copy size={16}/> Copiar</button>
                </div>

                <div className="space-y-2 pt-2">
                  {p.estado === 'Asignado' && <button onClick={() => updateEstado(p.id, 'Aceptado')} className="w-full py-3.5 bg-yellow-400 text-slate-900 font-bold rounded-xl">Aceptar Pedido</button>}
                  {p.estado === 'Aceptado' && <button onClick={() => updateEstado(p.id, 'Recogido')} className="w-full py-3.5 bg-blue-500 text-white font-bold rounded-xl">Recogido</button>}
                  {p.estado === 'Recogido' && <button onClick={() => updateEstado(p.id, 'En camino')} className="w-full py-3.5 bg-purple-500 text-white font-bold rounded-xl">En Camino</button>}
                  {p.estado === 'En camino' && <button onClick={() => updateEstado(p.id, 'Entregado')} className="w-full py-3.5 bg-green-500 text-white font-bold rounded-xl">Entregado</button>}
                  {!['Problema', 'Entregado', 'Cancelado'].includes(p.estado) && (
                    reportingId === p.id ? (
                      <div className="space-y-2">
                        <input value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="Describe el problema..." className="w-full p-3 bg-slate-800 rounded-xl text-sm text-white border border-slate-700" />
                        <div className="flex gap-2">
                          <button onClick={() => reportarProblema(p.id)} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl text-sm">Enviar reporte</button>
                          <button onClick={() => { setReportingId(null); setReportText(""); }} className="px-4 py-3 bg-slate-800 text-slate-300 rounded-xl text-sm">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setReportingId(p.id)} className="w-full py-3 bg-red-500/10 text-red-400 font-bold rounded-xl border border-red-500/20 flex items-center justify-center gap-2"><AlertTriangle size={16}/> Reportar problema</button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MAPA */}
        {tab === "mapa" && (
          <div className="space-y-4">
            <p className="text-lg font-bold text-white">Ruta de Pedidos</p>
            {activos.length === 0 ? (
              <div className="text-center py-10 bg-slate-900 rounded-2xl border border-slate-800">
                <MapPin size={32} className="mx-auto text-slate-600 mb-2" />
                <p className="text-slate-500 text-sm">Sin pedidos en ruta</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activos.map((p, i) => (
                  <div key={p.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-yellow-400/20 flex items-center justify-center text-yellow-400 font-bold text-sm flex-shrink-0">{i + 1}</div>
                      <div className="flex-1">
                        <span className="text-yellow-400 text-sm font-bold">#{p.codigo}</span>
                        <p className="text-white">{p.direccion}</p>
                        <p className="text-xs text-slate-500">{p.cliente}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => window.open("https://maps.google.com/?q=" + encodeURIComponent(p.direccion))} className="flex-1 py-2.5 bg-blue-500/10 text-blue-400 rounded-xl font-bold text-sm border border-blue-500/20">Ir ahora</button>
                      <a href={"https://wa.me/57" + p.telefono} target="_blank" rel="noreferrer" className="flex-1 py-2.5 bg-green-500/10 text-green-400 rounded-xl font-bold text-sm border border-green-500/20 text-center">Contactar</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LIQUIDACION */}
        {tab === "liquidacion" && (
          <div className="space-y-4">
            <p className="text-lg font-bold text-white">Mi Liquidacion</p>
            <div className="bg-gradient-to-br from-yellow-400/10 to-yellow-400/5 p-6 rounded-2xl border border-yellow-400/20 text-center">
              <p className="text-yellow-400 text-sm mb-1">Total a Recibir</p>
              <h1 className="text-4xl font-black text-yellow-400">${ganancia.toLocaleString()}</h1>
            </div>
            <div className="space-y-2">
              {entregados.length === 0 && (
                <div className="text-center py-10 bg-slate-900 rounded-2xl border border-slate-800">
                  <DollarSign size={32} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-slate-500 text-sm">Sin entregas aun</p>
                </div>
              )}
              {entregados.map(p => (
                <div key={p.id} className="flex justify-between items-center p-4 bg-slate-900 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-yellow-400 text-sm font-bold">#{p.codigo}</span>
                    <p className="text-white text-sm">{p.cliente}</p>
                  </div>
                  <span className="text-green-400 font-bold text-lg">+${p.pago_repartidor?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PERFIL */}
        {tab === "perfil" && (
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-yellow-400 flex items-center justify-center text-slate-900 font-black text-2xl">{profile?.nombre?.charAt(0)}</div>
              <div>
                <h2 className="text-xl font-bold text-white">{profile?.nombre}</h2>
                <p className="text-sm text-slate-500">{profile?.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { label: "Telefono", value: riderData?.telefono },
                { label: "Documento", value: riderData?.documento },
                { label: "Vehiculo", value: riderData?.vehiculo },
                { label: "Placa", value: riderData?.placa },
                { label: "Estado", value: riderData?.estado || "No disponible" },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-slate-800/50 rounded-xl">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">{item.label}</p>
                  <p className="text-white font-semibold text-sm">{item.value || "N/A"}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-around items-center py-2 px-1 z-50">
        {[
          { id: 'inicio', icon: Home, label: 'Inicio' },
          { id: 'pedidos', icon: ListOrdered, label: 'Pedidos' },
          { id: 'mapa', icon: MapPin, label: 'Mapa' },
          { id: 'liquidacion', icon: DollarSign, label: 'Liquidacion' },
          { id: 'perfil', icon: User, label: 'Perfil' }
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all ${tab === t.id ? 'text-yellow-400' : 'text-slate-500'}`}>
            <t.icon size={22} strokeWidth={tab === t.id ? 2.5 : 2} />
            <span className="text-[10px] mt-1 font-semibold">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
