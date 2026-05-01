"use client";

import { useState, useEffect, useMemo, useCallback, useRef, FormEvent, CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

/* ======================== TARIFAS ========================
  0 a 2 km → $5.000  (rep $3.800 / emp $1.200)
  2 a 4 km → $6.000  (rep $4.500 / emp $1.500)
  4 a 5 km → $7.000  (rep $5.200 / emp $1.800)
  >5 a 6 km → $8.000 (rep $6.000 / emp $2.000)
  >6 km → $8.000 + $2.000 cada 2km extra
           Si precio > $8.000: empresa = 40%, repartidor = 60%
================================================================== */

function calcularTarifas(km: number): { precio: number; pagoRepartidor: number; empresaRecibe: number } {
  if (km <= 2) return { precio: 5000, pagoRepartidor: 3800, empresaRecibe: 1200 };
  if (km <= 4) return { precio: 6000, pagoRepartidor: 4500, empresaRecibe: 1500 };
  if (km <= 5) return { precio: 7000, pagoRepartidor: 5200, empresaRecibe: 1800 };
  let precio: number;
  if (km <= 6) precio = 8000;
  else precio = 8000 + Math.ceil((km - 6) / 2) * 2000;
  let empresaRecibe: number;
  let pagoRepartidor: number;
  if (precio === 8000) { empresaRecibe = 2000; pagoRepartidor = 6000; }
  else { empresaRecibe = Math.round(precio * 0.4); pagoRepartidor = precio - empresaRecibe; }
  return { precio, pagoRepartidor, empresaRecibe };
}

function calcularEnvio(km: number) { return Math.max(2500, Math.round(km * 1200)); }

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value || 0);
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ======================== TIPOS ======================== */

type Tab = "panel" | "nuevo-pedido" | "pedidos" | "repartidores" | "locales" | "liquidacion" | "turnos" | "config";

type Pedido = {
  id: string; codigo: string; cliente: string; telefono: string;
  direccion: string; barrio: string; notas: string; localId: string;
  repartidorId: string | null; km: number; envio: number;
  precio: number; pagoRepartidor: number; empresaRecibe: number;
  estado: string; liquidado: boolean; cancelado: boolean;
  createdAt: string; tiempoMin: number; turnoId: string | null;
};

type Repartidor = { id: string; nombre: string; telefono: string; estado: string; vehiculo: string; placa: string; documento: string };
type Local = { id: string; nombre: string; direccion: string; telefono: string };
type AddressRecord = { id: string; cliente: string; direccion: string; barrio: string; km: number; tiempoMin: number; envio: number };
type AppConfig = { id: string; tarifaBase: number; costoPorKm: number; porcentajeRepartidor: number; whatsappNumber: string; companyName: string };
type Turno = { id: string; openedAt: string; closedAt: string | null; notas: string; activo: boolean; createdAt: string };

const ESTADOS_PEDIDO = ["Pendiente", "Asignado", "Aceptado", "Recogido", "En camino", "Entregado"] as const;
const ITEMS_PER_PAGE = 15;

/* ======================== ESTILOS ======================== */

