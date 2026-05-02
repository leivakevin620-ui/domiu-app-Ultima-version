"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Plus, Package, Users, Building2, Banknote,
  LogOut, Edit2, Trash2, CopyCheck, Loader2, CheckCircle,
  AlertCircle, ArrowUpRight, ArrowDownRight, Store, X, Menu
} from "lucide-react";

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
  return <span className="font-mono text-sm text-slate-500">{time}</span>;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

function calcularTarifas(km: number) {
  if (km <= 2) return { precio: 5000, pagoRepartidor: 3800, empresaRecibe: 1200 };
  if (km <= 4) return { precio: 6000, pagoRepartidor: 4500, empresaRecibe: 1500 };
  if (km <= 5) return { precio: 7000, pagoRepartidor: 5200, empresaRecibe: 1800 };
  let precio = km <= 6 ? 8000 : 8000 + Math.ceil((km - 6) / 2) * 2000;
  let er = precio === 8000 ? 2000 : Math.round(precio * 0.4);
  return { precio, pagoRepartidor: precio - er, empresaRecibe: er };
}

type Tab = "panel" | "nuevo" | "pedidos" | "repartidores" | "locales" | "liquidacion";

export default function AdminApp() {
  const { user, profile, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("panel");
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [locs, setLocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [turnoActivo, setTurnoActivo] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [fCliente, setFCliente] = useState("");
  const [fTel, setFTel] = useState("");
  const [fDir, setFDir] = useState("");
  const [fBarrio, setFBarrio] = useState("");
  const [fLocal, setFLocal] = useState("");
  const [fRep, setFRep] = useState("");
  const [fKm, setFKm] = useState("");
  const [fPrecio, setFPrecio] = useState("");

  const [fBusqueda, setFBusqueda] = useState("");
  const [fEstado, setFEstado] = useState("");

  const [rEdit, setREdit] = useState<string | null>(null);
  const [rNom, setRNom] = useState("");
  const [rTel, setRTel] = useState("");
  const [rDoc, setRDoc] = useState("");
  const [rVeh, setRVeh] = useState("");
  const [rPla, setRPla] = useState("");

  const [lEdit, setLEdit] = useState<string | null>(null);
  const [lNom, setLNom] = useState("");
  const [lDir, setLDir] = useState("");
  const [lTel, setLTel] = useState("");

  const ok = (m: string) => { setMsg(m); setErr(""); setTimeout(() => setMsg(""), 4000); };
  const fail = (m: string) => { setErr(m); setMsg(""); setTimeout(() => setErr(""), 6000); };

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [rP, rR, rL, rT] = await Promise.all([
        supabase.from("pedidos").select("*").order("created_at", { ascending: false }),
        supabase.from("repartidores").select("*").order("created_at", { ascending: false }),
        supabase.from("locales").select("*").order("created_at", { ascending: false }),
        supabase.from("turnos").select("*").eq("activo", true).order("created_at", { ascending: false }).limit(1),
      ]);
      setPedidos(rP.data || []);
      setReps(rR.data || []);
      setLocs(rL.data || []);
      setTurnoActivo(rT.data?.[0] || null);
    } catch (e: any) { fail("Error: " + e.message); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const abrirTurno = async () => {
    const { error } = await supabase.from("turnos").insert({ user_id: user?.id, activo: true, opened_at: new Date().toISOString() });
    if (error) return fail(error.message);
    ok("Turno abierto"); load();
  };
  const cerrarTurno = async () => {
    if (!turnoActivo) return fail("No hay turno activo");
    const ents = pedidos.filter((p: any) => p.estado === "Entregado");
    const { error } = await supabase.from("turnos").update({
      activo: false, closed_at: new Date().toISOString(),
      total_turno: pedidos.length, entregados: ents.length,
      empresa_recibe_total: ents.reduce((s: number, p: any) => s + (p.empresa_recibe || 0), 0),
      liquidado_total: ents.filter((p: any) => p.liquidado).length,
    }).eq("id", turnoActivo.id);
    if (error) return fail(error.message);
    ok("Turno cerrado"); setTurnoActivo(null); load();
  };

  const savePedido = async (e: any) => {
    e.preventDefault();
    const km = Number(fKm);
    if (!fCliente.trim() || !fDir.trim() || isNaN(km) || km <= 0) return fail("Cliente, direccion y km obligatorios");
    const t = fPrecio && Number(fPrecio) > 0 ? null : calcularTarifas(km);
    const precio = t ? t.precio : Number(fPrecio);
    const pr = t ? t.pagoRepartidor : precio > 8000 ? Math.round(precio * 0.6) : Math.round(precio * 0.75);
    const er = precio - pr;
    const cod = editId ? (pedidos.find((p: any) => p.id === editId)?.codigo || "DOM-" + String(pedidos.length + 1).padStart(3, "0")) : "DOM-" + String(pedidos.length + 1).padStart(3, "0");
    const data: any = {
      codigo: cod, cliente: fCliente.trim(), telefono: fTel.trim(),
      direccion: fDir.trim(), barrio: fBarrio.trim() || "N/A",
      local_id: fLocal || null, repartidor_id: fRep || null,
      km, precio, pago_repartidor: pr, empresa_recibe: er,
      metodo_pago: "Efectivo", user_id: user?.id,
    };
    if (!editId) data.estado = "Pendiente";
    const { error } = editId
      ? await supabase.from("pedidos").update(data).eq("id", editId)
      : await supabase.from("pedidos").insert(data);
    if (error) return fail(error.message);
    ok(editId ? "Pedido actualizado" : "Pedido creado");
    setEditId(null); setFCliente(""); setFTel(""); setFDir(""); setFBarrio(""); setFLocal(""); setFRep(""); setFKm(""); setFPrecio("");
    load();
  };

  const editPedido = (p: any) => { setEditId(p.id); setFCliente(p.cliente); setFTel(p.telefono); setFDir(p.direccion); setFBarrio(p.barrio); setFLocal(p.local_id || ""); setFRep(p.repartidor_id || ""); setFKm(String(p.km)); setFPrecio(String(p.precio)); setTab("nuevo"); };
  const delPedido = async (id: string) => { if (!confirm("Eliminar?")) return; await supabase.from("pedidos").delete().eq("id", id); ok("Eliminado"); load(); };
  const cambiarEstado = async (id: string, est: string) => { await supabase.from("pedidos").update({ estado: est }).eq("id", id); load(); };
  const copiarPedido = (p: any) => {
    const loc = locs.find((l: any) => l.id === p.local_id)?.nombre || "Sin local";
    const f = new Date(p.created_at).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    navigator.clipboard.writeText("Pedido: #" + p.codigo + "\nCliente: " + p.cliente + "\nContacto: " + p.telefono + "\nDireccion: " + p.direccion + "\nLocal: " + loc + "\nTarifa: $" + p.precio + "\nFecha y hora: " + f);
    ok("Copiado");
  };

  const saveRep = async (e: any) => {
    e.preventDefault();
    if (!rNom.trim()) return fail("Nombre obligatorio");
    const data = { nombre: rNom.trim(), telefono: rTel.trim(), documento: rDoc.trim(), vehiculo: rVeh.trim(), placa: rPla.trim() };
    if (rEdit) {
      const rider = reps.find((r: any) => r.id === rEdit);
      await supabase.from("repartidores").update(data).eq("id", rEdit);
      if (rider?.user_id) {
        await supabase.from("profiles").update({ nombre: rNom.trim() }).eq("id", rider.user_id);
      }
    } else {
      await supabase.from("repartidores").insert({ ...data, user_id: null, estado: "Disponible" });
    }
    ok(rEdit ? "Actualizado" : "Creado"); setREdit(null); setRNom(""); setRTel(""); setRDoc(""); setRVeh(""); setRPla(""); load();
  };
  const delRep = async (id: string) => { if (!confirm("Eliminar?")) return; await supabase.from("repartidores").update({ activo: false }).eq("id", id); ok("Eliminado"); load(); };

  const saveLoc = async (e: any) => {
    e.preventDefault();
    if (!lNom.trim()) return fail("Nombre obligatorio");
    const data = { nombre: lNom.trim(), direccion: lDir.trim(), telefono: lTel.trim() };
    const { error } = lEdit
      ? await supabase.from("locales").update(data).eq("id", lEdit)
      : await supabase.from("locales").insert({ ...data, user_id: user?.id });
    if (error) return fail(error.message);
    ok(lEdit ? "Actualizado" : "Creado"); setLEdit(null); setLNom(""); setLDir(""); setLTel(""); load();
  };
  const delLoc = async (id: string) => { if (!confirm("Eliminar?")) return; await supabase.from("locales").update({ activo: false }).eq("id", id); ok("Eliminado"); load(); };

  const liquidar = async (repId: string) => {
    await supabase.from("pedidos").update({ liquidado: true }).eq("repartidor_id", repId).eq("estado", "Entregado").eq("liquidado", false);
    ok("Liquidado"); load();
  };

  const liqRep = useMemo(() => reps.filter((r: any) => r.activo !== false).map((rep: any) => {
    const ent = pedidos.filter((p: any) => p.repartidor_id === rep.id && p.estado === "Entregado");
    return { rep, count: ent.length, debe: ent.reduce((s: number, p: any) => s + (p.empresa_recibe || 0), 0), gana: ent.reduce((s: number, p: any) => s + (p.pago_repartidor || 0), 0), liquidado: ent.length > 0 && ent.every((p: any) => p.liquidado) };
  }), [pedidos, reps]);

  const filtPedidos = useMemo(() => {
    let r = pedidos;
    if (fEstado) r = r.filter((p: any) => p.estado === fEstado);
    if (fBusqueda) { const q = fBusqueda.toLowerCase(); r = r.filter((p: any) => p.cliente.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)); }
    return r;
  }, [pedidos, fEstado, fBusqueda]);

  const repDisp = reps.filter((r: any) => r.estado === "Disponible" && r.activo !== false);
  const tarifPrev = fKm ? calcularTarifas(Number(fKm)) : null;
  const todayTotal = pedidos.reduce((s: number, p: any) => s + (p.precio || 0), 0);
  const todayEnt = pedidos.filter((p: any) => p.estado === "Entregado").length;
  const todayCan = pedidos.filter((p: any) => p.estado === "Cancelado").length;
  const todayEmp = pedidos.reduce((s: number, p: any) => s + (p.empresa_recibe || 0), 0);

  const ESTADOS = ["Pendiente", "Asignado", "Aceptado", "Recogido", "En camino", "Entregado", "Problema", "Cancelado"];
  const navItems = [
    { key: "panel" as Tab, icon: LayoutDashboard, label: "Panel" },
    { key: "nuevo" as Tab, icon: Plus, label: "Crear Pedido" },
    { key: "pedidos" as Tab, icon: Package, label: "Pedidos" },
    { key: "repartidores" as Tab, icon: Users, label: "Repartidores" },
    { key: "locales" as Tab, icon: Building2, label: "Locales" },
    { key: "liquidacion" as Tab, icon: Banknote, label: "Liquidacion" },
  ];
  const inpC = "w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/50 text-white placeholder-slate-500 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 text-sm";
  const lblC = "block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide";

  if (loading && pedidos.length === 0) return (
    <div className="h-screen flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-yellow-400" size={48} /></div>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed lg:relative z-40 h-full w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center"><span className="text-lg font-black text-slate-900">D</span></div>
            <div><h1 className="text-lg font-black text-white">Domi<span className="text-yellow-400">U</span></h1><p className="text-[10px] text-slate-500 uppercase tracking-wider">Magdalena</p></div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(n => (
            <button key={n.key} onClick={() => { setTab(n.key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${tab === n.key ? "bg-yellow-400/10 text-yellow-400 border border-yellow-400/20" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}>
              <n.icon size={18} /> {n.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-yellow-400">{profile?.nombre?.charAt(0)}</div>
            <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-white truncate">{profile?.nombre}</p><p className="text-[10px] text-slate-500 truncate">{profile?.email}</p></div>
          </div>
          <button onClick={() => logout()} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-400 text-xs font-semibold hover:bg-red-500/10 hover:text-red-400 transition-all">
            <LogOut size={14} /> Cerrar Sesion
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="lg:hidden text-slate-400" onClick={() => setSidebarOpen(true)}><Menu size={24} /></button>
            <h2 className="text-xl font-bold text-white capitalize">{tab === "nuevo" ? "Crear Pedido" : tab === "panel" ? "Panel General" : tab}</h2>
          </div>
          <div className="flex items-center gap-4">
            <RealTimeClock />
            {turnoActivo ? (
              <button onClick={cerrarTurno} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg text-xs font-bold border border-red-500/20 hover:bg-red-500/20">
                <ArrowDownRight size={14} /> Cerrar Turno
              </button>
            ) : (
              <button onClick={abrirTurno} className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 rounded-lg text-xs font-bold border border-green-500/20 hover:bg-green-500/20">
                <ArrowUpRight size={14} /> Abrir Turno
              </button>
            )}
          </div>
        </header>

        <div className="p-6">
          {msg && <div className="flex items-center gap-2 mb-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400"><CheckCircle size={18} />{msg}</div>}
          {err && <div className="flex items-center gap-2 mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400"><AlertCircle size={18} />{err}</div>}

          {tab === "panel" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between mb-3"><p className="text-xs text-slate-500 font-semibold uppercase">Total Turno</p></div>
                  <p className="text-2xl font-black text-white">{fmt(todayTotal)}</p><p className="text-xs text-slate-500 mt-1">{pedidos.length} pedidos</p>
                </div>
                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between mb-3"><p className="text-xs text-slate-500 font-semibold uppercase">Empresa</p></div>
                  <p className="text-2xl font-black text-white">{fmt(todayEmp)}</p><p className="text-xs text-slate-500 mt-1">Recaudado</p>
                </div>
                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between mb-3"><p className="text-xs text-slate-500 font-semibold uppercase">Entregados</p></div>
                  <p className="text-2xl font-black text-white">{todayEnt}</p><p className="text-xs text-slate-500 mt-1">de {pedidos.length}</p>
                </div>
                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between mb-3"><p className="text-xs text-slate-500 font-semibold uppercase">Cancelados</p></div>
                  <p className="text-2xl font-black text-white">{todayCan}</p><p className="text-xs text-slate-500 mt-1">de {pedidos.length}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
                  <h3 className="font-bold text-white mb-4">Repartidores Disponibles ({repDisp.length})</h3>
                  {repDisp.length === 0 ? <p className="text-slate-500 text-sm text-center py-6">Ninguno disponible</p> :
                    <div className="space-y-2">{repDisp.map(r => (
                      <div key={r.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                        <div><p className="text-sm font-semibold text-white">{r.nombre}</p><p className="text-xs text-slate-500">{r.telefono}</p></div>
                        <span className="text-[10px] px-2 py-1 rounded-full bg-green-500/20 text-green-400 font-bold">DISPONIBLE</span>
                      </div>
                    ))}</div>}
                </div>
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
                  <h3 className="font-bold text-white mb-4">Pedidos Recientes</h3>
                  {pedidos.length === 0 ? <p className="text-slate-500 text-sm text-center py-6">Sin pedidos</p> :
                    <div className="space-y-2">{pedidos.slice(0, 5).map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                        <div><p className="text-sm font-semibold text-yellow-400">#{p.codigo}</p><p className="text-xs text-slate-400">{p.cliente}</p></div>
                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${p.estado === "Entregado" ? "bg-green-500/20 text-green-400" : p.estado === "Cancelado" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}>{p.estado}</span>
                      </div>
                    ))}</div>}
                </div>
              </div>
            </div>
          )}

          {tab === "nuevo" && (
            <div className="max-w-2xl bg-slate-900 rounded-2xl border border-slate-800 p-6">
              <h3 className="font-bold text-white text-lg mb-6">{editId ? "Editar Pedido" : "Nuevo Pedido"}</h3>
              <form onSubmit={savePedido} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={lblC}>Cliente</label><input className={inpC} value={fCliente} onChange={(e) => setFCliente(e.target.value)} placeholder="Nombre" required /></div>
                  <div><label className={lblC}>Telefono</label><input className={inpC} value={fTel} onChange={(e) => setFTel(e.target.value)} placeholder="3001234567" /></div>
                </div>
                <div><label className={lblC}>Direccion</label><input className={inpC} value={fDir} onChange={(e) => setFDir(e.target.value)} placeholder="Direccion completa" required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={lblC}>Barrio</label><input className={inpC} value={fBarrio} onChange={(e) => setFBarrio(e.target.value)} placeholder="Barrio" /></div>
                  <div><label className={lblC}>Local</label><select className={inpC} value={fLocal} onChange={(e) => setFLocal(e.target.value)}><option value="">Sin local</option>{locs.map((l: any) => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={lblC}>Repartidor</label><select className={inpC} value={fRep} onChange={(e) => setFRep(e.target.value)}><option value="">Sin asignar</option>{reps.filter((r: any) => r.activo !== false).map((r: any) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></div>
                  <div><label className={lblC}>Kilometros</label><input className={inpC} type="number" min="0.1" step="0.1" value={fKm} onChange={(e) => setFKm(e.target.value)} placeholder="0.0" required /></div>
                </div>
                <div><label className={lblC}>Precio manual (opcional)</label><input className={inpC} type="number" value={fPrecio} onChange={(e) => setFPrecio(e.target.value)} placeholder="Dejar vacio para automatico" /></div>
                {tarifPrev && !fPrecio && (
                  <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-1">
                    <p className="text-sm font-bold text-yellow-400">Tarifa: {fmt(tarifPrev.precio)}</p>
                    <p className="text-xs text-green-400">Repartidor: {fmt(tarifPrev.pagoRepartidor)}</p>
                    <p className="text-xs text-blue-400">Empresa: {fmt(tarifPrev.empresaRecibe)}</p>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 py-3 bg-yellow-400 text-slate-900 font-bold rounded-xl hover:bg-yellow-300">{editId ? "Actualizar" : "Crear Pedido"}</button>
                  {editId && <button type="button" onClick={() => { setEditId(null); setFCliente(""); setFTel(""); setFDir(""); setFBarrio(""); setFLocal(""); setFRep(""); setFKm(""); setFPrecio(""); }} className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl">Cancelar</button>}
                </div>
              </form>
            </div>
          )}

          {tab === "pedidos" && (
            <div className="space-y-4">
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]"><input className={inpC} placeholder="Buscar..." value={fBusqueda} onChange={(e) => setFBusqueda(e.target.value)} /></div>
                <select className={`${inpC} w-48`} value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
                  <option value="">Todos</option>{ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="space-y-3">
                {filtPedidos.map((p: any) => (
                  <div key={p.id} className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-yellow-400 font-bold">#{p.codigo}</span>
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${p.estado === "Entregado" ? "bg-green-500/20 text-green-400" : p.estado === "Cancelado" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}>{p.estado}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => copiarPedido(p)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white"><CopyCheck size={16} /></button>
                        <button onClick={() => editPedido(p)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white"><Edit2 size={16} /></button>
                        <button onClick={() => delPedido(p.id)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-red-400"><Trash2 size={16} /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm mb-3">
                      <div><p className="text-slate-500 text-xs">Cliente</p><p className="text-white font-semibold">{p.cliente}</p></div>
                      <div><p className="text-slate-500 text-xs">Telefono</p><p className="text-white">{p.telefono}</p></div>
                      <div><p className="text-slate-500 text-xs">Direccion</p><p className="text-white">{p.direccion}</p></div>
                      <div><p className="text-slate-500 text-xs">Barrio</p><p className="text-white">{p.barrio}</p></div>
                      <div><p className="text-slate-500 text-xs">Local</p><p className="text-white">{locs.find((l: any) => l.id === p.local_id)?.nombre || "N/A"}</p></div>
                      <div><p className="text-slate-500 text-xs">Repartidor</p><p className="text-white">{reps.find((r: any) => r.id === p.repartidor_id)?.nombre || "Sin asignar"}</p></div>
                      <div><p className="text-slate-500 text-xs">Tarifa</p><p className="text-white font-bold">{fmt(p.precio)}</p></div>
                      <div><p className="text-slate-500 text-xs">Metodo</p><p className="text-white">{p.metodo_pago}</p></div>
                    </div>
                    <div className="flex gap-2 flex-wrap items-center">
                      <select className="text-xs px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white" value={p.estado} onChange={(e) => cambiarEstado(p.id, e.target.value)}>
                        {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                      <span className="text-xs text-slate-500 ml-auto">{new Date(p.created_at).toLocaleString("es-CO")}</span>
                    </div>
                  </div>
                ))}
                {filtPedidos.length === 0 && <div className="text-center py-12 text-slate-500"><Package size={48} className="mx-auto mb-3 opacity-20" /><p>No hay pedidos</p></div>}
              </div>
            </div>
          )}

          {tab === "repartidores" && (
            <div className="space-y-6">
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                <h3 className="font-bold text-white mb-4">{rEdit ? "Editar Repartidor" : "Nuevo Repartidor"}</h3>
                <form onSubmit={saveRep} className="space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <div><label className={lblC}>Nombre</label><input className={inpC} value={rNom} onChange={(e) => setRNom(e.target.value)} placeholder="Nombre" required /></div>
                    <div><label className={lblC}>Telefono</label><input className={inpC} value={rTel} onChange={(e) => setRTel(e.target.value)} placeholder="300..." /></div>
                    <div><label className={lblC}>Documento</label><input className={inpC} value={rDoc} onChange={(e) => setRDoc(e.target.value)} placeholder="Documento" /></div>
                    <div><label className={lblC}>Vehiculo</label><input className={inpC} value={rVeh} onChange={(e) => setRVeh(e.target.value)} placeholder="Moto" /></div>
                    <div><label className={lblC}>Placa</label><input className={inpC} value={rPla} onChange={(e) => setRPla(e.target.value)} placeholder="ABC123" /></div>
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className="px-6 py-3 bg-yellow-400 text-slate-900 font-bold rounded-xl">{rEdit ? "Actualizar" : "Crear"}</button>
                    {rEdit && <button type="button" onClick={() => { setREdit(null); setRNom(""); setRTel(""); setRDoc(""); setRVeh(""); setRPla(""); }} className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl">Cancelar</button>}
                  </div>
                </form>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reps.filter((r: any) => r.activo !== false).map((r: any) => (
                  <div key={r.id} className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-400/20 flex items-center justify-center text-yellow-400 font-bold">{r.nombre.charAt(0)}</div>
                        <div><p className="font-bold text-white text-sm">{r.nombre}</p><p className="text-xs text-slate-500">{r.telefono || "Sin telefono"}</p></div>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${r.estado === "Disponible" ? "bg-green-500/20 text-green-400" : r.estado === "Ocupado" ? "bg-yellow-500/20 text-yellow-400" : "bg-slate-700 text-slate-400"}`}>{r.estado || "No disponible"}</span>
                    </div>
                    <div className="space-y-1 text-xs text-slate-400 mb-3">
                      <p>Doc: {r.documento || "N/A"} | Vehiculo: {r.vehiculo || "N/A"}</p>
                      <p>Placa: {r.placa || "N/A"}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setREdit(r.id); setRNom(r.nombre); setRTel(r.telefono || ""); setRDoc(r.documento || ""); setRVeh(r.vehiculo || ""); setRPla(r.placa || ""); }} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-700">Editar</button>
                      <button onClick={() => delRep(r.id)} className="px-3 py-2 bg-red-500/10 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/20">Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
              {reps.filter((r: any) => r.activo !== false).length === 0 && <div className="text-center py-12 text-slate-500"><Users size={48} className="mx-auto mb-3 opacity-20" /><p>No hay repartidores</p></div>}
            </div>
          )}

          {tab === "locales" && (
            <div className="space-y-6">
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                <h3 className="font-bold text-white mb-4">{lEdit ? "Editar Local" : "Nuevo Local"}</h3>
                <form onSubmit={saveLoc} className="space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <div><label className={lblC}>Nombre</label><input className={inpC} value={lNom} onChange={(e) => setLNom(e.target.value)} placeholder="Nombre del local" required /></div>
                    <div><label className={lblC}>Direccion</label><input className={inpC} value={lDir} onChange={(e) => setLDir(e.target.value)} placeholder="Direccion" /></div>
                    <div><label className={lblC}>Telefono</label><input className={inpC} value={lTel} onChange={(e) => setLTel(e.target.value)} placeholder="Telefono" /></div>
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className="px-6 py-3 bg-yellow-400 text-slate-900 font-bold rounded-xl">{lEdit ? "Actualizar" : "Crear"}</button>
                    {lEdit && <button type="button" onClick={() => { setLEdit(null); setLNom(""); setLDir(""); setLTel(""); }} className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl">Cancelar</button>}
                  </div>
                </form>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {locs.filter((l: any) => l.activo !== false).map((l: any) => (
                  <div key={l.id} className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <Store size={20} className="text-blue-400" />
                      <div><p className="font-bold text-white text-sm">{l.nombre}</p><p className="text-xs text-slate-500">{l.direccion || "Sin direccion"}</p></div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setLEdit(l.id); setLNom(l.nombre); setLDir(l.direccion || ""); setLTel(l.telefono || ""); }} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-700">Editar</button>
                      <button onClick={() => delLoc(l.id)} className="px-3 py-2 bg-red-500/10 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/20">Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
              {locs.filter((l: any) => l.activo !== false).length === 0 && <div className="text-center py-12 text-slate-500"><Building2 size={48} className="mx-auto mb-3 opacity-20" /><p>No hay locales</p></div>}
            </div>
          )}

          {tab === "liquidacion" && (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
              <h3 className="font-bold text-white text-lg mb-6 flex items-center gap-2"><Banknote size={20} className="text-yellow-400" /> Liquidacion por Repartidor</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500">
                      <th className="text-left py-3 px-4 font-semibold">Repartidor</th>
                      <th className="text-center py-3 px-4 font-semibold">Entregados</th>
                      <th className="text-right py-3 px-4 font-semibold">Empresa</th>
                      <th className="text-right py-3 px-4 font-semibold">Repartidor</th>
                      <th className="text-center py-3 px-4 font-semibold">Estado</th>
                      <th className="text-center py-3 px-4 font-semibold">Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liqRep.map((l: any) => (
                      <tr key={l.rep.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-semibold text-white">{l.rep.nombre}</td>
                        <td className="py-3 px-4 text-center">{l.count}</td>
                        <td className="py-3 px-4 text-right text-blue-400 font-bold">{fmt(l.debe)}</td>
                        <td className="py-3 px-4 text-right text-green-400 font-bold">{fmt(l.gana)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`text-xs px-2 py-1 rounded-full font-bold ${l.liquidado ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>{l.liquidado ? "Liquidado" : "Pendiente"}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button onClick={() => liquidar(l.rep.id)} disabled={l.liquidado} className="px-4 py-1.5 bg-yellow-400 text-slate-900 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-yellow-300">Liquidar</button>
                        </td>
                      </tr>
                    ))}
                    {liqRep.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-500">Sin datos</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
