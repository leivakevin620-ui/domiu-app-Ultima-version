"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Home, ListOrdered, MapPin, DollarSign, User, LogOut, Phone, MessageCircle, Copy, Clock, Loader2 } from "lucide-react";

export default function RiderApp() {
  const { user, profile, logout } = useAuth();
  const [tab, setTab] = useState("inicio");
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [riderData, setRiderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    const { data: rider } = await supabase.from("repartidores").select("*").eq("user_id", user.id).single();
    setRiderData(rider);
    if (rider) {
      const { data } = await supabase.from("pedidos").select("*").eq("repartidor_id", rider.id).order("created_at", { ascending: false });
      setPedidos(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); const i = setInterval(loadData, 10000); return () => clearInterval(i); }, [loadData]);

  async function updateEstado(id: string, nuevo: string) {
    const { error } = await supabase.from("pedidos").update({ estado: nuevo }).eq("id", id);
    if (!error) { toast.success(`Estado: ${nuevo}`); loadData(); } else toast.error(error.message);
  }

  async function setEstado(estado: string) {
    if (!riderData) return;
    const { error } = await supabase.from("repartidores").update({ estado }).eq("id", riderData.id);
    if (!error) { toast.success(`Estado cambiado a: ${estado}`); loadData(); }
  }

  const entregados = pedidos.filter(p => p.estado === "Entregado");
  const activos = pedidos.filter(p => !["Entregado", "Cancelado"].includes(p.estado));
  const ganancia = entregados.reduce((a, b) => a + (b.pago_repartidor || 0), 0);

  function copyInfo(p: any) {
    const text = `Pedido: #${p.codigo}\nCliente: ${p.cliente}\nContacto: ${p.telefono}\nDirección: ${p.direccion}\nTarifa: $${p.precio}\nFecha: ${new Date(p.created_at).toLocaleString()}`;
    navigator.clipboard.writeText(text);
    toast.success("Copiado");
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-yellow-400" size={48} /></div>;

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Header */}
      <header className="bg-slate-900 p-4 flex justify-between items-center border-b border-slate-800 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-slate-900 font-bold">
            {profile?.nombre?.charAt(0)}
          </div>
          <div>
            <h1 className="font-bold text-white text-sm">{profile?.nombre}</h1>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${riderData?.estado === 'Disponible' ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
              {riderData?.estado || 'Inactivo'}
            </span>
          </div>
        </div>
        <button onClick={logout} className="text-slate-400"><LogOut size={20}/></button>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        {tab === "inicio" && (
          <div className="space-y-4">
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
               <button onClick={() => setEstado('Disponible')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${riderData?.estado === 'Disponible' ? 'bg-green-500 text-white' : 'bg-slate-800'}`}>Disponible</button>
               <button onClick={() => setEstado('Ocupado')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${riderData?.estado === 'Ocupado' ? 'bg-yellow-500 text-black' : 'bg-slate-800'}`}>Ocupado</button>
               <button onClick={() => setEstado('No disponible')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${riderData?.estado === 'No disponible' ? 'bg-red-500 text-white' : 'bg-slate-800'}`}>No disponible</button>
             </div>

             <h3 className="font-bold text-white mt-4">Pedidos Activos</h3>
             {activos.length === 0 ? <p className="text-slate-500 text-center py-4">Sin pedidos pendientes</p> : 
               activos.map(p => (
                 <div key={p.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                   <div className="flex justify-between mb-1">
                     <span className="text-yellow-400 font-bold">{p.codigo}</span>
                     <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">{p.estado}</span>
                   </div>
                   <h4 className="text-white">{p.cliente}</h4>
                   <p className="text-sm text-slate-400">{p.direccion}</p>
                 </div>
               ))
             }
          </div>
        )}

        {tab === "pedidos" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Mis Pedidos</h2>
            {activos.map(p => (
              <div key={p.id} className="bg-slate-900 p-5 rounded-xl border border-slate-800">
                <span className="text-yellow-400 font-bold block mb-1">{p.codigo}</span>
                <h3 className="text-white text-lg font-bold">{p.cliente}</h3>
                <p className="text-slate-400 mb-4">{p.direccion}</p>
                
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <a href={`https://wa.me/${p.telefono}`} target="_blank" className="flex items-center justify-center gap-2 py-2 bg-green-500/20 text-green-400 rounded-lg"><MessageCircle size={16}/> WhatsApp</a>
                  <a href={`tel:${p.telefono}`} className="flex items-center justify-center gap-2 py-2 bg-slate-800 text-slate-300 rounded-lg"><Phone size={16}/> Llamar</a>
                  <button onClick={() => window.open(`https://maps.google.com/?q=${p.direccion}`)} className="flex items-center justify-center gap-2 py-2 bg-blue-500/20 text-blue-400 rounded-lg"><MapPin size={16}/> Mapa</button>
                  <button onClick={() => copyInfo(p)} className="flex items-center justify-center gap-2 py-2 bg-slate-800 text-slate-300 rounded-lg"><Copy size={16}/> Copiar</button>
                </div>

                <div className="space-y-2">
                  {p.estado === 'Asignado' && <button onClick={() => updateEstado(p.id, 'Aceptado')} className="w-full py-3 bg-yellow-400 text-slate-900 font-bold rounded-lg">Aceptar</button>}
                  {p.estado === 'Aceptado' && <button onClick={() => updateEstado(p.id, 'Recogido')} className="w-full py-3 bg-blue-500 text-white font-bold rounded-lg">Recogido</button>}
                  {p.estado === 'Recogido' && <button onClick={() => updateEstado(p.id, 'En camino')} className="w-full py-3 bg-purple-500 text-white font-bold rounded-lg">En Camino</button>}
                  {p.estado === 'En camino' && <button onClick={() => updateEstado(p.id, 'Entregado')} className="w-full py-3 bg-green-500 text-white font-bold rounded-lg">Entregado</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "mapa" && (
           <div className="space-y-4">
             <h2 className="text-lg font-bold text-white">Ruta de Pedidos</h2>
             {activos.map(p => (
               <div key={p.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                 <div>
                   <span className="text-yellow-400 text-sm font-bold">{p.codigo}</span>
                   <p className="text-white">{p.direccion}</p>
                 </div>
                 <button onClick={() => window.open(`https://maps.google.com/?q=${p.direccion}`)} className="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold">Ir</button>
               </div>
             ))}
           </div>
        )}

        {tab === "liquidacion" && (
           <div className="space-y-4">
             <h2 className="text-lg font-bold text-white">Mi Liquidación</h2>
             <div className="bg-yellow-400/10 p-6 rounded-xl border border-yellow-400/30 text-center">
               <p className="text-yellow-400 text-sm">Total a Recibir</p>
               <h1 className="text-4xl font-bold text-yellow-400">${ganancia.toLocaleString()}</h1>
             </div>
             <div className="space-y-2">
               {entregados.map(p => (
                 <div key={p.id} className="flex justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
                   <span className="text-white text-sm">{p.codigo} - {p.cliente}</span>
                   <span className="text-green-400 font-bold">+${p.pago_repartidor}</span>
                 </div>
               ))}
             </div>
           </div>
        )}

        {tab === "perfil" && (
           <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-3">
             <h2 className="text-xl font-bold text-white">Perfil</h2>
             <p className="text-slate-400">Nombre: {profile?.nombre}</p>
             <p className="text-slate-400">Teléfono: {riderData?.telefono}</p>
             <p className="text-slate-400">Vehículo: {riderData?.vehiculo}</p>
             <p className="text-slate-400">Placa: {riderData?.placa}</p>
             <p className="text-slate-400">Documento: {riderData?.documento}</p>
           </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-around items-center p-2 z-50">
        {[{id:'inicio', icon:Home}, {id:'pedidos', icon:ListOrdered}, {id:'mapa', icon:MapPin}, {id:'liquidacion', icon:DollarSign}, {id:'perfil', icon:User}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center p-2 rounded ${tab===t.id ? 'text-yellow-400' : 'text-slate-500'}`}>
            <t.icon size={20} />
            <span className="text-[9px] mt-1">{t.id.charAt(0).toUpperCase() + t.id.slice(1)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