const pageStyle: CSSProperties = { display: "flex", minHeight: "100vh", background: "#02060d", color: "#cbd5e1", fontFamily: "'Inter', system-ui, sans-serif" };
const sidebarStyle: CSSProperties = { width: 300, padding: 32, background: "#09101c", borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", justifyContent: "space-between" };
const inputStyle: CSSProperties = { width: "100%", padding: "16px 20px", borderRadius: 18, border: "1px solid rgba(255,255,255,0.12)", background: "#09111d", color: "#f8fafc", fontSize: 16, boxSizing: "border-box" };
const primaryBtn: CSSProperties = { padding: "16px 24px", borderRadius: 20, border: "none", background: "linear-gradient(135deg, #facc15 0%, #f59e0b 100%)", color: "#0f172a", fontWeight: 700, fontSize: 16, cursor: "pointer" };
const smallBtn: CSSProperties = { padding: "10px 14px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#f8fafc", cursor: "pointer", fontSize: 13, fontWeight: 600 };
const deleteBtn: CSSProperties = { ...smallBtn, border: "1px solid #ef4444", color: "#fecaca" };
const panelCard: CSSProperties = { background: "#0f172a", borderRadius: 24, padding: 32, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 24 };
const sectionTitle: CSSProperties = { margin: "0 0 24px", fontSize: 24, fontWeight: 800, color: "#f8fafc" };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse" as const, color: "#cbd5e1", fontSize: 14 };
const toastOk: CSSProperties = { padding: "16px 20px", borderRadius: 20, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#ffffff", marginBottom: 24, fontWeight: 600 };
const toastErr: CSSProperties = { padding: "16px 20px", borderRadius: 20, background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", color: "#ffffff", marginBottom: 24, fontWeight: 600 };
const miniCard: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: 20, borderRadius: 20, background: "#0b1221", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 12 };
const pillGreen: CSSProperties = { padding: "8px 16px", borderRadius: 999, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#ffffff", fontSize: 12, fontWeight: 700 };
const pillYellow: CSSProperties = { padding: "8px 16px", borderRadius: 999, background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: "#ffffff", fontSize: 12, fontWeight: 700 };
const pillRed: CSSProperties = { padding: "8px 16px", borderRadius: 999, background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", color: "#ffffff", fontSize: 12, fontWeight: 700 };
const suggestionList: CSSProperties = { display: "grid", gap: 8, marginTop: -4, marginBottom: 12, padding: 12, borderRadius: 18, background: "rgba(15,23,42,0.92)", border: "1px solid rgba(255,255,255,0.08)" };
const suggestionItem: CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#f8fafc", textAlign: "left", cursor: "pointer", fontSize: 14 };
const infoBox: CSSProperties = { padding: "16px 18px", borderRadius: 18, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#cbd5e1", display: "grid", gap: 6, fontSize: 14 };
const labelStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 600, color: "#94a3b8" };
const filtersStyle: CSSProperties = { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" as const };
const paginationStyle: CSSProperties = { display: "flex", justifyContent: "center", alignItems: "center", gap: 20, marginTop: 24 };
const actionsCell: CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap" as const, alignItems: "center" };
const thStyle: CSSProperties = { textAlign: "left" as const, padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" as const };
const tdStyle: CSSProperties = { padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" };

function estadoColor(estado: string): CSSProperties {
  const colors: Record<string, CSSProperties> = {
    "Pendiente": { padding: "8px 16px", borderRadius: 999, background: "#64748b", color: "#fff", fontSize: 12, fontWeight: 700 },
    "Asignado": { padding: "8px 16px", borderRadius: 999, background: "#f59e0b", color: "#fff", fontSize: 12, fontWeight: 700 },
    "Aceptado": { padding: "8px 16px", borderRadius: 999, background: "#3b82f6", color: "#fff", fontSize: 12, fontWeight: 700 },
    "Recogido": { padding: "8px 16px", borderRadius: 999, background: "#8b5cf6", color: "#fff", fontSize: 12, fontWeight: 700 },
    "En camino": { padding: "8px 16px", borderRadius: 999, background: "#6366f1", color: "#fff", fontSize: 12, fontWeight: 700 },
    "Entregado": { padding: "8px 16px", borderRadius: 999, background: "#10b981", color: "#fff", fontSize: 12, fontWeight: 700 },
    "Cancelado": { padding: "8px 16px", borderRadius: 999, background: "#ef4444", color: "#fff", fontSize: 12, fontWeight: 700 },
  };
  return colors[estado] || colors["Pendiente"];
}

function riderEstadoColor(estado: string): CSSProperties {
  const colors: Record<string, CSSProperties> = {
    "Disponible": { padding: "6px 12px", borderRadius: 999, background: "#10b981", color: "#fff", fontSize: 11, fontWeight: 700 },
    "Ocupado": { padding: "6px 12px", borderRadius: 999, background: "#f59e0b", color: "#000", fontSize: 11, fontWeight: 700 },
    "No disponible": { padding: "6px 12px", borderRadius: 999, background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 700 },
  };
  return colors[estado] || colors["No disponible"];
}

function MetricCard({ label, value, footnote }: { label: string; value: string; footnote: string }) {
  return (
    <div style={{ background: "#0b1221", borderRadius: 24, padding: 28, border: "1px solid rgba(255,255,255,0.08)" }}>
      <p style={{ color: "#facc15", fontSize: 13, fontWeight: 700, margin: "0 0 12px" }}>{label}</p>
      <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#ffffff" }}>{value}</h2>
      <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 14 }}>{footnote}</p>
    </div>
  );
}

/* ======================== COMPONENTE PRINCIPAL ======================== */

export default function DomiUApp() {
  const [tab, setTab] = useState<Tab>("panel");
  const [user, setUser] = useState<User | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [repartidores, setRepartidores] = useState<Repartidor[]>([]);
  const [locales, setLocales] = useState<Local[]>([]);
  const [addressHistory, setAddressHistory] = useState<AddressRecord[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [turnoActivo, setTurnoActivo] = useState<Turno | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");
  const [googleMapsReady, setGoogleMapsReady] = useState(false);

  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);

  // Form pedido
  const [pedidoIdEditar, setPedidoIdEditar] = useState<string | null>(null);
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [barrio, setBarrio] = useState("");
  const [notas, setNotas] = useState("");
  const [localId, setLocalId] = useState("");
  const [repartidorId, setRepartidorId] = useState("");
  const [km, setKm] = useState("");
  const [tiempoMin, setTiempoMin] = useState(0);
  const [envio, setEnvio] = useState("");
  const [precioManual, setPrecioManual] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressRecord[]>([]);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const direccionInputRef = useRef<HTMLInputElement | null>(null);

  // Form repartidor
  const [repEditId, setRepEditId] = useState<string | null>(null);
  const [repNombre, setRepNombre] = useState("");
  const [repTelefono, setRepTelefono] = useState("");
  const [repVehiculo, setRepVehiculo] = useState("");
  const [repPlaca, setRepPlaca] = useState("");
  const [repDocumento, setRepDocumento] = useState("");

  // Form local
  const [locEditId, setLocEditId] = useState<string | null>(null);
  const [locNombre, setLocNombre] = useState("");
  const [locDireccion, setLocDireccion] = useState("");
  const [locTelefono, setLocTelefono] = useState("");

  // Form config
  const [configTarifaBase, setConfigTarifaBase] = useState("2500");
  const [configCostoPorKm, setConfigCostoPorKm] = useState("1200");
  const [configPorcentajeRep, setConfigPorcentajeRep] = useState("55");
  const [configWhatsapp, setConfigWhatsapp] = useState("");
  const [configCompanyName, setConfigCompanyName] = useState("DomiU Magdalena");

  // Form turno
  const [turnoNotas, setTurnoNotas] = useState("");

  // Paste parser
  const [pasteText, setPasteText] = useState("");

  // Form cancelar
  const [cancelarId, setCancelarId] = useState<string | null>(null);
  const [cancelarRazon, setCancelarRazon] = useState("");

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }));
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const ok = useCallback((t: string) => { setMensaje(t); setTimeout(() => setMensaje(""), 4000); }, []);
  const fail = useCallback((t: string) => { setError(t); setTimeout(() => setError(""), 6000); }, []);
  const fechaHoy = useMemo(() => new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }), []);

  // Cargar datos
  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [{ data: dP }, { data: dR }, { data: dL }, { data: dA }, { data: dC }, { data: dT }] = await Promise.all([
        supabase.from("pedidos").select("*").order("created_at", { ascending: false }),
        supabase.from("repartidores").select("*").eq("activo", true).order("created_at", { ascending: false }),
        supabase.from("locales").select("*").eq("activo", true).order("created_at", { ascending: false }),
        supabase.from("address_history").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("app_config").select("*").limit(1),
        supabase.from("turnos").select("*").order("created_at", { ascending: false }),
      ]);
      if (dP) setPedidos(dP.map((p: any) => ({
        id: p.id, codigo: p.codigo, cliente: p.cliente, telefono: p.telefono,
        direccion: p.direccion, barrio: p.barrio, notas: p.notas || "", localId: p.local_id || "",
        repartidorId: p.repartidor_id, km: Number(p.km) || 0, envio: p.envio || 0,
        precio: p.precio || 0, pagoRepartidor: p.pago_repartidor || 0, empresaRecibe: p.empresa_recibe || 0,
        estado: p.estado || "Pendiente", liquidado: !!p.liquidado, cancelado: !!p.cancelado,
        createdAt: p.created_at, tiempoMin: p.tiempo_min || 0, turnoId: p.turno_id || null,
      })));
      if (dR) setRepartidores(dR.map((r: any) => ({ id: r.id, nombre: r.nombre, telefono: r.telefono || "", estado: r.estado || "No disponible", vehiculo: r.vehiculo || "", placa: r.placa || "", documento: r.documento || "" })));
      if (dL) setLocales(dL.map((l: any) => ({ id: l.id, nombre: l.nombre, direccion: l.direccion || "", telefono: l.telefono || "" })));
      if (dA) setAddressHistory(dA.map((a: any) => ({
        id: a.id, cliente: a.cliente, direccion: a.direccion, barrio: a.barrio || "Desconocido",
        km: Number(a.km) || 0, tiempoMin: a.tiempo_min || 0, envio: a.envio || 0,
      })));
      if (dC && dC.length > 0) {
        const cfg = dC[0];
        const cfgObj: AppConfig = {
          id: cfg.id, tarifaBase: cfg.tarifa_base || 2500, costoPorKm: cfg.costo_por_km || 1200,
          porcentajeRepartidor: cfg.porcentaje_repartidor || 55, whatsappNumber: cfg.whatsapp_number || "",
          companyName: cfg.company_name || "DomiU Magdalena",
        };
        setAppConfig(cfgObj);
        setConfigTarifaBase(String(cfgObj.tarifaBase));
        setConfigCostoPorKm(String(cfgObj.costoPorKm));
        setConfigPorcentajeRep(String(cfgObj.porcentajeRepartidor));
        setConfigWhatsapp(cfgObj.whatsappNumber);
        setConfigCompanyName(cfgObj.companyName);
      }
      if (dT) {
        setTurnos(dT.map((t: any) => ({ id: t.id, openedAt: t.opened_at, closedAt: t.closed_at, notas: t.notas || "", activo: !!t.activo, createdAt: t.created_at })));
        const activo = dT.find((t: any) => t.activo);
        if (activo) setTurnoActivo({ id: activo.id, openedAt: activo.opened_at, closedAt: activo.closed_at, notas: activo.notas || "", activo: true, createdAt: activo.created_at });
        else setTurnoActivo(null);
      }
    } catch (e: any) {
      fail("Error al cargar: " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  }, [user, fail]);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time subscriptions
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("admin_pedidos")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "repartidores" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "turnos" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadData]);

  // Google Maps
  useEffect(() => {
    if (typeof window === "undefined") return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;
    if ((window as any).google?.maps) { setGoogleMapsReady(true); return; }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true; script.defer = true;
    script.onload = () => setGoogleMapsReady(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!googleMapsReady || !direccionInputRef.current) return;
    const g = (window as any).google?.maps;
    if (!g?.places?.Autocomplete) return;
    const ac = new g.places.Autocomplete(direccionInputRef.current, { types: ["address"], componentRestrictions: { country: "co" } });
    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place.formatted_address) return;
      setDireccion(place.formatted_address);
      const b = place.address_components?.find((c: any) => c.types.includes("sublocality") || c.types.includes("neighborhood"));
      if (b?.long_name) setBarrio(b.long_name);
      setTimeout(calcularRuta, 300);
    });
    return () => g.event.clearInstanceListeners(ac);
  }, [googleMapsReady, localId]);

  const calcularRuta = useCallback(() => {
    if (!localId || !direccion.trim()) return;
    const local = locales.find((l) => l.id === localId);
    if (!local) return;
    const saved = addressHistory.find((h) =>
      h.cliente.trim().toLowerCase() === cliente.trim().toLowerCase() &&
      h.direccion.trim().toLowerCase() === direccion.trim().toLowerCase()
    );
    if (saved) { setKm(String(saved.km)); setTiempoMin(saved.tiempoMin); setEnvio(String(saved.envio)); setBarrio(saved.barrio); return; }
    const g = (window as any).google?.maps;
    if (!g?.DistanceMatrixService) return;
    setDistanceLoading(true);
    new g.DistanceMatrixService().getDistanceMatrix({
      origins: [local.direccion], destinations: [direccion],
      travelMode: g.TravelMode.DRIVING, unitSystem: g.UnitSystem.METRIC,
    }, (resp: any, status: string) => {
      setDistanceLoading(false);
      if (status !== "OK") { fail("Error Google Maps. Ingrese km manualmente."); return; }
      const el = resp.rows?.[0]?.elements?.[0];
      if (!el || el.status !== "OK") { fail("Ruta no encontrada. Ingrese km manualmente."); return; }
      const kv = Math.round((el.distance.value / 1000) * 100) / 100;
      const mv = Math.max(1, Math.round(el.duration.value / 60));
      setKm(String(kv)); setTiempoMin(mv); setEnvio(String(calcularEnvio(kv)));
    });
  }, [localId, direccion, cliente, locales, addressHistory, fail]);

  useEffect(() => {
    const t = setTimeout(() => { if (direccion.trim() && localId) calcularRuta(); }, 600);
    return () => clearTimeout(t);
  }, [direccion, localId, googleMapsReady, cliente, calcularRuta]);

  useEffect(() => {
    const q = direccion.trim().toLowerCase();
    if (!q || !cliente.trim()) { setAddressSuggestions([]); return; }
    setAddressSuggestions(addressHistory.filter((h) =>
      h.cliente.trim().toLowerCase() === cliente.trim().toLowerCase() && h.direccion.trim().toLowerCase().includes(q)
    ));
  }, [cliente, direccion, addressHistory]);

  /* ======================== TURNOS ======================== */

  const abrirTurno = async () => {
    try {
      const { error: e2 } = await supabase.from("turnos").insert({ user_id: user?.id, notas: turnoNotas.trim() || null });
      if (e2) throw e2;
      ok("Turno abierto.");
      setTurnoNotas("");
      loadData();
    } catch (e: any) { fail("Error: " + (e.message || "")); }
  };

  const cerrarTurno = async (id: string) => {
    try {
      const { error: e2 } = await supabase.from("turnos").update({ cerrado_at: new Date().toISOString(), activo: false }).eq("id", id);
      if (e2) throw e2;
      ok("Turno cerrado.");
      loadData();
    } catch (e: any) { fail("Error: " + (e.message || "")); }
  };

  /* ======================== CRUD PEDIDOS ======================== */

  const guardarPedido = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const kmVal = Number(km);
    if (!cliente.trim() || !direccion.trim() || Number.isNaN(kmVal) || kmVal <= 0) { fail("Cliente, dirección y km son obligatorios."); return; }
    if (!telefono.trim() || telefono.length < 7) { fail("Ingrese un teléfono válido (mínimo 7 dígitos)."); return; }

    if (repartidorId) {
      const rep = repartidores.find((r) => r.id === repartidorId);
      if (rep && rep.estado !== "Disponible") { fail(`El repartidor "${rep.nombre}" está "${rep.estado}". Solo puedes asignar repartidores disponibles.`); return; }
    }

    let precioFinal: number;
    let pagoRep: number;
    let empRec: number;
    if (precioManual.trim() && Number(precioManual) > 0) {
      precioFinal = Number(precioManual);
      if (precioFinal > 8000) { empRec = Math.round(precioFinal * 0.4); pagoRep = precioFinal - empRec; }
      else { const base = calcularTarifas(kmVal); const ratio = precioFinal / base.precio; pagoRep = Math.round(base.pagoRepartidor * ratio); empRec = precioFinal - pagoRep; }
    } else {
      const t = calcularTarifas(kmVal);
      precioFinal = t.precio; pagoRep = t.pagoRepartidor; empRec = t.empresaRecibe;
    }

    const envioVal = Number(envio) || calcularEnvio(kmVal);
    const tiempoVal = tiempoMin || 10 + Math.round(kmVal * 4);

    const getOrCreateTurnoId = async (): Promise<string | null> => {
      if (turnoActivo) return turnoActivo.id;
      const { data } = await supabase.from("turnos").select("id").eq("activo", true).limit(1);
      if (data && data.length > 0) { setTurnoActivo({ id: data[0].id, openedAt: "", closedAt: null, notas: "", activo: true, createdAt: "" }); return data[0].id; }
      return null;
    };

    const turnoId = await getOrCreateTurnoId();

    let nuevoCodigo: string;
    if (pedidoIdEditar) {
      nuevoCodigo = pedidos.find((p) => p.id === pedidoIdEditar)?.codigo || `DOM-${String(pedidos.length + 1).padStart(4, "0")}`;
    } else {
      const { data: countData } = await supabase.from("pedidos").select("id", { count: "exact", head: true });
      const count = countData ? countData.length : pedidos.length;
      nuevoCodigo = `DOM-${String(count + 1).padStart(4, "0")}`;
    }

    const payload: any = {
      codigo: nuevoCodigo,
      cliente: cliente.trim(), telefono: telefono.trim(),
      direccion: direccion.trim(), barrio: barrio.trim() || "Desconocido",
      notas: notas.trim() || null, local_id: localId || null, repartidor_id: repartidorId || null,
      km: kmVal, envio: envioVal, precio: precioFinal,
      pago_repartidor: pagoRep, empresa_recibe: empRec,
      estado: pedidoIdEditar ? (pedidos.find((p) => p.id === pedidoIdEditar)?.estado || "Pendiente") : (repartidorId ? "Asignado" : "Pendiente"),
      liquidado: pedidoIdEditar ? (pedidos.find((p) => p.id === pedidoIdEditar)?.liquidado || false) : false,
      cancelado: false, cancelado_razon: null, cancelado_at: null,
      tiempo_min: tiempoVal, turno_id: turnoId, user_id: user?.id
    };

    try {
      if (pedidoIdEditar) {
        const { error: e2 } = await supabase.from("pedidos").update(payload).eq("id", pedidoIdEditar);
        if (e2) throw e2;
        ok("Pedido actualizado.");
      } else {
        const { error: e2 } = await supabase.from("pedidos").insert(payload);
        if (e2) throw e2;
        ok("Pedido creado.");
      }
      await supabase.from("address_history").insert({
        cliente: cliente.trim(), direccion: direccion.trim(),
        barrio: barrio.trim() || "Desconocido", km: kmVal, tiempo_min: tiempoVal, envio: envioVal, user_id: user?.id
      });
      if (repartidorId) {
        await supabase.from("repartidores").update({ estado: "Ocupado" }).eq("id", repartidorId);
      }
      setCliente(""); setTelefono(""); setDireccion(""); setBarrio(""); setNotas("");
      setLocalId(""); setRepartidorId(""); setKm(""); setTiempoMin(0);
      setEnvio(""); setPrecioManual(""); setPedidoIdEditar(null);
      loadData();
    } catch (e: any) { fail("Error: " + (e.message || "desconocido")); }
  };

  const editarPedido = (p: Pedido) => {
    setPedidoIdEditar(p.id); setCliente(p.cliente); setTelefono(p.telefono);
    setDireccion(p.direccion); setBarrio(p.barrio); setNotas(p.notas || ""); setLocalId(p.localId || "");
    setRepartidorId(p.repartidorId || ""); setKm(String(p.km)); setTiempoMin(p.tiempoMin);
    setEnvio(String(p.envio)); setPrecioManual(String(p.precio)); setTab("nuevo-pedido");
  };

  const eliminarPedido = async (id: string) => {
    if (!confirm("¿Eliminar este pedido permanentemente?")) return;
    const { error: e2 } = await supabase.from("pedidos").delete().eq("id", id);
    if (e2) { fail(e2.message); return; }
    ok("Pedido eliminado."); loadData();
  };

  const cambiarEstado = async (id: string, estado: string) => {
    const { error: e2 } = await supabase.from("pedidos").update({ estado }).eq("id", id);
    if (e2) { fail(e2.message); return; }
    if (estado === "Entregado") {
      const pedido = pedidos.find((p) => p.id === id);
      if (pedido?.repartidorId) {
        await supabase.from("repartidores").update({ estado: "Disponible" }).eq("id", pedido.repartidorId);
      }
    }
    loadData();
  };

  const cancelarPedido = async () => {
    if (!cancelarId || !cancelarRazon.trim()) { fail("Ingrese el motivo de cancelación."); return; }
    const pedido = pedidos.find((p) => p.id === cancelarId);
    if (pedido?.repartidorId) {
      await supabase.from("repartidores").update({ estado: "Disponible" }).eq("id", pedido.repartidorId);
    }
    const { error: e2 } = await supabase.from("pedidos").update({
      estado: "Cancelado", cancelado: true, cancelado_razon: cancelarRazon.trim(), cancelado_at: new Date().toISOString()
    }).eq("id", cancelarId);
    if (e2) { fail(e2.message); return; }
    ok("Pedido cancelado."); setCancelarId(null); setCancelarRazon(""); loadData();
  };

  const copiarTexto = (t: string) => navigator.clipboard.writeText(t).then(() => ok("Copiado."), () => fail("Error al copiar."));

  const copiarEmpresa = (p: Pedido) => {
    const loc = locales.find((l) => l.id === p.localId);
    const rep = repartidores.find((r) => r.id === p.repartidorId);
    copiarTexto(`Pedido: ${p.codigo}\nFecha: ${formatearFecha(p.createdAt)}\nLocal: ${loc?.nombre || "-"}\nCliente: ${p.cliente}\nBarrio: ${p.barrio}\nTel: ${p.telefono}\nDir: ${p.direccion}${p.notas ? `\nNotas: ${p.notas}` : ""}\nRepartidor: ${rep?.nombre || "-"}\nKm: ${p.km} | ${p.tiempoMin} min\nEnvío: ${formatMoney(p.envio)}\nTarifa: ${formatMoney(p.precio)}\nEmpresa: ${formatMoney(p.empresaRecibe)}\nEstado: ${p.estado}`);
  };

  const copiarRepartidor = (p: Pedido) => {
    const loc = locales.find((l) => l.id === p.localId);
    const rep = repartidores.find((r) => r.id === p.repartidorId);
    copiarTexto(`Pedido: ${p.codigo}\nCliente: ${p.cliente}\nBarrio: ${p.barrio}\nDir: ${p.direccion}\nLocal: ${loc?.nombre || "-"}\nRepartidor: ${rep?.nombre || "-"}\nKm: ${p.km} | ${p.tiempoMin} min\nTarifa: ${formatMoney(p.precio)}\nTu pago: ${formatMoney(p.pagoRepartidor)}\nEstado: ${p.estado}`);
  };

  const enviarWhatsAppEmpresa = (p: Pedido) => {
    const loc = locales.find((l) => l.id === p.localId);
    const rep = repartidores.find((r) => r.id === p.repartidorId);
    const phone = appConfig?.whatsappNumber || "";
    if (!phone) { fail("Configure el número de WhatsApp en Configuración."); return; }
    const msg = `*${appConfig?.companyName || "DomiU"}*\n\nPedido: ${p.codigo}\nFecha: ${formatearFecha(p.createdAt)}\nLocal: ${loc?.nombre || "-"}\nCliente: ${p.cliente}\nBarrio: ${p.barrio}\nTel: ${p.telefono}\nDir: ${p.direccion}${p.notas ? `\nNotas: ${p.notas}` : ""}\nRepartidor: ${rep?.nombre || "-"}\nKm: ${p.km} | ${p.tiempoMin} min\nEnvío: ${formatMoney(p.envio)}\nTarifa: ${formatMoney(p.precio)}\nEmpresa: ${formatMoney(p.empresaRecibe)}\nEstado: ${p.estado}`;
    window.open(`https://wa.me/57${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const enviarWhatsAppRepartidor = (p: Pedido) => {
    const rep = repartidores.find((r) => r.id === p.repartidorId);
    if (!rep?.telefono) { fail("El repartidor no tiene teléfono."); return; }
    const loc = locales.find((l) => l.id === p.localId);
    const msg = `*Pedido ${p.codigo}*\n\nCliente: ${p.cliente}\nBarrio: ${p.barrio}\nDir: ${p.direccion}\nLocal: ${loc?.nombre || "-"}\nKm: ${p.km} | ${p.tiempoMin} min\nTarifa: ${formatMoney(p.precio)}\nTu pago: ${formatMoney(p.pagoRepartidor)}\nEstado: ${p.estado}`;
    window.open(`https://wa.me/57${rep.telefono}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const enviarWhatsAppCliente = (p: Pedido) => {
    if (!p.telefono) { fail("El cliente no tiene teléfono."); return; }
    const rep = repartidores.find((r) => r.id === p.repartidorId);
    const msg = `Hola ${p.cliente}, tu pedido *${p.codigo}* de *${appConfig?.companyName || "DomiU"}* está en estado: *${p.estado}*.\n\nRepartidor: ${rep?.nombre || "En asignación"}\nDirección: ${p.direccion}\n\n¡Gracias por tu pedido!`;
    window.open(`https://wa.me/57${p.telefono}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  /* ======================== PASTE PARSER ======================== */

  const parsePasteText = () => {
    if (!pasteText.trim()) { fail("Pegue el texto primero."); return; }
    const lines = pasteText.split(/\r?\n/).filter((l) => l.trim());
    let foundCliente = "", foundTelefono = "", foundDireccion = "", foundBarrio = "";
    for (const line of lines) {
      const lower = line.toLowerCase().trim();
      if (/^(cliente|nombre|client)\s*[:\-]/.test(lower)) foundCliente = line.replace(/^[^:\-]*[:\-]\s*/, "").trim();
      else if (/^(tel|phone|telefono|móvil|celular)\s*[:\-]/.test(lower)) foundTelefono = line.replace(/^[^:\-]*[:\-]\s*/, "").trim();
      else if (/^(dir|dirección|direccion|address)\s*[:\-]/.test(lower)) foundDireccion = line.replace(/^[^:\-]*[:\-]\s*/, "").trim();
      else if (/^(barrio|zona|sector)\s*[:\-]/.test(lower)) foundBarrio = line.replace(/^[^:\-]*[:\-]\s*/, "").trim();
    }
    if (!foundCliente && lines.length > 0) foundCliente = lines[0].replace(/^[^:\-]*[:\-]\s*/, "").trim();
    if (!foundDireccion) {
      const dirLine = lines.find((l) => /\d/.test(l) && /calle|cra|carrera|avenida|av\.?|#/.test(l.toLowerCase()));
      if (dirLine) foundDireccion = dirLine.replace(/^[^:\-]*[:\-]\s*/, "").trim();
    }
    if (!foundTelefono) { const phoneMatch = pasteText.match(/\b(3\d{9})\b/); if (phoneMatch) foundTelefono = phoneMatch[1]; }
    if (!foundCliente) { fail("No se encontró el cliente en el texto."); return; }
    setCliente(foundCliente);
    if (foundTelefono) setTelefono(foundTelefono);
    if (foundDireccion) setDireccion(foundDireccion);
    if (foundBarrio) setBarrio(foundBarrio);
    ok("Datos extraídos correctamente del texto.");
    setPasteText("");
  };

  /* ======================== EXPORT REPORTS ======================== */

  const exportToExcel = () => {
    if (pedidos.length === 0) { fail("No hay pedidos para exportar."); return; }
    const data = pedidosDet.map((p) => ({
      Código: p.codigo, Fecha: formatearFecha(p.createdAt), Cliente: p.cliente, Teléfono: p.telefono,
      Dirección: p.direccion, Barrio: p.barrio, Notas: p.notas || "", Local: p.localNombre, Repartidor: p.repartidorNombre,
      Km: p.km, "Tiempo (min)": p.tiempoMin, Envío: p.envio, Tarifa: p.precio,
      "Pago Repartidor": p.pagoRepartidor, "Empresa Recibe": p.empresaRecibe, Estado: p.estado, Liquidado: p.liquidado ? "Sí" : "No",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
    XLSX.writeFile(wb, `DomiU_Pedidos_${new Date().toISOString().split("T")[0]}.xlsx`);
    ok("Excel descargado.");
  };

  const exportToPDF = () => {
    if (pedidos.length === 0) { fail("No hay pedidos para exportar."); return; }
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`${appConfig?.companyName || "DomiU Magdalena"} - Reporte de Pedidos`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleDateString("es-CO")}`, 14, 22);
    const rows = pedidosDet.map((p) => [
      p.codigo, formatearFecha(p.createdAt), p.cliente, p.barrio, p.localNombre,
      p.repartidorNombre, formatMoney(p.precio), formatMoney(p.pagoRepartidor),
      formatMoney(p.empresaRecibe), p.estado,
    ]);
    (doc as any).autoTable({
      startY: 28,
      head: [["Código", "Fecha", "Cliente", "Barrio", "Local", "Repartidor", "Tarifa", "Pago Rep.", "Empresa", "Estado"]],
      body: rows,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [250, 204, 21] },
    });
    doc.save(`DomiU_Pedidos_${new Date().toISOString().split("T")[0]}.pdf`);
    ok("PDF descargado.");
  };

  /* ======================== CRUD REPARTIDORES ======================== */

  const guardarRepartidor = async (e: FormEvent) => {
    e.preventDefault();
    if (!repNombre.trim()) { fail("Nombre obligatorio."); return; }
    try {
      const payload: any = { nombre: repNombre.trim(), telefono: repTelefono.trim(), vehiculo: repVehiculo.trim() || null, placa: repPlaca.trim() || null, documento: repDocumento.trim() || null };
      if (repEditId) {
        const { error: e2 } = await supabase.from("repartidores").update(payload).eq("id", repEditId);
        if (e2) throw e2;
        ok("Repartidor actualizado."); setRepEditId(null);
      } else {
        payload.estado = "Disponible";
        payload.activo = true;
        payload.user_id = user?.id;
        const { error: e2 } = await supabase.from("repartidores").insert(payload);
        if (e2) throw e2;
        ok("Repartidor creado.");
      }
      setRepNombre(""); setRepTelefono(""); setRepVehiculo(""); setRepPlaca(""); setRepDocumento(""); loadData();
    } catch (e: any) { fail("Error: " + (e.message || "")); }
  };

  const eliminarRepartidor = async (id: string) => {
    if (!confirm("¿Desactivar este repartidor?")) return;
    const { error: e2 } = await supabase.from("repartidores").update({ activo: false }).eq("id", id);
    if (e2) { fail(e2.message); return; }
    ok("Repartidor desactivado."); loadData();
  };

  /* ======================== CRUD LOCALES ======================== */

  const guardarLocal = async (e: FormEvent) => {
    e.preventDefault();
    if (!locNombre.trim()) { fail("Nombre obligatorio."); return; }
    try {
      if (locEditId) {
        const { error: e2 } = await supabase.from("locales").update({ nombre: locNombre.trim(), direccion: locDireccion.trim(), telefono: locTelefono.trim() }).eq("id", locEditId);
        if (e2) throw e2;
        ok("Local actualizado."); setLocEditId(null);
      } else {
        const { error: e2 } = await supabase.from("locales").insert({ nombre: locNombre.trim(), direccion: locDireccion.trim(), telefono: locTelefono.trim(), user_id: user?.id });
        if (e2) throw e2;
        ok("Local creado.");
      }
      setLocNombre(""); setLocDireccion(""); setLocTelefono(""); loadData();
    } catch (e: any) { fail("Error: " + (e.message || "")); }
  };

  const eliminarLocal = async (id: string) => {
    if (!confirm("¿Desactivar este local?")) return;
    const { error: e2 } = await supabase.from("locales").update({ activo: false }).eq("id", id);
    if (e2) { fail(e2.message); return; }
    ok("Local desactivado."); loadData();
  };

  /* ======================== LIQUIDACIÓN ======================== */

  const liquidarRepartidor = async (repId: string) => {
    const { error: e2 } = await supabase.from("pedidos").update({ liquidado: true }).eq("repartidor_id", repId).eq("estado", "Entregado").eq("liquidado", false);
    if (e2) { fail(e2.message); return; }
    ok("Repartidor liquidado."); loadData();
  };

  /* ======================== CONFIG ======================== */

  const guardarConfig = async (e: FormEvent) => {
    e.preventDefault();
    if (!configTarifaBase.trim() || !configCostoPorKm.trim() || !configPorcentajeRep.trim()) { fail("Todos los campos son obligatorios."); return; }
    const payload: any = {
      tarifa_base: Number(configTarifaBase), costo_por_km: Number(configCostoPorKm),
      porcentaje_repartidor: Number(configPorcentajeRep), whatsapp_number: configWhatsapp.trim(),
      company_name: configCompanyName.trim(),
    };
    try {
      if (appConfig?.id) {
        const { error: e2 } = await supabase.from("app_config").update(payload).eq("id", appConfig.id);
        if (e2) throw e2;
        ok("Configuración actualizada.");
      } else {
        payload.user_id = user?.id;
        const { error: e2 } = await supabase.from("app_config").insert(payload);
        if (e2) throw e2;
        ok("Configuración guardada.");
      }
      loadData();
    } catch (e: any) { fail("Error: " + (e.message || "")); }
  };

  /* ======================== DATOS COMPUTADOS ======================== */

  const pedidosDet = useMemo(() => pedidos.filter((p) => !p.cancelado).map((p) => ({
    ...p,
    localNombre: locales.find((l) => l.id === p.localId)?.nombre || "Sin local",
    repartidorNombre: repartidores.find((r) => r.id === p.repartidorId)?.nombre || "Sin asignar",
  })), [pedidos, locales, repartidores]);

  const pedidosFiltrados = useMemo(() => {
    let r = pedidosDet;
    if (filtroEstado) r = r.filter((p) => p.estado === filtroEstado);
    if (filtroBusqueda) { const q = filtroBusqueda.toLowerCase(); r = r.filter((p) => p.cliente.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q) || p.barrio.toLowerCase().includes(q)); }
    return r;
  }, [pedidosDet, filtroEstado, filtroBusqueda]);

  const totalPaginas = Math.max(1, Math.ceil(pedidosFiltrados.length / ITEMS_PER_PAGE));
  const pedidosPagina = pedidosFiltrados.slice((pagina - 1) * ITEMS_PER_PAGE, pagina * ITEMS_PER_PAGE);

  useEffect(() => { setPagina(1); }, [filtroEstado, filtroBusqueda]);

  const liquidacionRep = useMemo(() => repartidores.map((rep) => {
    const ent = pedidos.filter((p) => p.repartidorId === rep.id && p.estado === "Entregado");
    return {
      rep, pedidos: ent.length,
      debeEmpresa: ent.reduce((s, p) => s + p.empresaRecibe, 0),
      ganancia: ent.reduce((s, p) => s + p.pagoRepartidor, 0),
      liquidado: ent.length > 0 && ent.every((p) => p.liquidado),
    };
  }), [pedidos, repartidores]);

  const tarifasPreview = km ? calcularTarifas(Number(km)) : null;

  const repartidoresDisponibles = useMemo(() => repartidores.filter((r) => r.estado === "Disponible"), [repartidores]);

  /* ======================== RENDER ======================== */

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#02060d" }}><p style={{ color: "#94a3b8" }}>Cargando...</p></div>;
  if (!user) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#02060d" }}><p style={{ color: "#94a3b8" }}>No hay sesión activa.</p></div>;

  return (
    <main style={pageStyle}>
      <aside style={sidebarStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 28, fontWeight: 900, color: "#f8fafc" }}>
            <span style={{ display: "inline-flex", width: 40, height: 40, borderRadius: 14, background: "#fbbf24", color: "#0f172a", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏍️</span>
            <span>Domi</span><span style={{ color: "#f59e0b" }}>U</span>
          </div>
          <p style={{ marginTop: 12, color: "#94a3b8", fontSize: 14 }}>{appConfig?.companyName || "Magdalena"}</p>
          {turnoActivo && <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 12, background: "#10b98122", border: "1px solid #10b98144", color: "#10b981", fontSize: 12, fontWeight: 700 }}>🟢 Turno activo</div>}
          {!turnoActivo && <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 12, background: "#f59e0b22", border: "1px solid #f59e0b44", color: "#f59e0b", fontSize: 12, fontWeight: 700 }}>🟡 Sin turno abierto</div>}
        </div>
        <nav style={{ display: "grid", gap: 8 }}>
          {([
            { key: "panel", label: "Panel", icon: "📊" },
            { key: "nuevo-pedido", label: "Crear Pedido", icon: "➕" },
            { key: "pedidos", label: "Pedidos", icon: "📦" },
            { key: "repartidores", label: "Repartidores", icon: "🚴" },
            { key: "locales", label: "Locales", icon: "🏠" },
            { key: "liquidacion", label: "Liquidaciones", icon: "💰" },
            { key: "turnos", label: "Turnos", icon: "⏰" },
            { key: "config", label: "Configuración", icon: "⚙️" },
          ] as const).map((item) => (
            <button key={item.key} type="button" style={{
              width: "100%", padding: "14px 18px", borderRadius: 16,
              border: tab === item.key ? "1px solid #facc15" : "1px solid rgba(255,255,255,0.08)",
              background: tab === item.key ? "#111827" : "rgba(255,255,255,0.03)",
              color: tab === item.key ? "#ffffff" : "#cbd5e1",
              textAlign: "left", cursor: "pointer", fontSize: 15, fontWeight: 600,
              boxShadow: tab === item.key ? "0 10px 30px rgba(250,204,21,0.18)" : "none",
            }} onClick={() => setTab(item.key)}>
              <span style={{ display: "inline-flex", width: 22, justifyContent: "center", marginRight: 10 }}>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "16px 0 0", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>{user.email}</p>
          <p style={{ color: "#64748b", fontSize: 11, margin: "4px 0 0" }}>{currentTime}</p>
        </div>
      </aside>

      <section style={{ flex: 1, padding: 32, overflowY: "auto", background: "#060b17" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 36, fontWeight: 900, color: "#f8fafc" }}>{fechaHoy}</h1>
          <span style={{ color: "#94a3b8", fontSize: 14 }}>{currentTime}</span>
        </div>

        {mensaje && <div style={toastOk}>{mensaje}</div>}
        {error && <div style={toastErr}>{error}</div>}

        {/* PANEL */}
        {tab === "panel" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 18, marginBottom: 28 }}>
              <MetricCard label="TOTAL DEL TURNO" value={formatMoney(pedidosDet.reduce((s, p) => s + p.precio, 0))} footnote={`${pedidosDet.length} pedidos`} />
              <MetricCard label="EMPRESA RECIBE" value={formatMoney(pedidosDet.reduce((s, p) => s + p.empresaRecibe, 0))} footnote={`${pedidosDet.length > 0 ? Math.round((pedidosDet.reduce((s, p) => s + p.empresaRecibe, 0) / Math.max(pedidosDet.reduce((s, p) => s + p.precio, 0), 1)) * 100) : 0}%`} />
              <MetricCard label="POR LIQUIDAR" value={formatMoney(pedidos.filter((p) => p.estado === "Entregado" && !p.liquidado).reduce((s, p) => s + p.empresaRecibe, 0))} footnote={`${pedidos.filter((p) => p.estado === "Entregado" && !p.liquidado).length} pedidos`} />
              <MetricCard label="LIQUIDADO" value={formatMoney(pedidos.filter((p) => p.estado === "Entregado" && p.liquidado).reduce((s, p) => s + p.empresaRecibe, 0))} footnote={`${pedidos.filter((p) => p.estado === "Entregado" && p.liquidado).length} pedidos`} />
              <MetricCard label="ENTREGADOS" value={String(pedidos.filter((p) => p.estado === "Entregado").length)} footnote={`${pedidos.length} total`} />
              <MetricCard label="CANCELADOS" value={String(pedidos.filter((p) => p.cancelado).length)} footnote={`${pedidos.filter((p) => p.cancelado).length} pedidos`} />
            </div>

            {/* Repartidores en tiempo real */}
            <div style={panelCard}>
              <h2 style={sectionTitle}>Repartidores Disponibles</h2>
              {repartidores.length === 0 ? <p style={{ color: "#64748b", textAlign: "center", padding: 24 }}>No hay repartidores registrados.</p> :
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                  {repartidores.map((rep) => (
                    <div key={rep.id} style={{ ...miniCard, marginBottom: 0 }}>
                      <div>
                        <strong style={{ color: "#f8fafc" }}>{rep.nombre}</strong>
                        <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 13 }}>{rep.telefono || "Sin teléfono"}</p>
                        {rep.vehiculo && <p style={{ margin: "2px 0 0", color: "#64748b", fontSize: 12 }}>{rep.vehiculo} {rep.placa ? `(${rep.placa})` : ""}</p>}
                      </div>
                      <span style={riderEstadoColor(rep.estado)}>{rep.estado}</span>
                    </div>
                  ))}
                </div>
              }
            </div>

            {liquidacionRep.length > 0 && (
              <div style={panelCard}>
                <h2 style={sectionTitle}>Liquidación por repartidor</h2>
                <table style={tableStyle}>
                  <thead><tr><th style={thStyle}>Repartidor</th><th style={thStyle}>Pedidos</th><th style={thStyle}>Empresa recibe</th><th style={thStyle}>Ganancia</th><th style={thStyle}>Estado</th></tr></thead>
                  <tbody>
                    {liquidacionRep.map((item) => (
                      <tr key={item.rep.id}><td style={tdStyle}>{item.rep.nombre}</td><td style={tdStyle}>{item.pedidos}</td><td style={tdStyle}>{formatMoney(item.debeEmpresa)}</td><td style={tdStyle}>{formatMoney(item.ganancia)}</td><td style={tdStyle}><span style={item.liquidado ? pillGreen : pillYellow}>{item.liquidado ? "Liquidado" : "Pendiente"}</span></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* CREAR PEDIDO */}
        {tab === "nuevo-pedido" && (
          <div style={panelCard}>
            <h2 style={sectionTitle}>{pedidoIdEditar ? "Editar pedido" : "Crear pedido"}</h2>
            <div style={{ ...miniCard, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelStyle, marginBottom: 8 }}>📋 Pegar texto para extraer datos</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 80, resize: "vertical", fontFamily: "monospace", fontSize: 13 }}
                  placeholder={"Pegue aquí el texto del pedido. Ejemplo:\nCliente: Juan Pérez\nTeléfono: 3001234567\nDirección: Calle 123 #45-67\nBarrio: Centro"}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
                <button type="button" style={{ ...smallBtn, marginTop: 8 }} onClick={parsePasteText}>Extraer datos</button>
              </div>
            </div>
            <form onSubmit={guardarPedido} style={{ display: "grid", gap: 16 }}>
              <label style={labelStyle}>Cliente *<input style={inputStyle} placeholder="Nombre del cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} required /></label>
              <label style={labelStyle}>Teléfono<input style={inputStyle} placeholder="3001234567" value={telefono} onChange={(e) => setTelefono(e.target.value)} type="tel" /></label>
              <label style={labelStyle}>Dirección *<input style={inputStyle} placeholder="Dirección de entrega" value={direccion} onChange={(e) => setDireccion(e.target.value)} ref={direccionInputRef} required /></label>
              {addressSuggestions.length > 0 && (
                <div style={suggestionList}>
                  {addressSuggestions.map((item) => (
                    <button key={item.id} type="button" style={suggestionItem} onClick={() => {
                      setDireccion(item.direccion); setBarrio(item.barrio); setKm(String(item.km));
                      setTiempoMin(item.tiempoMin); setEnvio(String(item.envio)); setAddressSuggestions([]);
                    }}>{item.direccion} · {item.barrio}</button>
                  ))}
                </div>
              )}
              <label style={labelStyle}>Barrio<input style={inputStyle} placeholder="Barrio" value={barrio} onChange={(e) => setBarrio(e.target.value)} /></label>
              <label style={labelStyle}>Notas / Observaciones<input style={inputStyle} placeholder="Instrucciones especiales (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} /></label>
              <label style={labelStyle}>Local
                <select style={inputStyle} value={localId} onChange={(e) => setLocalId(e.target.value)}>
                  <option value="">Selecciona local</option>
                  {locales.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </label>
              <label style={labelStyle}>Repartidor (solo disponibles)
                <select style={inputStyle} value={repartidorId} onChange={(e) => setRepartidorId(e.target.value)}>
                  <option value="">Sin asignar</option>
                  {repartidoresDisponibles.map((r) => <option key={r.id} value={r.id}>{r.nombre} ✅ {r.telefono}</option>)}
                  {repartidores.filter((r) => r.estado !== "Disponible").map((r) => (
                    <option key={r.id} value={r.id} disabled>{r.nombre} ({r.estado})</option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>Kilómetros *<input style={inputStyle} placeholder="Distancia en km" type="number" min="0.1" step="0.1" value={km} onChange={(e) => setKm(e.target.value)} required /></label>
              <label style={labelStyle}>Precio manual (opcional)<input style={inputStyle} placeholder="Dejar vacío para tarifa automática según km" type="number" min="0" value={precioManual} onChange={(e) => setPrecioManual(e.target.value)} /></label>
              <div style={infoBox}>
                {tarifasPreview && !precioManual.trim() && (
                  <>
                    <p><strong>Tarifa automática: {formatMoney(tarifasPreview.precio)}</strong> ({km} km)</p>
                    <p style={{ color: "#10b981" }}>Repartidor: {formatMoney(tarifasPreview.pagoRepartidor)}</p>
                    <p style={{ color: "#facc15" }}>Empresa: {formatMoney(tarifasPreview.empresaRecibe)}</p>
                  </>
                )}
                {precioManual.trim() && Number(precioManual) > 0 && (
                  <><p><strong>Precio manual: {formatMoney(Number(precioManual))}</strong></p>
                  {Number(precioManual) > 8000 && <p>Split 60/40 → Rep: {formatMoney(Math.round(Number(precioManual) * 0.6))} / Emp: {formatMoney(Math.round(Number(precioManual) * 0.4))}</p>}</>
                )}
                <p>Tiempo: {tiempoMin ? `${tiempoMin} min` : "Pendiente"}</p>
                <p>Envío: {envio ? formatMoney(Number(envio)) : "Pendiente"}</p>
                {distanceLoading && <p>Calculando ruta...</p>}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" style={primaryBtn}>{pedidoIdEditar ? "Actualizar pedido" : "Guardar pedido"}</button>
                {pedidoIdEditar && <button type="button" style={{ ...smallBtn, padding: "16px 24px", borderRadius: 20 }} onClick={() => { setPedidoIdEditar(null); }}>Cancelar</button>}
              </div>
            </form>
          </div>
        )}

        {/* PEDIDOS */}
        {tab === "pedidos" && (
          <div style={panelCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ ...sectionTitle, margin: 0 }}>Pedidos ({pedidosFiltrados.length})</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={smallBtn} onClick={exportToExcel}>📥 Excel</button>
                <button type="button" style={smallBtn} onClick={exportToPDF}>📥 PDF</button>
              </div>
            </div>
            <div style={filtersStyle}>
              <input style={{ ...inputStyle, flex: 1 }} placeholder="Buscar por cliente, código, barrio..." value={filtroBusqueda} onChange={(e) => setFiltroBusqueda(e.target.value)} />
              <select style={{ ...inputStyle, width: 180 }} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="">Todos los estados</option>
                {ESTADOS_PEDIDO.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Código</th><th style={thStyle}>Cliente</th><th style={thStyle}>Barrio</th>
                    <th style={thStyle}>Local</th><th style={thStyle}>Repartidor</th><th style={thStyle}>Precio</th>
                    <th style={thStyle}>Repartidor</th><th style={thStyle}>Empresa</th><th style={thStyle}>Estado</th>
                    <th style={thStyle}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosPagina.map((p) => (
                    <tr key={p.id}>
                      <td style={tdStyle}>{p.codigo}</td><td style={tdStyle}>{p.cliente}</td><td style={tdStyle}>{p.barrio}</td>
                      <td style={tdStyle}>{p.localNombre}</td><td style={tdStyle}>{p.repartidorNombre}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{formatMoney(p.precio)}</td>
                      <td style={{ ...tdStyle, color: "#10b981" }}>{formatMoney(p.pagoRepartidor)}</td>
                      <td style={{ ...tdStyle, color: "#facc15" }}>{formatMoney(p.empresaRecibe)}</td>
                      <td style={tdStyle}>
                        <select style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "#09111d", color: "#f8fafc", fontSize: 13 }} value={p.estado} onChange={(e) => cambiarEstado(p.id, e.target.value)}>
                          {ESTADOS_PEDIDO.map((e) => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </td>
                      <td style={{ ...actionsCell, ...tdStyle }}>
                        <button type="button" style={smallBtn} onClick={() => editarPedido(p)}>Editar</button>
                        <button type="button" style={smallBtn} onClick={() => copiarEmpresa(p)}>Copiar</button>
                        <button type="button" style={smallBtn} onClick={() => enviarWhatsAppEmpresa(p)}>WA emp.</button>
                        <button type="button" style={smallBtn} onClick={() => enviarWhatsAppRepartidor(p)}>WA rep.</button>
                        <button type="button" style={smallBtn} onClick={() => enviarWhatsAppCliente(p)}>WA cliente</button>
                        <button type="button" style={smallBtn} onClick={() => { setCancelarId(p.id); setCancelarRazon(""); }}>Cancelar</button>
                        <button type="button" style={deleteBtn} onClick={() => eliminarPedido(p.id)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                  {pedidosPagina.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center", padding: 32, color: "#64748b" }}>No hay pedidos.</td></tr>}
                </tbody>
              </table>
            </div>
            {totalPaginas > 1 && (
              <div style={paginationStyle}>
                <button type="button" style={{ ...smallBtn, opacity: pagina === 1 ? 0.5 : 1 }} disabled={pagina === 1} onClick={() => setPagina((p) => Math.max(1, p - 1))}>← Anterior</button>
                <span style={{ color: "#cbd5e1", fontSize: 14 }}>Página {pagina} de {totalPaginas}</span>
                <button type="button" style={{ ...smallBtn, opacity: pagina === totalPaginas ? 0.5 : 1 }} disabled={pagina === totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}>Siguiente →</button>
              </div>
            )}
          </div>
        )}

        {/* MODAL CANCELAR */}
        {cancelarId && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
            <div style={{ background: "#0f172a", borderRadius: 24, padding: 32, border: "1px solid rgba(255,255,255,0.1)", maxWidth: 420, width: "90%" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 800, color: "#f8fafc" }}>Cancelar pedido</h3>
              <p style={{ color: "#94a3b8", margin: "0 0 16px", fontSize: 14 }}>Pedido: <strong style={{ color: "#facc15" }}>{pedidos.find((p) => p.id === cancelarId)?.codigo}</strong></p>
              <label style={{ ...labelStyle, marginBottom: 16 }}>Motivo de cancelación *<textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical", fontSize: 14 }} placeholder="Ej: Cliente canceló, dirección incorrecta..." value={cancelarRazon} onChange={(e) => setCancelarRazon(e.target.value)} /></label>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="button" style={{ ...primaryBtn, background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", color: "#fff" }} onClick={cancelarPedido}>Confirmar cancelación</button>
                <button type="button" style={{ ...smallBtn, padding: "16px 24px", borderRadius: 20 }} onClick={() => { setCancelarId(null); setCancelarRazon(""); }}>Volver</button>
              </div>
            </div>
          </div>
        )}

        {/* REPARTIDORES */}
        {tab === "repartidores" && (
          <div style={panelCard}>
            <h2 style={sectionTitle}>Repartidores</h2>
            <form onSubmit={guardarRepartidor} style={{ display: "grid", gap: 16, marginBottom: 24 }}>
              <label style={labelStyle}>Nombre *<input style={inputStyle} placeholder="Nombre completo" value={repNombre} onChange={(e) => setRepNombre(e.target.value)} required /></label>
              <label style={labelStyle}>Teléfono<input style={inputStyle} placeholder="3001234567" value={repTelefono} onChange={(e) => setRepTelefono(e.target.value)} type="tel" /></label>
              <label style={labelStyle}>Vehículo<input style={inputStyle} placeholder="Moto, bicicleta, carro..." value={repVehiculo} onChange={(e) => setRepVehiculo(e.target.value)} /></label>
              <label style={labelStyle}>Placa<input style={inputStyle} placeholder="ABC123" value={repPlaca} onChange={(e) => setRepPlaca(e.target.value)} /></label>
              <label style={labelStyle}>Documento<input style={inputStyle} placeholder="Cédula" value={repDocumento} onChange={(e) => setRepDocumento(e.target.value)} /></label>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" style={primaryBtn}>{repEditId ? "Actualizar" : "Crear repartidor"}</button>
                {repEditId && <button type="button" style={{ ...smallBtn, padding: "16px 24px", borderRadius: 20 }} onClick={() => { setRepEditId(null); setRepNombre(""); setRepTelefono(""); setRepVehiculo(""); setRepPlaca(""); setRepDocumento(""); }}>Cancelar</button>}
              </div>
            </form>
            {repartidores.map((rep) => (
              <div key={rep.id} style={miniCard}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ color: "#f8fafc" }}>{rep.nombre}</strong>
                    <span style={riderEstadoColor(rep.estado)}>{rep.estado}</span>
                  </div>
                  <p style={{ margin: "4px 0 0", color: "#94a3b8" }}>{rep.telefono || "Sin teléfono"}</p>
                  {rep.vehiculo && <p style={{ margin: "2px 0 0", color: "#64748b", fontSize: 13 }}>{rep.vehiculo} {rep.placa ? `(${rep.placa})` : ""}</p>}
                  {rep.documento && <p style={{ margin: "2px 0 0", color: "#64748b", fontSize: 13 }}>CC: {rep.documento}</p>}
                </div>
                <div style={actionsCell}>
                  <button type="button" style={smallBtn} onClick={() => { setRepEditId(rep.id); setRepNombre(rep.nombre); setRepTelefono(rep.telefono); setRepVehiculo(rep.vehiculo); setRepPlaca(rep.placa); setRepDocumento(rep.documento); }}>Editar</button>
                  <button type="button" style={deleteBtn} onClick={() => eliminarRepartidor(rep.id)}>Desactivar</button>
                </div>
              </div>
            ))}
            {repartidores.length === 0 && <p style={{ color: "#64748b", textAlign: "center", padding: 24 }}>No hay repartidores. Crea uno arriba.</p>}
          </div>
        )}

        {/* LOCALES */}
        {tab === "locales" && (
          <div style={panelCard}>
            <h2 style={sectionTitle}>Locales</h2>
            <form onSubmit={guardarLocal} style={{ display: "grid", gap: 16, marginBottom: 24 }}>
              <label style={labelStyle}>Nombre *<input style={inputStyle} placeholder="Nombre del local" value={locNombre} onChange={(e) => setLocNombre(e.target.value)} required /></label>
              <label style={labelStyle}>Dirección<input style={inputStyle} placeholder="Dirección" value={locDireccion} onChange={(e) => setLocDireccion(e.target.value)} /></label>
              <label style={labelStyle}>Teléfono<input style={inputStyle} placeholder="6012345678" value={locTelefono} onChange={(e) => setLocTelefono(e.target.value)} type="tel" /></label>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" style={primaryBtn}>{locEditId ? "Actualizar" : "Crear local"}</button>
                {locEditId && <button type="button" style={{ ...smallBtn, padding: "16px 24px", borderRadius: 20 }} onClick={() => { setLocEditId(null); setLocNombre(""); setLocDireccion(""); setLocTelefono(""); }}>Cancelar</button>}
              </div>
            </form>
            {locales.map((loc) => (
              <div key={loc.id} style={miniCard}>
                <div><strong style={{ color: "#f8fafc" }}>{loc.nombre}</strong><p style={{ margin: "4px 0 0", color: "#94a3b8" }}>{loc.direccion || "Sin dirección"}</p><p style={{ margin: "4px 0 0", color: "#94a3b8" }}>{loc.telefono || "Sin teléfono"}</p></div>
                <div style={actionsCell}>
                  <button type="button" style={smallBtn} onClick={() => { setLocEditId(loc.id); setLocNombre(loc.nombre); setLocDireccion(loc.direccion); setLocTelefono(loc.telefono); }}>Editar</button>
                  <button type="button" style={deleteBtn} onClick={() => eliminarLocal(loc.id)}>Desactivar</button>
                </div>
              </div>
            ))}
            {locales.length === 0 && <p style={{ color: "#64748b", textAlign: "center", padding: 24 }}>No hay locales. Crea uno arriba.</p>}
          </div>
        )}

        {/* LIQUIDACIÓN */}
        {tab === "liquidacion" && (
          <div style={panelCard}>
            <h2 style={sectionTitle}>Liquidación por repartidor</h2>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>Repartidor</th><th style={thStyle}>Entregados</th><th style={thStyle}>Empresa recibe</th><th style={thStyle}>Ganancia repartidor</th><th style={thStyle}>Liquidado</th><th style={thStyle}>Acción</th></tr></thead>
              <tbody>
                {liquidacionRep.map((item) => (
                  <tr key={item.rep.id}>
                    <td style={tdStyle}>{item.rep.nombre}</td><td style={tdStyle}>{item.pedidos}</td><td style={tdStyle}>{formatMoney(item.debeEmpresa)}</td>
                    <td style={{ ...tdStyle, color: "#10b981", fontWeight: 700 }}>{formatMoney(item.ganancia)}</td>
                    <td style={tdStyle}><span style={item.liquidado ? pillGreen : pillYellow}>{item.liquidado ? "Sí" : "No"}</span></td>
                    <td style={tdStyle}><button type="button" style={smallBtn} onClick={() => liquidarRepartidor(item.rep.id)} disabled={item.liquidado}>Liquidar</button></td>
                  </tr>
                ))}
                {liquidacionRep.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "#64748b" }}>No hay datos de liquidación aún.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* TURNOS */}
        {tab === "turnos" && (
          <div style={panelCard}>
            <h2 style={sectionTitle}>Gestión de Turnos</h2>
            {!turnoActivo && (
              <div style={{ ...miniCard, marginBottom: 20, flexDirection: "column", alignItems: "stretch" }}>
                <p style={{ margin: "0 0 12px", color: "#94a3b8" }}>No hay turno activo. Abre uno para comenzar.</p>
                <label style={{ ...labelStyle, marginBottom: 12 }}>Notas del turno (opcional)<input style={inputStyle} placeholder="Ej: Turno mañana, conductor Juan..." value={turnoNotas} onChange={(e) => setTurnoNotas(e.target.value)} /></label>
                <button type="button" style={primaryBtn} onClick={abrirTurno}>Abrir turno</button>
              </div>
            )}
            {turnoActivo && (
              <div style={{ ...miniCard, marginBottom: 20, flexDirection: "column", alignItems: "stretch" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ color: "#10b981", fontWeight: 700 }}>🟢 Turno en curso</span>
                  <button type="button" style={{ ...smallBtn, border: "1px solid #ef4444", color: "#fecaca" }} onClick={() => cerrarTurno(turnoActivo.id)}>Cerrar turno</button>
                </div>
                <p style={{ color: "#94a3b8", fontSize: 14 }}>Abierto: {new Date(turnoActivo.openedAt).toLocaleString("es-CO")}</p>
                {turnoActivo.notas && <p style={{ color: "#cbd5e1", fontSize: 14 }}>Notas: {turnoActivo.notas}</p>}
                <p style={{ color: "#facc15", fontSize: 14, marginTop: 4 }}>{pedidos.filter((p) => p.turnoId === turnoActivo.id).length} pedidos en este turno</p>
              </div>
            )}

            <h3 style={{ margin: "24px 0 12px", fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>Historial de turnos</h3>
            {turnos.length === 0 ? <p style={{ color: "#64748b", textAlign: "center", padding: 24 }}>No hay turnos registrados.</p> :
              <div style={{ display: "grid", gap: 8 }}>
                {turnos.map((t) => {
                  const pedidosTurno = pedidos.filter((p) => p.turnoId === t.id);
                  const totalTurno = pedidosTurno.reduce((s, p) => s + p.precio, 0);
                  return (
                    <div key={t.id} style={{ ...miniCard, opacity: t.activo ? 1 : 0.6 }}>
                      <div>
                        <strong style={{ color: "#f8fafc" }}>{t.activo ? "🟢 Activo" : "⚫ Cerrado"} - {new Date(t.openedAt).toLocaleDateString("es-CO")}</strong>
                        <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 13 }}>Abierto: {new Date(t.openedAt).toLocaleTimeString("es-CO")}{t.closedAt ? ` → Cerrado: ${new Date(t.closedAt).toLocaleTimeString("es-CO")}` : ""}</p>
                        {t.notas && <p style={{ margin: "2px 0 0", color: "#64748b", fontSize: 12 }}>{t.notas}</p>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ margin: 0, color: "#facc15", fontWeight: 700 }}>{formatMoney(totalTurno)}</p>
                        <p style={{ margin: "2px 0 0", color: "#94a3b8", fontSize: 12 }}>{pedidosTurno.length} pedidos</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            }
          </div>
        )}

        {/* CONFIGURACIÓN */}
        {tab === "config" && (
          <div style={panelCard}>
            <h2 style={sectionTitle}>Configuración de la empresa</h2>
            <form onSubmit={guardarConfig} style={{ display: "grid", gap: 16 }}>
              <label style={labelStyle}>Nombre de la empresa<input style={inputStyle} placeholder="DomiU Magdalena" value={configCompanyName} onChange={(e) => setConfigCompanyName(e.target.value)} /></label>
              <label style={labelStyle}>Número de WhatsApp (sin el 57)<input style={inputStyle} placeholder="3001234567" value={configWhatsapp} onChange={(e) => setConfigWhatsapp(e.target.value)} /></label>
              <label style={labelStyle}>Tarifa base (envío mínimo)<input style={inputStyle} placeholder="2500" type="number" value={configTarifaBase} onChange={(e) => setConfigTarifaBase(e.target.value)} /></label>
              <label style={labelStyle}>Costo por km<input style={inputStyle} placeholder="1200" type="number" value={configCostoPorKm} onChange={(e) => setConfigCostoPorKm(e.target.value)} /></label>
              <label style={labelStyle}>Porcentaje repartidor (%)<input style={inputStyle} placeholder="55" type="number" min="0" max="100" value={configPorcentajeRep} onChange={(e) => setConfigPorcentajeRep(e.target.value)} /></label>
              <div style={infoBox}>
                <p><strong>Nota:</strong> La tarifa base y costo por km se usan para calcular el envío: <code>max(tarifaBase, km * costoPorKm)</code></p>
                <p>El porcentaje del repartidor se aplica a tarifas superiores a $8.000 (split 60/40 predeterminado).</p>
                <p><strong>WhatsApp:</strong> El número se usa para enviar pedidos pre-llenados vía wa.me/57{configWhatsapp || "NUMERO"}</p>
              </div>
              <button type="submit" style={primaryBtn}>Guardar configuración</button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
