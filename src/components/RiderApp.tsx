"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Home, ListOrdered, MapPin, DollarSign, User, LogOut, Phone, MessageCircle, Copy, Loader2 } from "lucide-react";

function RealTimeClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () => {
      const d = new Date();
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      let h = d.getHours();
      const ampm = h >= 12 ? "p. m." : "a. m.";
      h = h % 12 || 12;
      const hh = String(h).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      const sec = String(d.getSeconds()).padStart(2, "0");
      setTime(dd + "/" + mm + "/" + yyyy + " " + hh + ":" + min + ":" + sec + " " + ampm);
    };
    update();
    const i = setInterval(update, 1000);
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
    if (!error) { loadData(); }
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

  const entregados = pedidos.filter(function(p) { return p.estado === "Entregado"; });
  const activos = pedidos.filter(function(p) { return ["Entregado", "Cancelado"].indexOf(p.estado) === -1; });
  const ganancia = entregados.reduce(function(a, b) { return a + (b.pago_repartidor || 0); }, 0);

  function copyInfo(p) {
    var loc = "Sin local";
    for (var i = 0; i < locales.length; i++) {
      if (locales[i].id === p.local_id) { loc = locales[i].nombre; break; }
    }
    if (p.local_nombre) loc = p.local_nombre;
    var fecha = new Date(p.created_at).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    var text = "Pedido: #" + p.codigo + "\nCliente: " + p.cliente + "\nContacto: " + p.telefono + "\nDireccion: " + p.direccion + "\nLocal: " + loc + "\nTarifa: $" + p.precio + "\nFecha y hora: " + fecha;
    navigator.clipboard.writeText(text);
  }

  function getLocalName(localId) {
    for (var i = 0; i < locales.length; i++) {
      if (locales[i].id === localId) return locales[i].nombre;
    }
    return "Sin local";
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-yellow-400" size={48} /></div>;

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden">
      <header className="bg-slate-900 p-4 flex justify-between items-center border-b border-slate-800 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-slate-900 font-bold text-lg">
            {profile?.nombre?.charAt(0)}
          </div>
          <div>
            <h1 className="font-bold text-white text-sm">{profile?.nombre}</h1>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                riderData?.estado === 'Disponible' ? 'bg-green-500 text-white' :
                riderData?.estado === 'Ocupado' ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-slate-400'
              }`}>
                {riderData?.estado || 'Inactivo'}
              </span>
              <RealTimeClock />
            </div>
          </div>
        </div>
        <button onClick={logout} className="text-slate-400 hover:text-white"><LogOut size={20}/></button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        {tab === "inicio" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-400">Ganancia Turno</p>
                <p className="text-xl font-bold text-yellow-400">${ganancia.toLocaleString()}</p>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-400">Entregados</p>
                <p className="text-xl font-bold text-green-400">{entregados.length}</p>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              <button onClick={() => setEstado('Disponible')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${riderData?.estado === 'Disponible' ? 'bg-green-500 text-white' : 'bg-slate-800 text-slate-300'}`}>Disponible</button>
              <button onClick={() => setEstado('Ocupado')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${riderData?.estado === 'Ocupado' ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-slate-300'}`}>Ocupado</button>
              <button onClick={() => setEstado('No disponible')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${riderData?.estado === 'No disponible' ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-300'}`}>No disponible</button>
            </div>

            <h3 className="font-bold text-white">Pedidos Activos</h3>
            {activos.length === 0 ? <p className="text-slate-500 text-center py-6">Sin pedidos pendientes</p> :
              activos.map(p => (
                <div key={p.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-yellow-400 font-bold">#{p.codigo}</span>
                      <p className="text-white font-semibold">{p.cliente}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">{p.estado}</span>
                  </div>
                  <p className="text-sm text-slate-400">{p.direccion}</p>
                  <p className="text-xs text-slate-500 mt-1">{getLocalName(p.local_id)}</p>
                </div>
              ))
            }
          </>
        )}

        {tab === "pedidos" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Mis Pedidos ({activos.length})</h2>
            {activos.length === 0 && <p className="text-slate-500 text-center py-6">No hay pedidos activos</p>}
            {activos.map(p => (
              <div key={p.id} className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-yellow-400 font-bold text-lg">#{p.codigo}</span>
                    <span className="ml-2 text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">{p.estado}</span>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-white"><strong>Cliente:</strong> {p.cliente}</p>
                  <p className="text-white"><strong>Direccion:</strong> {p.direccion}</p>
                  <p className="text-slate-400"><strong>Telefono:</strong> {p.telefono}</p>
                  <p className="text-slate-400"><strong>Local:</strong> {getLocalName(p.local_id)}</p>
                  <p className="text-slate-400"><strong>Tarifa:</strong> ${p.precio?.toLocaleString()}</p>
                  <p className="text-slate-400"><strong>Metodo de pago:</strong> {p.metodo_pago || "Efectivo"}</p>
                  <p className="text-slate-500 text-xs">{new Date(p.created_at).toLocaleString("es-CO")}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <a href={"https://wa.me/57" + p.telefono} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-2.5 bg-green-500/20 text-green-400 rounded-lg font-semibold text-sm"><MessageCircle size={16}/> WhatsApp</a>
                  <a href={"tel:" + p.telefono} className="flex items-center justify-center gap-2 py-2.5 bg-slate-800 text-slate-300 rounded-lg font-semibold text-sm"><Phone size={16}/> Llamar</a>
                  <button onClick={() => window.open("https://maps.google.com/?q=" + encodeURIComponent(p.direccion))} className="flex items-center justify-center gap-2 py-2.5 bg-blue-500/20 text-blue-400 rounded-lg font-semibold text-sm"><MapPin size={16}/> Mapa</button>
                  <button onClick={() => copyInfo(p)} className="flex items-center justify-center gap-2 py-2.5 bg-slate-800 text-slate-300 rounded-lg font-semibold text-sm"><Copy size={16}/> Copiar</button>
                </div>

                <div className="space-y-2 pt-2">
                  {p.estado === 'Asignado' && <button onClick={() => updateEstado(p.id, 'Aceptado')} className="w-full py-3 bg-yellow-400 text-slate-900 font-bold rounded-lg">Aceptar</button>}
                  {p.estado === 'Aceptado' && <button onClick={() => updateEstado(p.id, 'Recogido')} className="w-full py-3 bg-blue-500 text-white font-bold rounded-lg">Recogido</button>}
                  {p.estado === 'Recogido' && <button onClick={() => updateEstado(p.id, 'En camino')} className="w-full py-3 bg-purple-500 text-white font-bold rounded-lg">En Camino</button>}
                  {p.estado === 'En camino' && <button onClick={() => updateEstado(p.id, 'Entregado')} className="w-full py-3 bg-green-500 text-white font-bold rounded-lg">Entregado</button>}
                  {p.estado !== 'Problema' && p.estado !== 'Entregado' && p.estado !== 'Cancelado' && (
                    reportingId === p.id ? (
                      <div className="space-y-2">
                        <input value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="Describe el problema..." className="w-full p-3 bg-slate-800 rounded-lg text-sm text-white border border-slate-700" />
                        <div className="flex gap-2">
                          <button onClick={() => reportarProblema(p.id)} className="flex-1 py-2.5 bg-red-500 text-white font-bold rounded-lg text-sm">Enviar reporte</button>
                          <button onClick={() => { setReportingId(null); setReportText(""); }} className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg text-sm">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setReportingId(p.id)} className="w-full py-2.5 bg-red-500/20 text-red-400 font-bold rounded-lg text-sm">Reportar problema</button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "mapa" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Ruta de Pedidos</h2>
            {activos.length === 0 ? <p className="text-slate-500 text-center py-6">Sin pedidos en ruta</p> :
              activos.map(p => (
                <div key={p.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="text-yellow-400 text-sm font-bold">#{p.codigo}</span>
                    <p className="text-white">{p.direccion}</p>
                    <p className="text-xs text-slate-500">{p.cliente}</p>
                  </div>
                  <button onClick={() => window.open("https://maps.google.com/?q=" + encodeURIComponent(p.direccion))} className="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold text-sm">Ir</button>
                </div>
              ))
            }
          </div>
        )}

        {tab === "liquidacion" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Mi Liquidacion</h2>
            <div className="bg-yellow-400/10 p-6 rounded-xl border border-yellow-400/30 text-center">
              <p className="text-yellow-400 text-sm">Total a Recibir</p>
              <h1 className="text-4xl font-bold text-yellow-400">${ganancia.toLocaleString()}</h1>
            </div>
            <div className="space-y-2">
              {entregados.length === 0 && <p className="text-slate-500 text-center py-4">Sin entregas aun</p>}
              {entregados.map(p => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-slate-900 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-yellow-400 text-sm font-bold">#{p.codigo}</span>
                    <p className="text-white text-sm">{p.cliente}</p>
                  </div>
                  <span className="text-green-400 font-bold">+${p.pago_repartidor?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "perfil" && (
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-3">
            <h2 className="text-xl font-bold text-white">Perfil</h2>
            <div className="space-y-3">
              <div className="p-3 bg-slate-800/50 rounded-lg"><p className="text-xs text-slate-500">Nombre</p><p className="text-white">{profile?.nombre}</p></div>
              <div className="p-3 bg-slate-800/50 rounded-lg"><p className="text-xs text-slate-500">Email</p><p className="text-white">{profile?.email}</p></div>
              <div className="p-3 bg-slate-800/50 rounded-lg"><p className="text-xs text-slate-500">Telefono</p><p className="text-white">{riderData?.telefono}</p></div>
              <div className="p-3 bg-slate-800/50 rounded-lg"><p className="text-xs text-slate-500">Documento</p><p className="text-white">{riderData?.documento}</p></div>
              <div className="p-3 bg-slate-800/50 rounded-lg"><p className="text-xs text-slate-500">Vehiculo</p><p className="text-white">{riderData?.vehiculo}</p></div>
              <div className="p-3 bg-slate-800/50 rounded-lg"><p className="text-xs text-slate-500">Placa</p><p className="text-white">{riderData?.placa}</p></div>
              <div className="p-3 bg-slate-800/50 rounded-lg"><p className="text-xs text-slate-500">Estado</p><p className="text-white">{riderData?.estado || 'Inactivo'}</p></div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-around items-center p-2 z-50">
        {[
          { id: 'inicio', icon: Home, label: 'Inicio' },
          { id: 'pedidos', icon: ListOrdered, label: 'Pedidos' },
          { id: 'mapa', icon: MapPin, label: 'Mapa' },
          { id: 'liquidacion', icon: DollarSign, label: 'Liquidacion' },
          { id: 'perfil', icon: User, label: 'Perfil' }
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center p-2 rounded ${tab === t.id ? 'text-yellow-400' : 'text-slate-500'}`}>
            <t.icon size={20} />
            <span className="text-[9px] mt-1">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
