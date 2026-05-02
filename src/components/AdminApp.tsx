"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Plus, Package, Users, Building2, Banknote,
  LogOut, Edit2, Trash2, CopyCheck, Loader2, CheckCircle,
  AlertCircle, ArrowUpRight, ArrowDownRight, Store, X, Menu,
  FileText, Clock, MapPin, Phone, MessageCircle, Navigation,
  TrendingUp, TrendingDown, DollarSign, ChevronDown, ChevronUp,
  ClipboardPaste, Search, Filter, Calendar, BarChart3,
  Download, FileSpreadsheet, FileDown, History, CreditCard,
  Eye, EyeOff, Truck, Zap, Shield, UserCheck, UserX
} from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

/* ======================== RELOJ ======================== */
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
  return <span className="font-mono text-sm text-slate-400">{time}</span>;
}

/* ======================== UTILIDADES ======================== */
const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v || 0);

const EMPRESA_PHONE = "3113748405";

function waLink(num: string, msg: string) {
  return `https://wa.me/57${num.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
}

function calcularTarifas(km: number) {
  if (km <= 2) return { precio: 5000, pagoRepartidor: 3800, empresaRecibe: 1200 };
  if (km <= 4) return { precio: 6000, pagoRepartidor: 4500, empresaRecibe: 1500 };
  if (km <= 5) return { precio: 7000, pagoRepartidor: 5200, empresaRecibe: 1800 };
  let precio = km <= 6 ? 8000 : 8000 + Math.ceil((km - 6) / 2) * 2000;
  let er = precio === 8000 ? 2000 : Math.round(precio * 0.4);
  return { precio, pagoRepartidor: precio - er, empresaRecibe: er };
}

function extraerDatos(texto: string) {
  const result: Record<string, string> = {};
  const lineas = texto.split("\n");
  for (const linea of lineas) {
    const lower = linea.toLowerCase();
    if (lower.includes("cliente") || lower.includes("nombre")) result.cliente = linea.replace(/.*?:/, "").trim();
    else if (lower.includes("tel") || lower.includes("cel") || lower.includes("contacto")) result.telefono = linea.replace(/.*?:/, "").trim().replace(/\D/g, "");
    else if (lower.includes("dir") || lower.includes("ubicacion")) result.direccion = linea.replace(/.*?:/, "").trim();
    else if (lower.includes("barrio")) result.barrio = linea.replace(/.*?:/, "").trim();
    else if (lower.includes("local") || lower.includes("restaurante") || lower.includes("tienda")) result.local = linea.replace(/.*?:/, "").trim();
  }
  if (!result.cliente && lineas[0]) result.cliente = lineas[0].trim();
  if (!result.telefono) {
    const phoneMatch = texto.match(/(?:3[0-9])[0-9]{8}/);
    if (phoneMatch) result.telefono = phoneMatch[0];
  }
  return result;
}

/* ======================== TIPOS ======================== */
type Tab = "panel" | "nuevo" | "pedidos" | "repartidores" | "locales" | "turnos" | "liquidaciones" | "reportes";

/* ======================== COMPONENTE ======================== */
export default function AdminApp() {
  const { user, profile, logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("panel");
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [locs, setLocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [turnoActivo, setTurnoActivo] = useState<any>(null);
  const [turnosHistorial, setTurnosHistorial] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* Pedido form */
  const [editId, setEditId] = useState<string | null>(null);
  const [fCliente, setFCliente] = useState("");
  const [fTel, setFTel] = useState("");
  const [fDir, setFDir] = useState("");
  const [fBarrio, setFBarrio] = useState("");
  const [fLocal, setFLocal] = useState("");
  const [fRep, setFRep] = useState("");
  const [fKm, setFKm] = useState("");
  const [fPrecio, setFPrecio] = useState("");
  const [fMetodoPago, setFMetodoPago] = useState("Efectivo");
  const [fPegarTexto, setFPegarTexto] = useState("");

  /* Filtros */
  const [fBusqueda, setFBusqueda] = useState("");
  const [fEstado, setFEstado] = useState("");

  /* Repartidor form */
  const [rEdit, setREdit] = useState<string | null>(null);
  const [rEmail, setREmail] = useState("");
  const [rPass, setRPass] = useState("");
  const [rNom, setRNom] = useState("");
  const [rTel, setRTel] = useState("");
  const [rDoc, setRDoc] = useState("");
  const [rVeh, setRVeh] = useState("");
  const [rPla, setRPla] = useState("");

  /* Local form */
  const [lEdit, setLEdit] = useState<string | null>(null);
  const [lNom, setLNom] = useState("");
  const [lDir, setLDir] = useState("");
  const [lTel, setLTel] = useState("");

  /* Repartidor detalle */
  const [rDetalle, setRDetalle] = useState<string | null>(null);

  /* Turnos */
  const [showTurnoModal, setShowTurnoModal] = useState(false);
  const [selectedTurno, setSelectedTurno] = useState<any>(null);

  /* Liquidacion */
  const [liqDetalle, setLiqDetalle] = useState<string | null>(null);

  /* Toast helpers */
  const ok = (m: string) => { setMsg(m); setErr(""); setTimeout(() => setMsg(""), 4000); };
  const fail = (m: string) => { setErr(m); setMsg(""); setTimeout(() => setErr(""), 6000); };

  /* ======================== DATA ======================== */
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [rP, rR, rL, rT, rTH] = await Promise.all([
        supabase.from("pedidos").select("*").order("created_at", { ascending: false }),
        supabase.from("repartidores").select("*").order("created_at", { ascending: false }),
        supabase.from("locales").select("*").order("created_at", { ascending: false }),
        supabase.from("turnos").select("*").eq("activo", true).order("created_at", { ascending: false }).limit(1),
        supabase.from("turnos").select("*").eq("activo", false).order("closed_at", { ascending: false }).limit(20),
      ]);
      setPedidos(rP.data || []);
      setReps(rR.data || []);
      setLocs(rL.data || []);
      setTurnoActivo(rT.data?.[0] || null);
      setTurnosHistorial(rTH.data || []);
    } catch (e: any) { fail("Error: " + e.message); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  /* Realtime */
  const subRef = useRef<any>(null);
  useEffect(() => {
    if (!user) return;
    if (subRef.current) supabase.removeChannel(subRef.current);
    const channel = supabase.channel("admin_realtime_v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "repartidores" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "locales" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "turnos" }, () => load())
      .subscribe();
    subRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  /* ======================== TURNOS ======================== */
  const abrirTurno = async () => {
    const { error } = await supabase.from("turnos").insert({ user_id: user?.id, activo: true, opened_at: new Date().toISOString() });
    if (error) return fail(error.message);
    ok("Turno abierto"); load();
  };
  const cerrarTurno = async () => {
    if (!turnoActivo) return fail("No hay turno activo");
    const ents = pedidos.filter((p: any) => p.estado === "Entregado");
    const canc = pedidos.filter((p: any) => p.estado === "Cancelado");
    const { error } = await supabase.from("turnos").update({
      activo: false, closed_at: new Date().toISOString(),
      total_turno: pedidos.length, entregados: ents.length, cancelados: canc.length,
      recaudado_total: ents.reduce((s: number, p: any) => s + (p.precio || 0), 0),
      empresa_recibe_total: ents.reduce((s: number, p: any) => s + (p.empresa_recibe || 0), 0),
      liquidado_total: ents.filter((p: any) => p.liquidado).length,
    }).eq("id", turnoActivo.id);
    if (error) return fail(error.message);
    ok("Turno cerrado"); setTurnoActivo(null); load();
  };

  /* ======================== PEDIDOS ======================== */
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
      metodo_pago: fMetodoPago, user_id: user?.id,
    };
    if (!editId) data.estado = "Pendiente";
    const { error } = editId
      ? await supabase.from("pedidos").update(data).eq("id", editId)
      : await supabase.from("pedidos").insert(data);
    if (error) return fail(error.message);
    ok(editId ? "Pedido actualizado" : "Pedido creado");
    resetPedidoForm();
    load();
  };

  const resetPedidoForm = () => {
    setEditId(null); setFCliente(""); setFTel(""); setFDir(""); setFBarrio("");
    setFLocal(""); setFRep(""); setFKm(""); setFPrecio("");
    setFMetodoPago("Efectivo"); setFPegarTexto("");
  };

  const editPedido = (p: any) => {
    setEditId(p.id); setFCliente(p.cliente); setFTel(p.telefono); setFDir(p.direccion);
    setFBarrio(p.barrio); setFLocal(p.local_id || ""); setFRep(p.repartidor_id || "");
    setFKm(String(p.km)); setFPrecio(String(p.precio));
    setFMetodoPago(p.metodo_pago || "Efectivo");
    setTab("nuevo");
  };

  const delPedido = async (id: string) => { if (!confirm("Eliminar?")) return; await supabase.from("pedidos").delete().eq("id", id); ok("Eliminado"); load(); };

  const cambiarEstado = async (id: string, est: string) => {
    const pedido = pedidos.find((p: any) => p.id === id);
    const { error } = await supabase.from("pedidos").update({ estado: est }).eq("id", id);
    if (error) { fail("Error: " + error.message); return; }
    if (est === "Entregado" || est === "Cancelado") {
      if (pedido?.repartidor_id) {
        await supabase.from("repartidores").update({ estado: "Disponible" }).eq("id", pedido.repartidor_id);
      }
    }
    ok(`Estado: ${est}`);
    load();
  };

  const asignarRep = async (pedidoId: string, repId: string) => {
    const { error } = await supabase.from("pedidos").update({ repartidor_id: repId, estado: "Asignado" }).eq("id", pedidoId);
    if (error) return fail(error.message);
    await supabase.from("repartidores").update({ estado: "Ocupado" }).eq("id", repId);
    ok("Repartidor asignado"); load();
  };

  const copiarPedido = (p: any) => {
    const loc = locs.find((l: any) => l.id === p.local_id)?.nombre || "Sin local";
    const f = new Date(p.created_at).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    navigator.clipboard.writeText("Pedido: #" + p.codigo + "\nCliente: " + p.cliente + "\nContacto: " + p.telefono + "\nDireccion: " + p.direccion + "\nLocal: " + loc + "\nTarifa: $" + p.precio + "\nFecha y hora: " + f);
    ok("Pedido copiado");
  };

  const waRepPedido = (p: any) => {
    const rep = reps.find((r: any) => r.id === p.repartidor_id);
    if (!rep || !rep.telefono) return fail("Repartidor sin telefono");
    const loc = locs.find((l: any) => l.id === p.local_id)?.nombre || "Sin local";
    const msg = `Pedido ${p.codigo}\nCliente: ${p.cliente}\nTel: ${p.telefono}\nDir: ${p.direccion}\nLocal: ${loc}\nTarifa: $${p.precio}`;
    window.open(waLink(rep.telefono, msg), "_blank");
  };

  const waCliente = (tel: string) => { if (tel) window.open(waLink(tel, "Hola, sobre su pedido..."), "_blank"); else fail("Sin telefono"); };

  /* Pegar info */
  const extraerDatosPegados = () => {
    if (!fPegarTexto.trim()) return fail("Pega texto primero");
    const datos = extraerDatos(fPegarTexto);
    if (datos.cliente) setFCliente(datos.cliente);
    if (datos.telefono) setFTel(datos.telefono);
    if (datos.direccion) setFDir(datos.direccion);
    if (datos.barrio) setFBarrio(datos.barrio);
    if (datos.local) {
      const locEncontrado = locs.find((l: any) => l.nombre.toLowerCase().includes(datos.local.toLowerCase()));
      if (locEncontrado) setFLocal(locEncontrado.id);
    }
    ok("Datos extraidos");
  };

  /* ======================== REPARTIDORES ======================== */
  const saveRep = async (e: any) => {
    e.preventDefault();
    if (!rNom.trim()) return fail("Nombre obligatorio");
    if (rEdit) {
      const data = { nombre: rNom.trim(), telefono: rTel.trim(), documento: rDoc.trim(), vehiculo: rVeh.trim(), placa: rPla.trim() };
      const rider = reps.find((r: any) => r.id === rEdit);
      await supabase.from("repartidores").update(data).eq("id", rEdit);
      if (rider?.user_id) await supabase.from("profiles").update({ nombre: rNom.trim() }).eq("id", rider.user_id);
      ok("Actualizado"); setREdit(null); setREmail(""); setRPass(""); setRNom(""); setRTel(""); setRDoc(""); setRVeh(""); setRPla(""); load();
    } else {
      if (!rEmail.trim() || !rPass.trim()) return fail("Email y contraseña obligatorios para crear repartidor");
      const res = await fetch("/api/create-rider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: rEmail.trim(), password: rPass, nombre: rNom.trim(), telefono: rTel.trim(), documento: rDoc.trim(), vehiculo: rVeh.trim(), placa: rPla.trim() }),
      });
      const data = await res.json();
      if (!res.ok) return fail(data.error || "Error creando repartidor");
      ok("Repartidor creado con cuenta de acceso"); setREdit(null); setREmail(""); setRPass(""); setRNom(""); setRTel(""); setRDoc(""); setRVeh(""); setRPla(""); load();
    }
  };

  const toggleRepActivo = async (id: string, activo: boolean) => {
    await supabase.from("repartidores").update({ activo }).eq("id", id);
    ok(activo ? "Repartidor activado" : "Repartidor desactivado"); load();
  };

  const delRep = async (id: string) => { if (!confirm("Eliminar?")) return; await supabase.from("repartidores").update({ activo: false }).eq("id", id); ok("Eliminado"); load(); };

  /* ======================== LOCALES ======================== */
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

  /* ======================== LIQUIDACION ======================== */
  const liquidar = async (repId: string) => {
    await supabase.from("pedidos").update({ liquidado: true }).eq("repartidor_id", repId).eq("estado", "Entregado").eq("liquidado", false);
    ok("Liquidado"); load();
  };

  /* ======================== REPORTES ======================== */
  const exportarExcel = (datos: any[], nombre: string, columnas: { header: string; key: string }[]) => {
    const wsData = [columnas.map(c => c.header), ...datos.map(d => columnas.map(c => d[c.key] ?? ""))];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `${nombre}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    ok("Excel exportado");
  };

  const exportarPDF = (datos: any[], titulo: string, columnas: { header: string; key: string }[]) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(titulo, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generado: ${new Date().toLocaleString("es-CO")}`, 14, 28);
    (doc as any).autoTable({
      startY: 35,
      head: [columnas.map(c => c.header)],
      body: datos.map(d => columnas.map(c => String(d[c.key] ?? ""))),
      theme: "grid",
      headStyles: { fillColor: [30, 41, 59], textColor: [250, 204, 21] },
      styles: { fontSize: 8 },
    });
    doc.save(`${titulo}_${new Date().toISOString().slice(0, 10)}.pdf`);
    ok("PDF exportado");
  };

  const colPedidos = [
    { header: "Codigo", key: "codigo" }, { header: "Cliente", key: "cliente" },
    { header: "Telefono", key: "telefono" }, { header: "Direccion", key: "direccion" },
    { header: "Tarifa", key: "precio" }, { header: "Estado", key: "estado" },
    { header: "Repartidor", key: "repartidor_nombre" }, { header: "Fecha", key: "fecha" },
  ];

  const colLiquidacion = [
    { header: "Repartidor", key: "nombre" }, { header: "Entregados", key: "entregados" },
    { header: "Empresa", key: "empresa" }, { header: "Repartidor", key: "ganancia" },
    { header: "Estado", key: "estado" },
  ];

  /* ======================== COMPUTADOS ======================== */
  const liqRep = useMemo(() => reps.filter((r: any) => r.activo !== false).map((rep: any) => {
    const ent = pedidos.filter((p: any) => p.repartidor_id === rep.id && p.estado === "Entregado");
    const ef = ent.filter((p: any) => p.metodo_pago === "Efectivo");
    const tr = ent.filter((p: any) => p.metodo_pago === "Transferencia");
    return {
      rep, count: ent.length,
      totalEfectivo: ef.reduce((s: number, p: any) => s + (p.precio || 0), 0),
      totalTransferencia: tr.reduce((s: number, p: any) => s + (p.precio || 0), 0),
      debe: ent.reduce((s: number, p: any) => s + (p.empresa_recibe || 0), 0),
      gana: ent.reduce((s: number, p: any) => s + (p.pago_repartidor || 0), 0),
      liquidado: ent.length > 0 && ent.every((p: any) => p.liquidado),
    };
  }), [pedidos, reps]);

  const filtPedidos = useMemo(() => {
    let r = pedidos;
    if (fEstado) r = r.filter((p: any) => p.estado === fEstado);
    if (fBusqueda) { const q = fBusqueda.toLowerCase(); r = r.filter((p: any) => p.cliente.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)); }
    return r;
  }, [pedidos, fEstado, fBusqueda]);

  const repDisp = reps.filter((r: any) => r.estado === "Disponible" && r.activo !== false);
  const repOcup = reps.filter((r: any) => r.estado === "Ocupado" && r.activo !== false);
  const tarifPrev = fKm ? calcularTarifas(Number(fKm)) : null;
  const todayPedidos = pedidos.length;
  const todayPend = pedidos.filter((p: any) => p.estado === "Pendiente").length;
  const todayAsig = pedidos.filter((p: any) => p.estado === "Asignado").length;
  const todayEnt = pedidos.filter((p: any) => p.estado === "Entregado").length;
  const todayCan = pedidos.filter((p: any) => p.estado === "Cancelado").length;
  const todayTotal = pedidos.reduce((s: number, p: any) => s + (p.precio || 0), 0);
  const todayEmp = pedidos.reduce((s: number, p: any) => s + (p.empresa_recibe || 0), 0);
  const todayRep = reps.filter((r: any) => r.activo !== false).length;

  const ESTADOS = ["Pendiente", "Asignado", "Aceptado", "Recogido", "En camino", "Entregado", "Problema", "Cancelado"];
  const navItems: { key: Tab; icon: any; label: string }[] = [
    { key: "panel", icon: LayoutDashboard, label: "Dashboard" },
    { key: "nuevo", icon: Plus, label: "Crear Pedido" },
    { key: "pedidos", icon: Package, label: "Pedidos" },
    { key: "repartidores", icon: Users, label: "Repartidores" },
    { key: "turnos", icon: Clock, label: "Turnos" },
    { key: "liquidaciones", icon: Banknote, label: "Liquidaciones" },
    { key: "reportes", icon: FileText, label: "Reportes" },
    { key: "locales", icon: Building2, label: "Locales" },
  ];
  const inpC = "w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/50 text-white placeholder-slate-500 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 text-sm";
  const lblC = "block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide";
  const badgeEst: Record<string, string> = {
    Disponible: "bg-green-500/20 text-green-400",
    Ocupado: "bg-yellow-500/20 text-yellow-400",
    "No disponible": "bg-red-500/20 text-red-400",
    Pendiente: "bg-slate-500/20 text-slate-400",
    Asignado: "bg-blue-500/20 text-blue-400",
    Aceptado: "bg-indigo-500/20 text-indigo-400",
    Recogido: "bg-purple-500/20 text-purple-400",
    "En camino": "bg-violet-500/20 text-violet-400",
    Entregado: "bg-green-500/20 text-green-400",
    Problema: "bg-red-500/20 text-red-400",
    Cancelado: "bg-gray-600/20 text-gray-400",
  };

  if (loading && pedidos.length === 0) return (
    <div className="h-screen flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-yellow-400" size={48} /></div>
  );

  /* ======================== RENDER ======================== */
  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Sidebar overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* SIDEBAR */}
      <aside className={`fixed lg:relative z-40 h-full w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center"><span className="text-lg font-black text-slate-900">D</span></div>
            <div><h1 className="text-lg font-black text-white">Domi<span className="text-yellow-400">U</span></h1><p className="text-[10px] text-slate-500 uppercase tracking-wider">Panel Administrador</p></div>
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
            <div className="w-8 h-8 rounded-full bg-yellow-400/20 flex items-center justify-center text-xs font-bold text-yellow-400">{profile?.nombre?.charAt(0).toUpperCase()}</div>
            <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-white truncate">{profile?.nombre}</p><p className="text-[10px] text-slate-500 truncate">{profile?.email}</p></div>
          </div>
          <button onClick={() => { logout(); }} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-400 text-xs font-semibold hover:bg-red-500/10 hover:text-red-400 transition-all">
            <LogOut size={14} /> Cerrar Sesion
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="lg:hidden text-slate-400" onClick={() => setSidebarOpen(true)}><Menu size={24} /></button>
            <h2 className="text-xl font-bold text-white capitalize">
              {tab === "nuevo" ? "Crear Pedido" : tab === "panel" ? "Dashboard" : tab}
            </h2>
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

        {/* Messages */}
        <div className="px-6 pt-4">
          {msg && <div className="flex items-center gap-2 mb-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400"><CheckCircle size={18} />{msg}</div>}
          {err && <div className="flex items-center gap-2 mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400"><AlertCircle size={18} />{err}</div>}
        </div>

        <div className="p-6">
          {/* ======================== DASHBOARD ======================== */}
          {tab === "panel" && (
            <div className="space-y-6">
              {/* Metricas principales */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Pedidos del dia" value={String(todayPedidos)} icon={Package} color="blue" />
                <StatCard label="Pendientes" value={String(todayPend)} icon={Clock} color="yellow" />
                <StatCard label="Asignados" value={String(todayAsig)} icon={Truck} color="indigo" />
                <StatCard label="Entregados" value={String(todayEnt)} icon={CheckCircle} color="green" />
                <StatCard label="Cancelados" value={String(todayCan)} icon={X} color="red" />
                <StatCard label="Recaudado" value={fmt(todayTotal)} icon={DollarSign} color="emerald" />
                <StatCard label="Ganancia empresa" value={fmt(todayEmp)} icon={TrendingUp} color="yellow" />
                <StatCard label="Repartidores" value={`${repDisp.length}/${todayRep}`} icon={Users} color="violet" sub="Disponibles / Total" />
              </div>

              {/* Repartidores disponibles y ocupados */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title={`Disponibles (${repDisp.length})`} icon={UserCheck} iconColor="text-green-400">
                  {repDisp.length === 0 ? <Empty msg="Ninguno disponible" /> :
                    <div className="space-y-2">{repDisp.map(r => (
                      <div key={r.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                        <div><p className="text-sm font-semibold text-white">{r.nombre}</p><p className="text-xs text-slate-500">{r.telefono || "Sin telefono"}</p></div>
                        <span className="text-[10px] px-2 py-1 rounded-full bg-green-500/20 text-green-400 font-bold">DISPONIBLE</span>
                      </div>
                    ))}</div>}
                </Card>
                <Card title={`Ocupados (${repOcup.length})`} icon={UserX} iconColor="text-yellow-400">
                  {repOcup.length === 0 ? <Empty msg="Ninguno ocupado" /> :
                    <div className="space-y-2">{repOcup.map(r => {
                      const pedActivo = pedidos.find((p: any) => p.repartidor_id === r.id && !["Entregado", "Cancelado"].includes(p.estado));
                      return (
                        <div key={r.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                          <div><p className="text-sm font-semibold text-white">{r.nombre}</p>
                            <p className="text-xs text-slate-500">{pedActivo ? pedActivo.codigo : "Sin pedido"}</p></div>
                          <span className="text-[10px] px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 font-bold">OCUPADO</span>
                        </div>
                      );
                    })}</div>}
                </Card>
              </div>

              {/* Pedidos recientes */}
              <Card title="Pedidos Recientes" icon={History} iconColor="text-blue-400">
                {pedidos.length === 0 ? <Empty msg="Sin pedidos" /> :
                  <div className="space-y-2">{pedidos.slice(0, 8).map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-yellow-400">#{p.codigo}</span>
                        <span className="text-sm text-white">{p.cliente}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{new Date(p.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>
                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${badgeEst[p.estado] || "bg-slate-700 text-slate-400"}`}>{p.estado}</span>
                      </div>
                    </div>
                  ))}</div>}
              </Card>
            </div>
          )}

          {/* ======================== CREAR PEDIDO ======================== */}
          {tab === "nuevo" && (
            <div className="max-w-3xl space-y-6">
              {/* Pegar info */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2"><ClipboardPaste size={20} className="text-yellow-400" /> Pegar informacion del local</h3>
                <div className="flex gap-3">
                  <textarea className={`${inpC} flex-1`} rows={4} value={fPegarTexto} onChange={(e) => setFPegarTexto(e.target.value)} placeholder="Pega aqui el texto recibido por WhatsApp del local..." />
                </div>
                <button onClick={extraerDatosPegados} className="mt-3 px-6 py-3 bg-yellow-400 text-slate-900 font-bold rounded-xl hover:bg-yellow-300 flex items-center gap-2">
                  <Search size={16} /> Extraer datos
                </button>
              </div>

              {/* Formulario */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
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
                    <div><label className={lblC}>Repartidor</label><select className={inpC} value={fRep} onChange={(e) => setFRep(e.target.value)}><option value="">Sin asignar</option>{reps.filter((r: any) => r.activo !== false).map((r: any) => <option key={r.id} value={r.id}>{r.nombre} ({r.estado})</option>)}</select></div>
                    <div><label className={lblC}>Kilometros</label><input className={inpC} type="number" min="0.1" step="0.1" value={fKm} onChange={(e) => setFKm(e.target.value)} placeholder="0.0" required /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className={lblC}>Metodo de pago</label><select className={inpC} value={fMetodoPago} onChange={(e) => setFMetodoPago(e.target.value)}><option>Efectivo</option><option>Transferencia</option></select></div>
                    <div><label className={lblC}>Precio manual (opcional)</label><input className={inpC} type="number" value={fPrecio} onChange={(e) => setFPrecio(e.target.value)} placeholder="Dejar vacio para automatico" /></div>
                  </div>
                  {tarifPrev && !fPrecio && (
                    <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-1">
                      <p className="text-sm font-bold text-yellow-400">Tarifa sugerida ({Number(fKm).toFixed(1)} km): {fmt(tarifPrev.precio)}</p>
                      <p className="text-xs text-green-400">Repartidor: {fmt(tarifPrev.pagoRepartidor)}</p>
                      <p className="text-xs text-blue-400">Empresa: {fmt(tarifPrev.empresaRecibe)}</p>
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button type="submit" className="flex-1 py-3 bg-yellow-400 text-slate-900 font-bold rounded-xl hover:bg-yellow-300">{editId ? "Actualizar" : "Crear Pedido"}</button>
                    {editId && <button type="button" onClick={() => { resetPedidoForm(); }} className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl">Cancelar</button>}
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ======================== PEDIDOS ======================== */}
          {tab === "pedidos" && (
            <div className="space-y-4">
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]"><input className={inpC} placeholder="Buscar por cliente o codigo..." value={fBusqueda} onChange={(e) => setFBusqueda(e.target.value)} /></div>
                <select className={`${inpC} w-48`} value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
                  <option value="">Todos los estados</option>{ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="space-y-3">
                {filtPedidos.map((p: any) => (
                  <div key={p.id} className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-yellow-400 font-bold text-lg">#{p.codigo}</span>
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${badgeEst[p.estado] || "bg-slate-700 text-slate-400"}`}>{p.estado}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => copiarPedido(p)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white" title="Copiar"><CopyCheck size={16} /></button>
                        <button onClick={() => editPedido(p)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white" title="Editar"><Edit2 size={16} /></button>
                        <button onClick={() => delPedido(p.id)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-red-400" title="Eliminar"><Trash2 size={16} /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm mb-3">
                      <div><p className="text-slate-500 text-xs">Cliente</p><p className="text-white font-semibold">{p.cliente}</p></div>
                      <div><p className="text-slate-500 text-xs">Telefono</p><p className="text-white">{p.telefono || "N/A"}</p></div>
                      <div><p className="text-slate-500 text-xs">Direccion</p><p className="text-white">{p.direccion}</p></div>
                      <div><p className="text-slate-500 text-xs">Barrio</p><p className="text-white">{p.barrio || "N/A"}</p></div>
                      <div><p className="text-slate-500 text-xs">Local</p><p className="text-white">{locs.find((l: any) => l.id === p.local_id)?.nombre || "N/A"}</p></div>
                      <div><p className="text-slate-500 text-xs">Repartidor</p><p className="text-white">{reps.find((r: any) => r.id === p.repartidor_id)?.nombre || "Sin asignar"}</p></div>
                      <div><p className="text-slate-500 text-xs">Tarifa</p><p className="text-green-400 font-bold">{fmt(p.precio)}</p></div>
                      <div><p className="text-slate-500 text-xs">Metodo</p><p className="text-white">{p.metodo_pago || "Efectivo"}</p></div>
                    </div>
                    {/* Acciones rapidas */}
                    <div className="flex gap-2 flex-wrap mb-3">
                      <button onClick={() => waCliente(p.telefono)} className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-xs font-semibold border border-green-500/20 hover:bg-green-500/20"><MessageCircle size={12} /> WA cliente</button>
                      <button onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(p.direccion)}`, "_blank")} className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-xs font-semibold border border-blue-500/20 hover:bg-blue-500/20"><Navigation size={12} /> Maps</button>
                      {p.repartidor_id && <button onClick={() => waRepPedido(p)} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg text-xs font-semibold border border-indigo-500/20 hover:bg-indigo-500/20"><MessageCircle size={12} /> WA repartidor</button>}
                      {!p.repartidor_id && p.estado === "Pendiente" && (
                        <select className="px-3 py-1.5 bg-yellow-400/10 text-yellow-400 rounded-lg text-xs font-semibold border border-yellow-400/20" onChange={(e) => { if (e.target.value) asignarRep(p.id, e.target.value); }} defaultValue="">
                          <option value="">Asignar repartidor...</option>
                          {repDisp.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                        </select>
                      )}
                    </div>
                    {/* Estados */}
                    <div className="flex gap-1 flex-wrap items-center">
                      {ESTADOS.filter(e => e !== p.estado).map(e => (
                        <button key={e} onClick={() => cambiarEstado(p.id, e)} className="text-[10px] px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition">{e}</button>
                      ))}
                      <span className="text-xs text-slate-500 ml-auto">{new Date(p.created_at).toLocaleString("es-CO")}</span>
                    </div>
                  </div>
                ))}
                {filtPedidos.length === 0 && <div className="text-center py-12 text-slate-500"><Package size={48} className="mx-auto mb-3 opacity-20" /><p>No hay pedidos</p></div>}
              </div>
            </div>
          )}

          {/* ======================== REPARTIDORES ======================== */}
          {tab === "repartidores" && (
            <div className="space-y-6">
              {/* Form crear/editar */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                <h3 className="font-bold text-white mb-4">{rEdit ? "Editar Repartidor" : "Nuevo Repartidor"}</h3>
                <form onSubmit={saveRep} className="space-y-4">
                  {!rEdit && (
                    <div className="p-4 rounded-xl bg-yellow-400/5 border border-yellow-400/20 mb-2">
                      <p className="text-xs text-yellow-400 font-semibold mb-2">Cuenta de acceso para el repartidor</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className={lblC}>Email</label><input className={inpC} type="email" value={rEmail} onChange={(e) => setREmail(e.target.value)} placeholder="repartidor@email.com" required /></div>
                        <div><label className={lblC}>Contraseña</label><input className={inpC} type="password" value={rPass} onChange={(e) => setRPass(e.target.value)} placeholder="Contraseña" required /></div>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <div><label className={lblC}>Nombre</label><input className={inpC} value={rNom} onChange={(e) => setRNom(e.target.value)} placeholder="Nombre" required /></div>
                    <div><label className={lblC}>Telefono</label><input className={inpC} value={rTel} onChange={(e) => setRTel(e.target.value)} placeholder="300..." /></div>
                    <div><label className={lblC}>Documento</label><input className={inpC} value={rDoc} onChange={(e) => setRDoc(e.target.value)} placeholder="Documento" /></div>
                    <div><label className={lblC}>Vehiculo</label><input className={inpC} value={rVeh} onChange={(e) => setRVeh(e.target.value)} placeholder="Moto" /></div>
                    <div><label className={lblC}>Placa</label><input className={inpC} value={rPla} onChange={(e) => setRPla(e.target.value)} placeholder="ABC123" /></div>
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className="px-6 py-3 bg-yellow-400 text-slate-900 font-bold rounded-xl">{rEdit ? "Actualizar" : "Crear"}</button>
                    {rEdit && <button type="button" onClick={() => { setREdit(null); setREmail(""); setRPass(""); setRNom(""); setRTel(""); setRDoc(""); setRVeh(""); setRPla(""); }} className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl">Cancelar</button>}
                  </div>
                </form>
              </div>

              {/* Lista repartidores */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reps.filter((r: any) => r.activo !== false).map((r: any) => {
                  const ent = pedidos.filter((p: any) => p.repartidor_id === r.id && p.estado === "Entregado");
                  const act = pedidos.filter((p: any) => p.repartidor_id === r.id && !["Entregado", "Cancelado"].includes(p.estado));
                  const totalGen = ent.reduce((s: number, p: any) => s + (p.precio || 0), 0);
                  const totalDebe = ent.reduce((s: number, p: any) => s + (p.empresa_recibe || 0), 0);
                  const totalGana = ent.reduce((s: number, p: any) => s + (p.pago_repartidor || 0), 0);
                  return (
                    <div key={r.id} className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-yellow-400/20 flex items-center justify-center text-yellow-400 font-bold">{r.nombre.charAt(0)}</div>
                          <div><p className="font-bold text-white text-sm">{r.nombre}</p><p className="text-xs text-slate-500">{r.telefono || "Sin telefono"}</p></div>
                        </div>
                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${badgeEst[r.estado] || "bg-slate-700 text-slate-400"}`}>{r.estado || "No disponible"}</span>
                      </div>
                      <div className="space-y-1 text-xs text-slate-400 mb-3">
                        <p>Doc: {r.documento || "N/A"} | Vehiculo: {r.vehiculo || "N/A"}</p>
                        <p>Placa: {r.placa || "N/A"}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                        <div className="bg-slate-800/50 p-2 rounded-lg"><p className="text-slate-500">Activos</p><p className="text-yellow-400 font-bold">{act.length}</p></div>
                        <div className="bg-slate-800/50 p-2 rounded-lg"><p className="text-slate-500">Entregados</p><p className="text-green-400 font-bold">{ent.length}</p></div>
                        <div className="bg-slate-800/50 p-2 rounded-lg"><p className="text-slate-500">Generado</p><p className="text-white font-bold">{fmt(totalGen)}</p></div>
                        <div className="bg-slate-800/50 p-2 rounded-lg"><p className="text-slate-500">Debe empresa</p><p className="text-blue-400 font-bold">{fmt(totalDebe)}</p></div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => { setRDetalle(r.id); }} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-700 flex items-center justify-center gap-1"><Eye size={12} /> Detalle</button>
                        <button onClick={() => { setREdit(r.id); setRNom(r.nombre); setRTel(r.telefono || ""); setRDoc(r.documento || ""); setRVeh(r.vehiculo || ""); setRPla(r.placa || ""); }} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-700 flex items-center justify-center gap-1"><Edit2 size={12} /> Editar</button>
                        {r.telefono && <button onClick={() => window.open(waLink(r.telefono, `Hola ${r.nombre}, sobre tus pedidos...`), "_blank")} className="px-3 py-2 bg-green-500/10 text-green-400 rounded-lg text-xs font-semibold hover:bg-green-500/20"><MessageCircle size={14} /></button>}
                        <button onClick={() => toggleRepActivo(r.id, r.activo !== false ? false : true)} className={`px-3 py-2 rounded-lg text-xs font-semibold ${r.activo !== false ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-green-500/10 text-green-400 hover:bg-green-500/20"}`}>
                          {r.activo !== false ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                      </div>

                      {/* Detalle repartidor */}
                      {rDetalle === r.id && (
                        <div className="mt-4 p-4 bg-slate-800/50 rounded-xl space-y-3">
                          <h4 className="font-bold text-white text-sm flex items-center justify-between">
                            Historial - {r.nombre}
                            <button onClick={() => setRDetalle(null)}><X size={14} className="text-slate-400" /></button>
                          </h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {pedidos.filter((p: any) => p.repartidor_id === r.id).slice(0, 10).map(p => (
                              <div key={p.id} className="flex justify-between text-xs p-2 bg-slate-900 rounded-lg">
                                <span className="text-yellow-400 font-semibold">#{p.codigo}</span>
                                <span className={`px-1.5 py-0.5 rounded ${badgeEst[p.estado]}`}>{p.estado}</span>
                                <span className="text-white">{fmt(p.precio)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="text-xs text-slate-400">
                            <p>Ganancia repartidor: <span className="text-green-400 font-bold">{fmt(totalGana)}</span></p>
                          </div>
                          <button onClick={() => { setTab("liquidaciones"); }} className="w-full py-2 bg-yellow-400/10 text-yellow-400 rounded-lg text-xs font-semibold border border-yellow-400/20">Ver liquidacion</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {reps.filter((r: any) => r.activo !== false).length === 0 && <div className="text-center py-12 text-slate-500"><Users size={48} className="mx-auto mb-3 opacity-20" /><p>No hay repartidores</p></div>}
            </div>
          )}

          {/* ======================== TURNOS ======================== */}
          {tab === "turnos" && (
            <div className="space-y-6">
              {/* Turno activo */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2"><Clock size={20} className="text-yellow-400" /> Turno Activo</h3>
                {turnoActivo ? (
                  <div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div className="bg-slate-800/50 p-4 rounded-xl"><p className="text-xs text-slate-500">Apertura</p><p className="text-sm text-white font-semibold">{new Date(turnoActivo.opened_at).toLocaleString("es-CO")}</p></div>
                      <div className="bg-slate-800/50 p-4 rounded-xl"><p className="text-xs text-slate-500">Pedidos</p><p className="text-lg font-bold text-white">{pedidos.length}</p></div>
                      <div className="bg-slate-800/50 p-4 rounded-xl"><p className="text-xs text-slate-500">Entregados</p><p className="text-lg font-bold text-green-400">{todayEnt}</p></div>
                      <div className="bg-slate-800/50 p-4 rounded-xl"><p className="text-xs text-slate-500">Recaudado</p><p className="text-lg font-bold text-yellow-400">{fmt(todayTotal)}</p></div>
                    </div>
                    <button onClick={cerrarTurno} className="px-6 py-3 bg-red-500/10 text-red-400 rounded-xl text-sm font-bold border border-red-500/20 hover:bg-red-500/20 flex items-center gap-2"><ArrowDownRight size={16} /> Cerrar Turno</button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-500 mb-4">No hay turno activo</p>
                    <button onClick={abrirTurno} className="px-6 py-3 bg-green-500/10 text-green-400 rounded-xl text-sm font-bold border border-green-500/20 hover:bg-green-500/20 flex items-center gap-2 mx-auto"><ArrowUpRight size={16} /> Abrir Turno</button>
                  </div>
                )}
              </div>

              {/* Historial */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2"><History size={20} className="text-blue-400" /> Historial de Turnos</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500">
                        <th className="text-left py-3 px-4 font-semibold">Apertura</th>
                        <th className="text-left py-3 px-4 font-semibold">Cierre</th>
                        <th className="text-center py-3 px-4 font-semibold">Total</th>
                        <th className="text-center py-3 px-4 font-semibold">Entregados</th>
                        <th className="text-center py-3 px-4 font-semibold">Cancelados</th>
                        <th className="text-right py-3 px-4 font-semibold">Recaudado</th>
                        <th className="text-right py-3 px-4 font-semibold">Empresa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {turnosHistorial.map(t => (
                        <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="py-3 px-4 text-xs text-white">{new Date(t.opened_at).toLocaleString("es-CO")}</td>
                          <td className="py-3 px-4 text-xs text-white">{t.closed_at ? new Date(t.closed_at).toLocaleString("es-CO") : "—"}</td>
                          <td className="py-3 px-4 text-center text-white font-bold">{t.total_turno || 0}</td>
                          <td className="py-3 px-4 text-center text-green-400 font-bold">{t.entregados || 0}</td>
                          <td className="py-3 px-4 text-center text-red-400 font-bold">{t.cancelados || 0}</td>
                          <td className="py-3 px-4 text-right text-yellow-400 font-bold">{fmt(t.recaudado_total || 0)}</td>
                          <td className="py-3 px-4 text-right text-blue-400 font-bold">{fmt(t.empresa_recibe_total || 0)}</td>
                        </tr>
                      ))}
                      {turnosHistorial.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-500">Sin historial</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================== LIQUIDACIONES ======================== */}
          {tab === "liquidaciones" && (
            <div className="space-y-6">
              {/* Tabla principal */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2"><Banknote size={20} className="text-yellow-400" /> Liquidacion por Repartidor</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500">
                        <th className="text-left py-3 px-4 font-semibold">Repartidor</th>
                        <th className="text-center py-3 px-4 font-semibold">Entregados</th>
                        <th className="text-right py-3 px-4 font-semibold">Efectivo</th>
                        <th className="text-right py-3 px-4 font-semibold">Transferencia</th>
                        <th className="text-right py-3 px-4 font-semibold">Debe Empresa</th>
                        <th className="text-right py-3 px-4 font-semibold">Gana Repartidor</th>
                        <th className="text-center py-3 px-4 font-semibold">Estado</th>
                        <th className="text-center py-3 px-4 font-semibold">Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liqRep.map((l: any) => (
                        <tr key={l.rep.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-semibold text-white">{l.rep.nombre}</td>
                          <td className="py-3 px-4 text-center">{l.count}</td>
                          <td className="py-3 px-4 text-right text-green-400 font-bold">{fmt(l.totalEfectivo)}</td>
                          <td className="py-3 px-4 text-right text-blue-400 font-bold">{fmt(l.totalTransferencia)}</td>
                          <td className="py-3 px-4 text-right text-yellow-400 font-bold">{fmt(l.debe)}</td>
                          <td className="py-3 px-4 text-right text-emerald-400 font-bold">{fmt(l.gana)}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`text-xs px-2 py-1 rounded-full font-bold ${l.liquidado ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>{l.liquidado ? "Liquidado" : "Pendiente"}</span>
                          </td>
                          <td className="py-3 px-4 text-center space-x-2">
                            <button onClick={() => liquidar(l.rep.id)} disabled={l.liquidado || l.count === 0} className="px-3 py-1.5 bg-yellow-400 text-slate-900 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-yellow-300">Liquidar</button>
                            {l.rep.telefono && <button onClick={() => {
                              const msg = `Liquidacion ${l.rep.nombre}:\nPedidos: ${l.count}\nEmpresa: ${fmt(l.debe)}\nTu ganancia: ${fmt(l.gana)}`;
                              window.open(waLink(l.rep.telefono, msg), "_blank");
                            }} className="px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-xs font-semibold border border-green-500/20"><MessageCircle size={14} /></button>}
                          </td>
                        </tr>
                      ))}
                      {liqRep.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate-500">Sin datos</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Exportar liquidacion */}
              <div className="flex gap-3">
                <button onClick={() => exportarExcel(liqRep.map(l => ({
                  nombre: l.rep.nombre, entregados: l.count,
                  efectivo: l.totalEfectivo, transferencia: l.totalTransferencia,
                  empresa: l.debe, ganancia: l.gana,
                  estado: l.liquidado ? "Liquidado" : "Pendiente"
                })), "Liquidacion", [
                  { header: "Repartidor", key: "nombre" }, { header: "Entregados", key: "entregados" },
                  { header: "Efectivo", key: "efectivo" }, { header: "Transferencia", key: "transferencia" },
                  { header: "Empresa", key: "empresa" }, { header: "Ganancia", key: "ganancia" },
                  { header: "Estado", key: "estado" },
                ])} className="px-4 py-2 bg-green-500/10 text-green-400 rounded-xl text-sm font-semibold border border-green-500/20 flex items-center gap-2"><FileSpreadsheet size={16} /> Excel</button>
                <button onClick={() => exportarPDF(liqRep.map(l => ({
                  nombre: l.rep.nombre, entregados: l.count,
                  efectivo: fmt(l.totalEfectivo), transferencia: fmt(l.totalTransferencia),
                  empresa: fmt(l.debe), ganancia: fmt(l.gana),
                  estado: l.liquidado ? "Liquidado" : "Pendiente"
                })), "Liquidacion Repartidores", [
                  { header: "Repartidor", key: "nombre" }, { header: "Entregados", key: "entregados" },
                  { header: "Efectivo", key: "efectivo" }, { header: "Transferencia", key: "transferencia" },
                  { header: "Empresa", key: "empresa" }, { header: "Ganancia", key: "ganancia" },
                  { header: "Estado", key: "estado" },
                ])} className="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl text-sm font-semibold border border-red-500/20 flex items-center gap-2"><FileDown size={16} /> PDF</button>
              </div>
            </div>
          )}

          {/* ======================== REPORTES ======================== */}
          {tab === "reportes" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Reporte diario */}
                <ReportCard title="Reporte Diario" desc="Todos los pedidos del dia" icon={Calendar} color="blue"
                  onExcel={() => exportarExcel(pedidos.map(p => ({ ...p, repartidor_nombre: reps.find((r: any) => r.id === p.repartidor_id)?.nombre || "N/A", fecha: new Date(p.created_at).toLocaleString("es-CO") })), "Reporte_Diario", colPedidos)}
                  onPdf={() => exportarPDF(pedidos.map(p => ({ ...p, precio: fmt(p.precio), repartidor_nombre: reps.find((r: any) => r.id === p.repartidor_id)?.nombre || "N/A", fecha: new Date(p.created_at).toLocaleString("es-CO") })), "Reporte Diario", colPedidos)} />
                {/* Entregados */}
                <ReportCard title="Pedidos Entregados" desc="Solo pedidos entregados" icon={CheckCircle} color="green"
                  onExcel={() => exportarExcel(pedidos.filter((p: any) => p.estado === "Entregado").map(p => ({ ...p, repartidor_nombre: reps.find((r: any) => r.id === p.repartidor_id)?.nombre || "N/A", fecha: new Date(p.created_at).toLocaleString("es-CO") })), "Entregados", colPedidos)}
                  onPdf={() => exportarPDF(pedidos.filter((p: any) => p.estado === "Entregado").map(p => ({ ...p, precio: fmt(p.precio), repartidor_nombre: reps.find((r: any) => r.id === p.repartidor_id)?.nombre || "N/A", fecha: new Date(p.created_at).toLocaleString("es-CO") })), "Pedidos Entregados", colPedidos)} />
                {/* Cancelados */}
                <ReportCard title="Pedidos Cancelados" desc="Pedidos cancelados" icon={X} color="red"
                  onExcel={() => exportarExcel(pedidos.filter((p: any) => p.estado === "Cancelado").map(p => ({ ...p, repartidor_nombre: reps.find((r: any) => r.id === p.repartidor_id)?.nombre || "N/A", fecha: new Date(p.created_at).toLocaleString("es-CO") })), "Cancelados", colPedidos)}
                  onPdf={() => exportarPDF(pedidos.filter((p: any) => p.estado === "Cancelado").map(p => ({ ...p, precio: fmt(p.precio), repartidor_nombre: reps.find((r: any) => r.id === p.repartidor_id)?.nombre || "N/A", fecha: new Date(p.created_at).toLocaleString("es-CO") })), "Pedidos Cancelados", colPedidos)} />
                {/* Por repartidor */}
                <ReportCard title="Por Repartidor" desc="Resumen por repartidor" icon={Users} color="violet"
                  onExcel={() => exportarExcel(liqRep.map(l => ({ nombre: l.rep.nombre, entregados: l.count, efectivo: l.totalEfectivo, transferencia: l.totalTransferencia, empresa: l.debe, ganancia: l.gana, estado: l.liquidado ? "Liquidado" : "Pendiente" })), "Por_Repartidor", colLiquidacion)}
                  onPdf={() => exportarPDF(liqRep.map(l => ({ nombre: l.rep.nombre, entregados: l.count, efectivo: fmt(l.totalEfectivo), transferencia: fmt(l.totalTransferencia), empresa: fmt(l.debe), ganancia: fmt(l.gana), estado: l.liquidado ? "Liquidado" : "Pendiente" })), "Por Repartidor", colLiquidacion)} />
                {/* Ganancias */}
                <ReportCard title="Ganancias Empresa" desc="Resumen de ganancias" icon={TrendingUp} color="yellow"
                  onExcel={() => exportarExcel([{ total_recaudado: todayTotal, ganancia_empresa: todayEmp, total_pedidos: todayPedidos, entregados: todayEnt, cancelados: todayCan }], "Ganancias", [{ header: "Recaudado", key: "total_recaudado" }, { header: "Ganancia", key: "ganancia_empresa" }, { header: "Pedidos", key: "total_pedidos" }, { header: "Entregados", key: "entregados" }, { header: "Cancelados", key: "cancelados" }])}
                  onPdf={() => exportarPDF([{ total_recaudado: fmt(todayTotal), ganancia_empresa: fmt(todayEmp), total_pedidos: todayPedidos, entregados: todayEnt, cancelados: todayCan }], "Ganancias Empresa", [{ header: "Recaudado", key: "total_recaudado" }, { header: "Ganancia", key: "ganancia_empresa" }, { header: "Pedidos", key: "total_pedidos" }, { header: "Entregados", key: "entregados" }, { header: "Cancelados", key: "cancelados" }])} />
                {/* Turnos */}
                <ReportCard title="Historial Turnos" desc="Turnos cerrados" icon={Clock} color="indigo"
                  onExcel={() => exportarExcel(turnosHistorial.map(t => ({ apertura: new Date(t.opened_at).toLocaleString("es-CO"), cierre: t.closed_at ? new Date(t.closed_at).toLocaleString("es-CO") : "Activo", total: t.total_turno, entregados: t.entregados, cancelados: t.cancelados, recaudado: fmt(t.recaudado_total || 0), empresa: fmt(t.empresa_recibe_total || 0) })), "Turnos", [{ header: "Apertura", key: "apertura" }, { header: "Cierre", key: "cierre" }, { header: "Total", key: "total" }, { header: "Entregados", key: "entregados" }, { header: "Cancelados", key: "cancelados" }, { header: "Recaudado", key: "recaudado" }, { header: "Empresa", key: "empresa" }])}
                  onPdf={() => exportarPDF(turnosHistorial.map(t => ({ apertura: new Date(t.opened_at).toLocaleString("es-CO"), cierre: t.closed_at ? new Date(t.closed_at).toLocaleString("es-CO") : "Activo", total: t.total_turno, entregados: t.entregados, cancelados: t.cancelados, recaudado: fmt(t.recaudado_total || 0), empresa: fmt(t.empresa_recibe_total || 0) })), "Historial Turnos", [{ header: "Apertura", key: "apertura" }, { header: "Cierre", key: "cierre" }, { header: "Total", key: "total" }, { header: "Entregados", key: "entregados" }, { header: "Cancelados", key: "cancelados" }, { header: "Recaudado", key: "recaudado" }, { header: "Empresa", key: "empresa" }])} />
              </div>
            </div>
          )}

          {/* ======================== LOCALES ======================== */}
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
        </div>
      </main>
    </div>
  );
}

/* ======================== SUB-COMPONENTES ======================== */
function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string; icon: any; color: string; sub?: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  };
  return (
    <div className={`p-5 rounded-2xl border ${colors[color] || colors.blue}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase opacity-70">{label}</p>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-1">{sub}</p>}
    </div>
  );
}

function Card({ title, icon: Icon, iconColor, children }: { title: string; icon: any; iconColor: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
      <h3 className={`font-bold text-white mb-4 flex items-center gap-2`}><Icon size={20} className={iconColor} /> {title}</h3>
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-slate-500 text-sm text-center py-6">{msg}</p>;
}

function ReportCard({ title, desc, icon: Icon, color, onExcel, onPdf }: { title: string; desc: string; icon: any; color: string; onExcel: () => void; onPdf: () => void }) {
  const colors: Record<string, { bg: string; border: string; icon: string }> = {
    blue: { bg: "bg-blue-500/10", border: "border-blue-500/20", icon: "text-blue-400" },
    green: { bg: "bg-green-500/10", border: "border-green-500/20", icon: "text-green-400" },
    red: { bg: "bg-red-500/10", border: "border-red-500/20", icon: "text-red-400" },
    violet: { bg: "bg-violet-500/10", border: "border-violet-500/20", icon: "text-violet-400" },
    yellow: { bg: "bg-yellow-500/10", border: "border-yellow-500/20", icon: "text-yellow-400" },
    indigo: { bg: "bg-indigo-500/10", border: "border-indigo-500/20", icon: "text-indigo-400" },
  };
  const c = colors[color] || colors.blue;
  return (
    <div className={`bg-slate-900 rounded-2xl border border-slate-800 p-6 ${c.border}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}><Icon size={20} className={c.icon} /></div>
        <div><p className="font-bold text-white">{title}</p><p className="text-xs text-slate-500">{desc}</p></div>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onExcel} className="flex-1 py-2 bg-green-500/10 text-green-400 rounded-lg text-xs font-semibold border border-green-500/20 hover:bg-green-500/20 flex items-center justify-center gap-1"><FileSpreadsheet size={14} /> Excel</button>
        <button onClick={onPdf} className="flex-1 py-2 bg-red-500/10 text-red-400 rounded-lg text-xs font-semibold border border-red-500/20 hover:bg-red-500/20 flex items-center justify-center gap-1"><FileDown size={14} /> PDF</button>
      </div>
    </div>
  );
}
