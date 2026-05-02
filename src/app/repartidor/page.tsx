"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  Home, ListOrdered, MapPin, DollarSign, User, Phone,
  Copy, MessageCircle, AlertTriangle, LogOut, Check,
  Clock, Package, TrendingUp, Wallet, Navigation,
  ChevronRight, Shield, Truck, FileText
} from "lucide-react";

/* ======================== UTILIDADES ======================== */
function fmt(v: number) { return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v || 0); }
function fechaCorta(f: string) { return new Date(f).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
const EMPRESA_PHONE = "3113748405";

type TabType = "inicio" | "pedidos" | "mapa" | "liquidacion" | "perfil";

/* ======================== COMPONENTE ======================== */
export default function RiderApp() {
  const { user, profile, logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<TabType>("inicio");
  const [riderData, setRiderData] = useState<any>(null);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [locales, setLocales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [estadoRider, setEstadoRider] = useState("No disponible");
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"ok" | "err">("ok");
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const subRef = useRef<any>(null);

  // Clock
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      setCurrentDate(p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear());
      setCurrentTime(p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()));
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);

  const ok = (m: string) => { setToast(m); setToastType("ok"); setTimeout(() => setToast(""), 3000); };
  const fail = (m: string) => { setToast(m); setToastType("err"); setTimeout(() => setToast(""), 5000); };

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const { data: rider } = await supabase.from("repartidores").select("*").eq("user_id", user.id).single();
      setRiderData(rider);
      if (rider) {
        setEstadoRider(rider.estado || "No disponible");
        const { data: peds } = await supabase.from("pedidos").select("*").eq("repartidor_id", rider.id).order("created_at", { ascending: false });
        setPedidos(peds || []);
      }
      const { data: locs } = await supabase.from("locales").select("*");
      setLocales(locs || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime
  useEffect(() => {
    if (!user || !riderData) return;
    if (subRef.current) supabase.removeChannel(subRef.current);
    const channel = supabase.channel("rider_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `repartidor_id=eq.${riderData.id}` }, () => loadData())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "repartidores", filter: `id=eq.${riderData.id}` }, (pl: any) => { setRiderData(pl.new); if (pl.new.estado) setEstadoRider(pl.new.estado); })
      .subscribe();
    subRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [user, riderData, loadData]);

  async function cambiarEstado(nuevo: string) {
    if (!riderData) return;
    const { error } = await supabase.from("repartidores").update({ estado: nuevo }).eq("id", riderData.id);
    if (!error) { setEstadoRider(nuevo); ok(`Estado: ${nuevo}`); }
    else fail("Error: " + error.message);
  }

  async function cambiarEstadoPedido(id: string, nuevo: string) {
    const { error } = await supabase.from("pedidos").update({ estado: nuevo }).eq("id", id);
    if (error) { fail("Error: " + error.message); return; }
    ok(`Pedido: ${nuevo}`);
    if (nuevo === "Entregado" || nuevo === "Cancelado") {
      if (riderData) await supabase.from("repartidores").update({ estado: "Disponible" }).eq("id", riderData.id);
    }
    loadData();
  }

  function copiarPedido(p: any) {
    const loc = locales.find((l: any) => l.id === p.local_id)?.nombre || "Sin local";
    const txt = `Pedido: #${p.codigo}\nCliente: ${p.cliente}\nContacto: ${p.telefono}\nDirección: ${p.direccion}\nLocal: ${loc}\nTarifa: $${p.precio}\nFecha y hora: ${fechaCorta(p.created_at)}`;
    navigator.clipboard.writeText(txt).then(() => ok("Pedido copiado")).catch(() => fail("Error al copiar"));
  }

  function waCliente(p: any) { if (p.telefono) window.open(`https://wa.me/57${p.telefono.replace(/\D/g, "")}`, "_blank"); else fail("Sin teléfono"); }
  function waEmpresa(p: any) { const msg = `Pedido ${p.codigo} - ${p.cliente} - ${p.direccion}`; window.open(`https://wa.me/57${EMPRESA_PHONE}?text=${encodeURIComponent(msg)}`, "_blank"); }
  function waProblema(p: any) { const msg = `PROBLEMA Pedido ${p.codigo} - ${p.cliente} - ${p.direccion}`; window.open(`https://wa.me/57${EMPRESA_PHONE}?text=${encodeURIComponent(msg)}`, "_blank"); }
  function abrirMapa(dir: string) { window.open(`https://maps.google.com/?q=${encodeURIComponent(dir)}`, "_blank"); }

  const activos = pedidos.filter((p) => !["Entregado", "Cancelado"].includes(p.estado));
  const entregados = pedidos.filter((p) => p.estado === "Entregado");
  const totalGenerado = entregados.reduce((s, p) => s + (p.precio || 0), 0);
  const totalEmpresa = entregados.reduce((s, p) => s + (p.empresa_recibe || 0), 0);
  const totalRepartidor = entregados.reduce((s, p) => s + (p.pago_repartidor || 0), 0);
  const ultimo = pedidos[0] || null;
  const todosLiquidados = entregados.length > 0 && entregados.every((p) => p.liquidado);

  /* ======================== ESTILOS ======================== */
  const colors = {
    bg: "#f8fafc",
    card: "#ffffff",
    primary: "#facc15",
    primaryDark: "#e6b800",
    darkBlue: "#1e293b",
    darkerBlue: "#0f172a",
    white: "#ffffff",
    gray50: "#f8fafc",
    gray100: "#f1f5f9",
    gray200: "#e2e8f0",
    gray300: "#cbd5e1",
    gray400: "#94a3b8",
    gray500: "#64748b",
    gray600: "#475569",
    green: "#10b981",
    greenLight: "#ecfdf5",
    red: "#ef4444",
    redLight: "#fef2f2",
    blue: "#3b82f6",
    blueLight: "#eff6ff",
    purple: "#8b5cf6",
    purpleLight: "#f5f3ff",
    amber: "#f59e0b",
    amberLight: "#fffbeb",
  };

  const card: React.CSSProperties = {
    background: colors.card,
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
    marginBottom: 12,
    border: `1px solid ${colors.gray200}`,
  };

  const btnPrimary: React.CSSProperties = {
    padding: "14px 20px",
    borderRadius: 12,
    border: "none",
    background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
    color: colors.darkerBlue,
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    width: "100%",
    boxShadow: "0 2px 8px rgba(250,204,21,0.3)",
  };

  const btnOutline: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 10,
    border: `1px solid ${colors.gray200}`,
    background: colors.white,
    color: colors.gray600,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  };

  const badgeEstado: Record<string, React.CSSProperties> = {
    Disponible: { padding: "6px 14px", borderRadius: 999, background: colors.green, color: "#fff", fontSize: 12, fontWeight: 700 },
    Ocupado: { padding: "6px 14px", borderRadius: 999, background: colors.amber, color: "#fff", fontSize: 12, fontWeight: 700 },
    "No disponible": { padding: "6px 14px", borderRadius: 999, background: colors.red, color: "#fff", fontSize: 12, fontWeight: 700 },
  };

  const estPedido: Record<string, React.CSSProperties> = {
    Pendiente: { padding: "4px 10px", borderRadius: 999, background: colors.gray500, color: "#fff", fontSize: 11, fontWeight: 700 },
    Asignado: { padding: "4px 10px", borderRadius: 999, background: colors.amber, color: "#fff", fontSize: 11, fontWeight: 700 },
    Aceptado: { padding: "4px 10px", borderRadius: 999, background: colors.blue, color: "#fff", fontSize: 11, fontWeight: 700 },
    Recogido: { padding: "4px 10px", borderRadius: 999, background: colors.purple, color: "#fff", fontSize: 11, fontWeight: 700 },
    "En camino": { padding: "4px 10px", borderRadius: 999, background: "#6366f1", color: "#fff", fontSize: 11, fontWeight: 700 },
    Entregado: { padding: "4px 10px", borderRadius: 999, background: colors.green, color: "#fff", fontSize: 11, fontWeight: 700 },
    Problema: { padding: "4px 10px", borderRadius: 999, background: colors.red, color: "#fff", fontSize: 11, fontWeight: 700 },
    Cancelado: { padding: "4px 10px", borderRadius: 999, background: colors.gray600, color: "#fff", fontSize: 11, fontWeight: 700 },
  };

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.bg }}><p style={{ color: colors.gray400 }}>Cargando...</p></div>;
  if (!user || !riderData) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.bg }}><p style={{ color: colors.gray400 }}>Cargando...</p></div>;

  /* ======================== RENDER ======================== */
  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.darkBlue, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", maxWidth: 480, margin: "0 auto", position: "relative", paddingBottom: 80 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
          padding: "12px 24px", borderRadius: 12,
          background: toastType === "ok" ? colors.green : colors.red,
          color: "#fff", fontWeight: 700, fontSize: 14,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}>
          {toast}
        </div>
      )}

      {/* HEADER */}
      <div style={{
        background: `linear-gradient(135deg, ${colors.darkerBlue} 0%, ${colors.darkBlue} 100%)`,
        padding: "0 20px 20px",
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, paddingBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.amber} 100%)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 900, color: colors.darkerBlue,
            }}>
              D
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: colors.white }}>
                Domi<span style={{ color: colors.primary }}>U</span>
              </h1>
              <p style={{ margin: 0, fontSize: 12, color: colors.gray300 }}>{riderData.nombre}</p>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 11, color: colors.gray400, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
              <Clock size={12} /> {currentDate}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 16, color: colors.white, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {currentTime}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={badgeEstado[estadoRider]}>{estadoRider}</span>
          <span style={{ fontSize: 11, color: colors.gray400 }}>
            {pedidos.length} pedidos totales
          </span>
        </div>
      </div>

      {/* DISPONIBILIDAD */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={card}>
          <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: colors.gray500, textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 6 }}>
            <Shield size={14} /> Disponibilidad
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {([
              { label: "Disponible", color: colors.green, bg: colors.greenLight },
              { label: "Ocupado", color: colors.amber, bg: colors.amberLight },
              { label: "No disponible", color: colors.red, bg: colors.redLight },
            ] as const).map((e) => (
              <button
                key={e.label}
                onClick={() => cambiarEstado(e.label)}
                style={{
                  flex: 1, padding: "12px 8px", borderRadius: 12,
                  border: estadoRider === e.label ? `2px solid ${e.color}` : `1px solid ${colors.gray200}`,
                  background: estadoRider === e.label ? e.bg : colors.white,
                  color: estadoRider === e.label ? e.color : colors.gray500,
                  cursor: "pointer", fontWeight: 700, fontSize: 12,
                  transition: "all 0.2s",
                }}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* INICIO */}
      {tab === "inicio" && (
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: colors.amberLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Package size={18} color={colors.amber} />
                </div>
              </div>
              <p style={{ margin: "0 0 2px", fontSize: 11, color: colors.gray500, fontWeight: 600 }}>Activos</p>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: colors.amber }}>{activos.length}</p>
            </div>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: colors.greenLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Check size={18} color={colors.green} />
                </div>
              </div>
              <p style={{ margin: "0 0 2px", fontSize: 11, color: colors.gray500, fontWeight: 600 }}>Entregados</p>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: colors.green }}>{entregados.length}</p>
            </div>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: colors.blueLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <TrendingUp size={18} color={colors.blue} />
                </div>
              </div>
              <p style={{ margin: "0 0 2px", fontSize: 11, color: colors.gray500, fontWeight: 600 }}>Generado</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: colors.darkBlue }}>{fmt(totalGenerado)}</p>
            </div>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: colors.amberLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Wallet size={18} color={colors.amber} />
                </div>
              </div>
              <p style={{ margin: "0 0 2px", fontSize: 11, color: colors.gray500, fontWeight: 600 }}>Empresa</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: colors.primaryDark }}>{fmt(totalEmpresa)}</p>
            </div>
          </div>
          <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 700, color: colors.gray500 }}>Estado del turno</p>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: activos.length > 0 ? colors.green : colors.gray400 }}>
                {activos.length > 0 ? "Turno activo" : "Sin actividad"}
              </p>
            </div>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: activos.length > 0 ? colors.greenLight : colors.gray100,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Truck size={20} color={activos.length > 0 ? colors.green : colors.gray400} />
            </div>
          </div>
          {ultimo && (
            <div style={card}>
              <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: colors.gray500, textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={14} /> Último pedido
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <strong style={{ color: colors.primaryDark, fontSize: 16 }}>{ultimo.codigo}</strong>
                <span style={estPedido[ultimo.estado]}>{ultimo.estado}</span>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: colors.gray500, fontSize: 13 }}>Cliente</span>
                  <span style={{ color: colors.darkBlue, fontWeight: 600, fontSize: 13 }}>{ultimo.cliente}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: colors.gray500, fontSize: 13 }}>Dirección</span>
                  <span style={{ color: colors.darkBlue, fontWeight: 600, fontSize: 13 }}>{ultimo.direccion}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: colors.gray500, fontSize: 13 }}>Tarifa</span>
                  <span style={{ color: colors.green, fontWeight: 700, fontSize: 13 }}>{fmt(ultimo.precio)}</span>
                </div>
              </div>
              <button
                style={{ ...btnPrimary, marginTop: 14, fontSize: 14 }}
                onClick={() => setTab("pedidos")}
              >
                Ver todos los pedidos
              </button>
            </div>
          )}
        </div>
      )}

      {/* PEDIDOS */}
      {tab === "pedidos" && (
        <div style={{ padding: "16px 16px 0" }}>
          {pedidos.length === 0 ? (
            <div style={{ ...card, textAlign: "center", padding: 40 }}>
              <Package size={48} color={colors.gray300} style={{ marginBottom: 12 }} />
              <p style={{ color: colors.gray400, fontWeight: 600 }}>No tienes pedidos asignados</p>
              <p style={{ color: colors.gray300, fontSize: 13 }}>Los pedidos aparecerán aquí cuando te asignen uno</p>
            </div>
          ) : (
            pedidos.map((p: any) => (
              <div key={p.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: colors.amberLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Package size={18} color={colors.amber} />
                    </div>
                    <strong style={{ color: colors.primaryDark, fontSize: 16 }}>{p.codigo}</strong>
                  </div>
                  <span style={estPedido[p.estado]}>{p.estado}</span>
                </div>
                <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
                  {[
                    { label: "Cliente", val: p.cliente, icon: User },
                    { label: "Teléfono", val: p.telefono || "—", icon: Phone },
                    { label: "Dirección", val: p.direccion, icon: MapPin },
                    { label: "Local", val: locales.find((l: any) => l.id === p.local_id)?.nombre || "—", icon: Package },
                    { label: "Tarifa", val: fmt(p.precio), icon: DollarSign },
                    { label: "Pago", val: p.metodo_pago || "Efectivo", icon: Wallet },
                    { label: "Hora", val: fechaCorta(p.created_at), icon: Clock },
                  ].map((item) => (
                    <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: colors.gray500, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                        <item.icon size={14} /> {item.label}
                      </span>
                      <span style={{
                        color: item.label === "Tarifa" ? colors.green : colors.darkBlue,
                        fontWeight: item.label === "Tarifa" ? 700 : 600,
                        fontSize: 14,
                      }}>
                        {item.val}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {p.estado === "Pendiente" && (
                    <button style={btnPrimary} onClick={() => cambiarEstadoPedido(p.id, "Aceptado")}>
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <Check size={18} /> Aceptar pedido
                      </span>
                    </button>
                  )}
                  {p.estado === "Aceptado" && (
                    <button style={{ ...btnPrimary, background: `linear-gradient(135deg, ${colors.blue}, #2563eb)`, color: "#fff" }} onClick={() => cambiarEstadoPedido(p.id, "Recogido")}>
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <Package size={18} /> Marcar recogido
                      </span>
                    </button>
                  )}
                  {p.estado === "Recogido" && (
                    <button style={{ ...btnPrimary, background: `linear-gradient(135deg, ${colors.purple}, #7c3aed)`, color: "#fff" }} onClick={() => cambiarEstadoPedido(p.id, "En camino")}>
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <Navigation size={18} /> Marcar en camino
                      </span>
                    </button>
                  )}
                  {p.estado === "En camino" && (
                    <button style={{ ...btnPrimary, background: `linear-gradient(135deg, ${colors.green}, #059669)`, color: "#fff" }} onClick={() => cambiarEstadoPedido(p.id, "Entregado")}>
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <Check size={18} /> Marcar entregado
                      </span>
                    </button>
                  )}
                  {p.estado !== "Entregado" && p.estado !== "Cancelado" && (
                    <button style={{ ...btnOutline, color: colors.red, borderColor: colors.red }} onClick={() => cambiarEstadoPedido(p.id, "Problema")}>
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <AlertTriangle size={14} /> Reportar problema
                      </span>
                    </button>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <button style={btnOutline} onClick={() => abrirMapa(p.direccion)}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <MapPin size={14} /> Maps
                    </span>
                  </button>
                  <button style={btnOutline} onClick={() => waCliente(p)}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <MessageCircle size={14} /> WA
                    </span>
                  </button>
                  <button style={btnOutline} onClick={() => copiarPedido(p)}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Copy size={14} /> Copiar
                    </span>
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                  <button style={btnOutline} onClick={() => waEmpresa(p)}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <MessageCircle size={14} /> WA empresa
                    </span>
                  </button>
                  <button style={{ ...btnOutline, color: colors.red, borderColor: colors.red }} onClick={() => waProblema(p)}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <AlertTriangle size={14} /> Reportar
                    </span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MAPA */}
      {tab === "mapa" && (
        <div style={{ padding: "16px 16px 0" }}>
          {activos.length === 0 ? (
            <div style={{ ...card, textAlign: "center", padding: 40 }}>
              <MapPin size={48} color={colors.gray300} style={{ marginBottom: 12 }} />
              <p style={{ color: colors.gray400, fontWeight: 600 }}>No hay direcciones para visitar</p>
              <p style={{ color: colors.gray300, fontSize: 13 }}>Acepta un pedido para ver la ruta</p>
            </div>
          ) : (
            <>
              <div style={{ ...card, textAlign: "center", background: `linear-gradient(135deg, ${colors.darkerBlue}, ${colors.darkBlue})`, color: "#fff", border: "none" }}>
                <p style={{ margin: "0 0 6px", fontSize: 13, color: colors.gray400 }}>{activos.length} pedidos en ruta</p>
                <p style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800 }}>Ruta activa</p>
                <button
                  style={{ ...btnPrimary, maxWidth: 220, margin: "0 auto" }}
                  onClick={() => {
                    const urls = activos.map((p: any) => encodeURIComponent(p.direccion)).join("/");
                    window.open(`https://www.google.com/maps/dir/${urls}`, "_blank");
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Navigation size={18} /> Iniciar ruta
                  </span>
                </button>
              </div>
              {activos.map((p: any, idx: number) => {
                const loc = locales.find((l: any) => l.id === p.local_id);
                return (
                  <div key={p.id} style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: colors.primary,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 13, fontWeight: 800, color: colors.darkerBlue,
                        }}>
                          {idx + 1}
                        </div>
                        <strong style={{ color: colors.primaryDark, fontSize: 15 }}>{p.codigo}</strong>
                      </div>
                      <span style={estPedido[p.estado]}>{p.estado}</span>
                    </div>
                    {loc && (
                      <div style={{ marginBottom: 10, padding: 12, borderRadius: 10, background: colors.gray50 }}>
                        <p style={{ margin: "0 0 4px", fontSize: 11, color: colors.gray500, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors.green }} /> Origen
                        </p>
                        <p style={{ margin: "0 0 2px", fontSize: 14, color: colors.darkBlue, fontWeight: 600 }}>{loc.nombre}</p>
                        <p style={{ margin: 0, fontSize: 12, color: colors.gray500 }}>{loc.direccion}</p>
                      </div>
                    )}
                    <div style={{ padding: 12, borderRadius: 10, background: colors.gray50 }}>
                      <p style={{ margin: "0 0 4px", fontSize: 11, color: colors.gray500, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors.red }} /> Destino
                      </p>
                      <p style={{ margin: "0 0 2px", fontSize: 14, color: colors.darkBlue, fontWeight: 600 }}>{p.cliente}</p>
                      <p style={{ margin: 0, fontSize: 12, color: colors.gray500 }}>{p.direccion}</p>
                    </div>
                    <button
                      style={{ ...btnPrimary, marginTop: 12, background: `linear-gradient(135deg, ${colors.blue}, #2563eb)`, color: "#fff" }}
                      onClick={() => abrirMapa(p.direccion)}
                    >
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <Navigation size={16} /> Abrir en Google Maps
                      </span>
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* LIQUIDACIÓN */}
      {tab === "liquidacion" && (
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{
            ...card,
            background: `linear-gradient(135deg, ${colors.darkerBlue} 0%, ${colors.darkBlue} 100%)`,
            textAlign: "center",
            border: "none",
            marginBottom: 16,
          }}>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: colors.gray400 }}>Total a recibir</p>
            <h1 style={{ margin: "0 0 4px", fontSize: 36, fontWeight: 900, color: colors.primary }}>
              {fmt(totalRepartidor)}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: colors.gray400 }}>{entregados.length} pedidos entregados</p>
          </div>
          <div style={card}>
            <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: colors.darkBlue }}>Resumen del turno</p>
            <div style={{ display: "grid", gap: 0 }}>
              {[
                { label: "Domicilios realizados", val: `${entregados.length}`, color: colors.darkBlue },
                { label: "Total generado", val: fmt(totalGenerado), color: colors.darkBlue },
                { label: "Total en efectivo", val: fmt(entregados.filter((p) => p.metodo_pago === "Efectivo").reduce((s, p) => s + (p.precio || 0), 0)), color: colors.darkBlue },
                { label: "Total en transferencia", val: fmt(entregados.filter((p) => p.metodo_pago === "Transferencia").reduce((s, p) => s + (p.precio || 0), 0)), color: colors.darkBlue },
                { label: "Debe a empresa", val: fmt(totalEmpresa), color: colors.amber },
                { label: "Tu ganancia", val: fmt(totalRepartidor), color: colors.green },
              ].map((item, i, arr) => (
                <div key={item.label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  paddingBottom: 14,
                  borderBottom: i < arr.length - 1 ? `1px solid ${colors.gray100}` : "none",
                }}>
                  <span style={{ color: colors.gray500, fontSize: 13 }}>{item.label}</span>
                  <span style={{ color: item.color, fontWeight: 700, fontSize: 14 }}>{item.val}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: colors.gray500, fontSize: 14, fontWeight: 600 }}>Estado de liquidación</span>
            <span style={{
              padding: "6px 16px", borderRadius: 999,
              background: todosLiquidados ? colors.greenLight : colors.amberLight,
              color: todosLiquidados ? colors.green : colors.amber,
              fontSize: 13, fontWeight: 700,
            }}>
              {todosLiquidados ? "Liquidado" : "Pendiente"}
            </span>
          </div>
          {entregados.map((p: any) => (
            <div key={p.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ color: colors.primaryDark, fontSize: 15 }}>{p.codigo}</strong>
                  <p style={{ margin: "2px 0 0", color: colors.gray500, fontSize: 13 }}>{p.cliente}</p>
                </div>
                <span style={{ color: colors.green, fontWeight: 700, fontSize: 15 }}>{fmt(p.pago_repartidor)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PERFIL */}
      {tab === "perfil" && (
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{ ...card, textAlign: "center", marginBottom: 16 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.amber} 100%)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, fontWeight: 900, color: colors.darkerBlue,
              margin: "0 auto 16px",
            }}>
              {(riderData.nombre || "R").charAt(0).toUpperCase()}
            </div>
            <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: colors.darkBlue }}>
              {riderData.nombre}
            </h2>
            <p style={{ margin: 0, color: colors.gray500, fontSize: 14 }}>{profile?.email}</p>
          </div>
          <div style={card}>
            {[
              { label: "Teléfono", val: riderData.telefono || "No registrado", icon: Phone },
              { label: "Documento", val: riderData.documento || "No registrado", icon: FileText },
              { label: "Vehículo", val: riderData.vehiculo || "No registrado", icon: Truck },
              { label: "Placa", val: riderData.placa || "No registrado", icon: Package },
              { label: "Estado", val: estadoRider, icon: Shield },
            ].map((item, i, arr) => (
              <div key={item.label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                paddingBottom: i < arr.length - 1 ? 14 : 0,
                borderBottom: i < arr.length - 1 ? `1px solid ${colors.gray100}` : "none",
              }}>
                <span style={{ color: colors.gray500, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <item.icon size={16} /> {item.label}
                </span>
                <span style={{ color: item.label === "Estado" ? (estadoRider === "Disponible" ? colors.green : estadoRider === "Ocupado" ? colors.amber : colors.red) : colors.darkBlue, fontWeight: 600, fontSize: 14 }}>
                  {item.val}
                </span>
              </div>
            ))}
          </div>
          <button
            style={{
              ...btnOutline, width: "100%", color: colors.red, borderColor: colors.red,
              padding: 16, fontSize: 15, marginTop: 8,
            }}
            onClick={() => { logout(); }}
          >
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <LogOut size={18} /> Cerrar sesión
            </span>
          </button>
        </div>
      )}

      {/* BOTTOM NAV */}
      <nav style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480,
        background: colors.white,
        borderTop: `1px solid ${colors.gray200}`,
        display: "flex", justifyContent: "space-around",
        padding: "6px 0 10px", zIndex: 100,
        boxShadow: "0 -2px 10px rgba(0,0,0,0.05)",
      }}>
        {([
          { id: "inicio" as TabType, icon: Home, label: "Inicio" },
          { id: "pedidos" as TabType, icon: ListOrdered, label: "Pedidos" },
          { id: "mapa" as TabType, icon: MapPin, label: "Mapa" },
          { id: "liquidacion" as TabType, icon: DollarSign, label: "Liquidación" },
          { id: "perfil" as TabType, icon: User, label: "Perfil" },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              background: "none", border: "none", cursor: "pointer", padding: "6px 12px",
              color: tab === t.id ? colors.primaryDark : colors.gray400,
              transition: "color 0.2s",
            }}
          >
            <t.icon size={22} strokeWidth={tab === t.id ? 2.5 : 2} />
            <span style={{ fontSize: 10, fontWeight: tab === t.id ? 700 : 500 }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
