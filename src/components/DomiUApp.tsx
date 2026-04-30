"use client";

import { useState, useEffect, useMemo, useCallback, useRef, FormEvent, CSSProperties } from "react";
import { supabase } from "@/lib/supabase";

type Tab = "panel" | "nuevo-pedido" | "pedidos" | "repartidores" | "locales" | "liquidacion" | "config";

type Pedido = {
  id: string;
  codigo: string;
  cliente: string;
  telefono: string;
  direccion: string;
  barrio: string;
  localId: string;
  repartidorId: string | null;
  km: number;
  envio: number;
  precio: number;
  pagoRepartidor: number;
  empresaRecibe: number;
  estado: "Pendiente" | "Asignado" | "Recibido" | "Entregado";
  liquidado: boolean;
  createdAt: string;
  tiempoMin: number;
};

type Repartidor = {
  id: string;
  nombre: string;
  telefono: string;
};

type Local = {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
};

type AddressRecord = {
  id: string;
  cliente: string;
  direccion: string;
  barrio: string;
  km: number;
  tiempoMin: number;
  envio: number;
};

const estadosPedido = ["Pendiente", "Asignado", "Recibido", "Entregado"] as const;
const ITEMS_PER_PAGE = 15;

/* ======================== TARIFAS REALES ======================== */

function calcularPrecioPorKm(km: number): { precio: number; pagoRepartidor: number; empresaRecibe: number } {
  if (km <= 2) {
    return { precio: 5000, pagoRepartidor: 3800, empresaRecibe: 1200 };
  }
  if (km <= 3) {
    return { precio: 6000, pagoRepartidor: 4500, empresaRecibe: 1500 };
  }
  if (km <= 5) {
    return { precio: 7000, pagoRepartidor: 5200, empresaRecibe: 1800 };
  }
  const kmExtra = km - 5;
  const tramosExtra = Math.ceil(kmExtra / 2);
  const precio = 8000 + tramosExtra * 2000;
  const empresaRecibe = 2000 + tramosExtra * 500;
  const pagoRepartidor = precio - empresaRecibe;
  return { precio, pagoRepartidor, empresaRecibe };
}

function calcularEnvio(km: number) {
  const tarifaBase = 2500;
  const costoPorKm = 1200;
  return Math.max(tarifaBase, Math.round(km * costoPorKm));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function generarCodigo(total: number) {
  return `DOM-${String(total + 1).padStart(3, "0")}`;
}

/* ======================== ESTILOS ======================== */

const pageStyle: CSSProperties = { display: "flex", minHeight: "100vh", background: "#02060d", color: "#cbd5e1", fontFamily: "'Inter', system-ui, sans-serif" };
const sidebarStyle: CSSProperties = { width: 300, padding: 32, background: "#09101c", borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", justifyContent: "space-between" };
const brandStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, fontSize: 28, fontWeight: 900, color: "#f8fafc" };
const brandIconStyle: CSSProperties = { display: "inline-flex", width: 40, height: 40, borderRadius: 14, background: "#fbbf24", color: "#0f172a", alignItems: "center", justifyContent: "center", fontSize: 18 };
const navStyle: CSSProperties = { display: "grid", gap: 12 };
const inputStyle: CSSProperties = { width: "100%", padding: "16px 20px", borderRadius: 18, border: "1px solid rgba(255,255,255,0.12)", background: "#09111d", color: "#f8fafc", fontSize: 16, boxSizing: "border-box" as const };
const primaryBtn: CSSProperties = { padding: "16px 24px", borderRadius: 20, border: "none", background: "linear-gradient(135deg, #facc15 0%, #f59e0b 100%)", color: "#0f172a", fontWeight: 700, fontSize: 16, cursor: "pointer" };
const smallBtn: CSSProperties = { padding: "10px 14px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#f8fafc", cursor: "pointer", fontSize: 13, fontWeight: 600 };
const deleteBtn: CSSProperties = { ...smallBtn, border: "1px solid #ef4444", color: "#fecaca" };
const panelCard: CSSProperties = { background: "#0f172a", borderRadius: 24, padding: 32, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 24 };
const sectionTitle: CSSProperties = { margin: "0 0 24px", fontSize: 24, fontWeight: 800, color: "#f8fafc" };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse" as const, color: "#cbd5e1", fontSize: 14 };
const tableContainer: CSSProperties = { overflowX: "auto" as const };
const toastStyle: CSSProperties = { padding: "16px 20px", borderRadius: 20, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#ffffff", marginBottom: 24, fontWeight: 600 };
const miniCard: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: 20, borderRadius: 20, background: "#0b1221", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 12 };
const pillGreen: CSSProperties = { padding: "8px 16px", borderRadius: 999, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#ffffff", fontSize: 12, fontWeight: 700 };
const pillYellow: CSSProperties = { padding: "8px 16px", borderRadius: 999, background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: "#ffffff", fontSize: 12, fontWeight: 700 };
const suggestionList: CSSProperties = { display: "grid", gap: 8, marginTop: -4, marginBottom: 12, padding: 12, borderRadius: 18, background: "rgba(15,23,42,0.92)", border: "1px solid rgba(255,255,255,0.08)" };
const suggestionItem: CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#f8fafc", textAlign: "left", cursor: "pointer", fontSize: 14 };
const infoBox: CSSProperties = { padding: "16px 18px", borderRadius: 18, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#cbd5e1", display: "grid", gap: 6, fontSize: 14 };
const labelStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 600, color: "#94a3b8" };
const filtersStyle: CSSProperties = { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" as const };
const paginationStyle: CSSProperties = { display: "flex", justifyContent: "center", alignItems: "center", gap: 20, marginTop: 24, padding: "16px 0" };
const actionsCell: CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap" as const, alignItems: "center" };

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
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [repartidores, setRepartidores] = useState<Repartidor[]>([]);
  const [locales, setLocales] = useState<Local[]>([]);
  const [addressHistory, setAddressHistory] = useState<AddressRecord[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");
  const [googleMapsReady, setGoogleMapsReady] = useState(false);

  // Filtros pedidos
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);

  // Form pedido
  const [pedidoIdEditar, setPedidoIdEditar] = useState<string | null>(null);
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [barrio, setBarrio] = useState("");
  const [localId, setLocalId] = useState("");
  const [repartidorId, setRepartidorId] = useState("");
  const [km, setKm] = useState("");
  const [tiempoMin, setTiempoMin] = useState(0);
  const [envio, setEnvio] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressRecord[]>([]);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const direccionInputRef = useRef<HTMLInputElement | null>(null);

  // Form repartidor
  const [repEditId, setRepEditId] = useState<string | null>(null);
  const [repNombre, setRepNombre] = useState("");
  const [repTelefono, setRepTelefono] = useState("");

  // Form local
  const [locEditId, setLocEditId] = useState<string | null>(null);
  const [locNombre, setLocNombre] = useState("");
  const [locDireccion, setLocDireccion] = useState("");
  const [locTelefono, setLocTelefono] = useState("");

  // Liquidacion
  const [liquidarRepId, setLiquidarRepId] = useState<string | null>(null);

  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }));
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: pedidosData }, { data: repartidoresData }, { data: localesData }, { data: addressData }] = await Promise.all([
        supabase.from("pedidos").select("*").order("created_at", { ascending: false }),
        supabase.from("repartidores").select("*").eq("activo", true).order("created_at", { ascending: false }),
        supabase.from("locales").select("*").eq("activo", true).order("created_at", { ascending: false }),
        supabase.from("address_history").select("*").order("created_at", { ascending: false }).limit(50),
      ]);

      if (pedidosData) {
        setPedidos(pedidosData.map((p: any) => ({
          id: p.id, codigo: p.codigo, cliente: p.cliente, telefono: p.telefono,
          direccion: p.direccion, barrio: p.barrio, localId: p.local_id,
          repartidorId: p.repartidor_id, km: Number(p.km), envio: p.envio,
          precio: p.precio, pagoRepartidor: p.pago_repartidor, empresaRecibe: p.empresa_recibe,
          estado: p.estado, liquidado: p.liquidado, createdAt: p.created_at, tiempoMin: p.tiempo_min,
        })));
      }
      if (repartidoresData) setRepartidores(repartidoresData.map((r: any) => ({ id: r.id, nombre: r.nombre, telefono: r.telefono })));
      if (localesData) setLocales(localesData.map((l: any) => ({ id: l.id, nombre: l.nombre, direccion: l.direccion, telefono: l.telefono })));
      if (addressData) setAddressHistory(addressData.map((a: any) => ({
        id: a.id, cliente: a.cliente, direccion: a.direccion, barrio: a.barrio,
        km: Number(a.km), tiempoMin: a.tiempo_min, envio: a.envio,
      })));
    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Google Maps
  useEffect(() => {
    if (typeof window === "undefined") return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;
    if ((window as any).google?.maps) { setGoogleMapsReady(true); return; }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleMapsReady(true);
    script.onerror = () => showMessage("Error al cargar Google Maps.");
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
      const barrioComp = place.address_components?.find((c: any) =>
        c.types.includes("sublocality") || c.types.includes("neighborhood") || c.types.includes("political")
      );
      if (barrioComp?.long_name) setBarrio(barrioComp.long_name);
      setTimeout(calcularRuta, 300);
    });
    return () => g.event.clearInstanceListeners(ac);
  }, [googleMapsReady, locales, localId]);

  const showMessage = useCallback((text: string) => {
    setMensaje(text);
    setTimeout(() => setMensaje(""), 3000);
  }, []);

  const fechaHoy = useMemo(() => new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }), []);

  /* ======================== CALCULAR RUTA ======================== */

  const calcularRuta = useCallback(() => {
    if (typeof window === "undefined" || !localId || !direccion.trim()) return;
    const local = locales.find((l) => l.id === localId);
    if (!local) return;

    const saved = addressHistory.find((h) =>
      h.cliente.trim().toLowerCase() === cliente.trim().toLowerCase() &&
      h.direccion.trim().toLowerCase() === direccion.trim().toLowerCase()
    );
    if (saved) {
      setKm(String(saved.km));
      setTiempoMin(saved.tiempoMin);
      setEnvio(String(saved.envio));
      setBarrio(saved.barrio);
      return;
    }

    const g = (window as any).google?.maps;
    if (!g?.DistanceMatrixService) return;

    setDistanceLoading(true);
    const service = new g.DistanceMatrixService();
    service.getDistanceMatrix({
      origins: [local.direccion],
      destinations: [direccion],
      travelMode: g.TravelMode.DRIVING,
      unitSystem: g.UnitSystem.METRIC,
    }, (response: any, status: string) => {
      setDistanceLoading(false);
      if (status !== "OK") { showMessage("Error con Google Maps. Ingrese km manualmente."); return; }
      const el = response.rows?.[0]?.elements?.[0];
      if (!el || el.status !== "OK") { showMessage("Ruta no encontrada. Ingrese km manualmente."); return; }
      const kmVal = Math.round((el.distance.value / 1000) * 100) / 100;
      const minVal = Math.max(1, Math.round(el.duration.value / 60));
      setKm(String(kmVal));
      setTiempoMin(minVal);
      setEnvio(String(calcularEnvio(kmVal)));
    });
  }, [localId, direccion, cliente, locales, addressHistory, showMessage]);

  useEffect(() => {
    const t = setTimeout(() => { if (direccion.trim() && localId) calcularRuta(); }, 600);
    return () => clearTimeout(t);
  }, [direccion, localId, googleMapsReady, cliente, calcularRuta]);

  useEffect(() => {
    const q = direccion.trim().toLowerCase();
    if (!q || !cliente.trim()) { setAddressSuggestions([]); return; }
    setAddressSuggestions(
      addressHistory.filter((h) =>
        h.cliente.trim().toLowerCase() === cliente.trim().toLowerCase() &&
        h.direccion.trim().toLowerCase().includes(q)
      )
    );
  }, [cliente, direccion, addressHistory]);

  /* ======================== CRUD PEDIDOS ======================== */

  const guardarPedido = async (e: FormEvent) => {
    e.preventDefault();
    const kmVal = Number(km);
    if (!cliente.trim() || !direccion.trim() || Number.isNaN(kmVal) || kmVal <= 0) {
      showMessage("Cliente, dirección y km son obligatorios.");
      return;
    }
    if (!telefono.trim() || telefono.length < 7) {
      showMessage("Ingrese un teléfono válido (mínimo 7 dígitos).");
      return;
    }

    const tarifas = calcularPrecioPorKm(kmVal);
    const envioVal = Number(envio) || calcularEnvio(kmVal);
    const tiempoVal = tiempoMin || 10 + Math.round(kmVal * 4);

    const nuevoPedido: any = {
      codigo: pedidoIdEditar ? pedidos.find((p) => p.id === pedidoIdEditar)?.codigo || generarCodigo(pedidos.length) : generarCodigo(pedidos.length),
      cliente: cliente.trim(),
      telefono: telefono.trim(),
      direccion: direccion.trim(),
      barrio: barrio.trim() || "Desconocido",
      local_id: localId || null,
      repartidor_id: repartidorId || null,
      km: kmVal,
      envio: envioVal,
      precio: tarifas.precio,
      pago_repartidor: tarifas.pagoRepartidor,
      empresa_recibe: tarifas.empresaRecibe,
      estado: pedidoIdEditar ? pedidos.find((p) => p.id === pedidoIdEditar)?.estado || "Pendiente" : "Pendiente",
      liquidado: pedidoIdEditar ? pedidos.find((p) => p.id === pedidoIdEditar)?.liquidado || false : false,
      tiempo_min: tiempoVal,
    };

    try {
      if (pedidoIdEditar) {
        await supabase.from("pedidos").update(nuevoPedido).eq("id", pedidoIdEditar);
        showMessage("Pedido actualizado.");
      } else {
        await supabase.from("pedidos").insert(nuevoPedido);
        showMessage("Pedido creado.");
      }

      // Guardar en historial de direcciones
      await supabase.from("address_history").insert({
        cliente: cliente.trim(),
        direccion: direccion.trim(),
        barrio: barrio.trim() || "Desconocido",
        km: kmVal,
        tiempo_min: tiempoVal,
        envio: envioVal,
      });

      // Limpiar form
      setCliente(""); setTelefono(""); setDireccion(""); setBarrio("");
      setLocalId(""); setRepartidorId(""); setKm(""); setTiempoMin(0);
      setEnvio(""); setPedidoIdEditar(null);
      loadData();
    } catch (error: any) {
      showMessage("Error: " + (error.message || "No se pudo guardar el pedido."));
    }
  };

  const editarPedido = (pedido: Pedido) => {
    setPedidoIdEditar(pedido.id);
    setCliente(pedido.cliente);
    setTelefono(pedido.telefono);
    setDireccion(pedido.direccion);
    setBarrio(pedido.barrio);
    setLocalId(pedido.localId || "");
    setRepartidorId(pedido.repartidorId || "");
    setKm(String(pedido.km));
    setTiempoMin(pedido.tiempoMin);
    setEnvio(String(pedido.envio));
    setTab("nuevo-pedido");
  };

  const eliminarPedido = async (id: string) => {
    if (!confirm("¿Eliminar este pedido?")) return;
    await supabase.from("pedidos").delete().eq("id", id);
    showMessage("Pedido eliminado.");
    loadData();
  };

  const cambiarEstado = async (id: string, estado: string) => {
    await supabase.from("pedidos").update({ estado }).eq("id", id);
    loadData();
  };

  const copiarTexto = (texto: string) => {
    navigator.clipboard.writeText(texto).then(
      () => showMessage("Texto copiado."),
      () => showMessage("Error al copiar.")
    );
  };

  const copiarEmpresa = (pedido: Pedido) => {
    const local = locales.find((l) => l.id === pedido.localId);
    const rep = repartidores.find((r) => r.id === pedido.repartidorId);
    copiarTexto(
      `Pedido: ${pedido.codigo}\nFecha: ${formatearFecha(pedido.createdAt)}\nLocal: ${local?.nombre || "Sin local"}\nCliente: ${pedido.cliente}\nBarrio: ${pedido.barrio}\nTel: ${pedido.telefono}\nDirección: ${pedido.direccion}\nRepartidor: ${rep?.nombre || "Sin asignar"}\nKm: ${pedido.km} | Tiempo: ${pedido.tiempoMin} min\nEnvío: ${formatMoney(pedido.envio)}\nTarifa: ${formatMoney(pedido.precio)}\nEmpresa recibe: ${formatMoney(pedido.empresaRecibe)}\nEstado: ${pedido.estado}`
    );
  };

  const copiarRepartidor = (pedido: Pedido) => {
    const local = locales.find((l) => l.id === pedido.localId);
    const rep = repartidores.find((r) => r.id === pedido.repartidorId);
    copiarTexto(
      `Pedido: ${pedido.codigo}\nCliente: ${pedido.cliente}\nBarrio: ${pedido.barrio}\nDirección: ${pedido.direccion}\nLocal: ${local?.nombre || "Sin local"}\nRepartidor: ${rep?.nombre || "Sin asignar"}\nKm: ${pedido.km} | Tiempo: ${pedido.tiempoMin} min\nTarifa: ${formatMoney(pedido.precio)}\nTu pago: ${formatMoney(pedido.pagoRepartidor)}\nEstado: ${pedido.estado}`
    );
  };

  /* ======================== CRUD REPARTIDORES ======================== */

  const guardarRepartidor = async (e: FormEvent) => {
    e.preventDefault();
    if (!repNombre.trim()) { showMessage("Nombre obligatorio."); return; }
    try {
      if (repEditId) {
        await supabase.from("repartidores").update({ nombre: repNombre.trim(), telefono: repTelefono.trim() }).eq("id", repEditId);
        showMessage("Repartidor actualizado.");
        setRepEditId(null);
      } else {
        await supabase.from("repartidores").insert({ nombre: repNombre.trim(), telefono: repTelefono.trim() });
        showMessage("Repartidor creado.");
      }
      setRepNombre(""); setRepTelefono("");
      loadData();
    } catch (error: any) {
      showMessage("Error: " + (error.message || "No se pudo guardar."));
    }
  };

  const eliminarRepartidor = async (id: string) => {
    if (!confirm("¿Eliminar este repartidor?")) return;
    await supabase.from("repartidores").update({ activo: false }).eq("id", id);
    showMessage("Repartidor eliminado.");
    loadData();
  };

  /* ======================== CRUD LOCALES ======================== */

  const guardarLocal = async (e: FormEvent) => {
    e.preventDefault();
    if (!locNombre.trim()) { showMessage("Nombre obligatorio."); return; }
    try {
      if (locEditId) {
        await supabase.from("locales").update({ nombre: locNombre.trim(), direccion: locDireccion.trim(), telefono: locTelefono.trim() }).eq("id", locEditId);
        showMessage("Local actualizado.");
        setLocEditId(null);
      } else {
        await supabase.from("locales").insert({ nombre: locNombre.trim(), direccion: locDireccion.trim(), telefono: locTelefono.trim() });
        showMessage("Local creado.");
      }
      setLocNombre(""); setLocDireccion(""); setLocTelefono("");
      loadData();
    } catch (error: any) {
      showMessage("Error: " + (error.message || "No se pudo guardar."));
    }
  };

  const eliminarLocal = async (id: string) => {
    if (!confirm("¿Eliminar este local?")) return;
    await supabase.from("locales").update({ activo: false }).eq("id", id);
    showMessage("Local eliminado.");
    loadData();
  };

  /* ======================== LIQUIDACIÓN ======================== */

  const liquidarRepartidor = async (repId: string) => {
    await supabase.from("pedidos").update({ liquidado: true }).eq("repartidor_id", repId).eq("estado", "Entregado").eq("liquidado", false);
    showMessage("Repartidor liquidado.");
    loadData();
  };

  /* ======================== RENDER ======================== */

  const pedidosConDetalles = useMemo(
    () => pedidos.map((p) => ({
      ...p,
      localNombre: locales.find((l) => l.id === p.localId)?.nombre || "Sin local",
      repartidorNombre: repartidores.find((r) => r.id === p.repartidorId)?.nombre || "Sin asignar",
    })),
    [pedidos, locales, repartidores]
  );

  const pedidosFiltrados = useMemo(() => {
    let r = pedidosConDetalles;
    if (filtroEstado) r = r.filter((p) => p.estado === filtroEstado);
    if (filtroBusqueda) {
      const q = filtroBusqueda.toLowerCase();
      r = r.filter((p) => p.cliente.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q) || p.barrio.toLowerCase().includes(q));
    }
    return r;
  }, [pedidosConDetalles, filtroEstado, filtroBusqueda]);

  const totalPaginas = Math.max(1, Math.ceil(pedidosFiltrados.length / ITEMS_PER_PAGE));
  const pedidosPagina = pedidosFiltrados.slice((pagina - 1) * ITEMS_PER_PAGE, pagina * ITEMS_PER_PAGE);

  useEffect(() => { setPagina(1); }, [filtroEstado, filtroBusqueda]);

  const liquidacionPorRepartidor = useMemo(
    () => repartidores.map((rep) => {
      const entregados = pedidos.filter((p) => p.repartidorId === rep.id && p.estado === "Entregado");
      const debeEmpresa = entregados.reduce((s, p) => s + p.empresaRecibe, 0);
      const ganancia = entregados.reduce((s, p) => s + p.pagoRepartidor, 0);
      return { rep, pedidos: entregados.length, debeEmpresa, ganancia, liquidado: entregados.length > 0 && entregados.every((p) => p.liquidado) };
    }),
    [pedidos, repartidores]
  );

  const tarifas = km ? calcularPrecioPorKm(Number(km)) : null;

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#02060d" }}><p style={{ color: "#94a3b8" }}>Cargando DomiU...</p></div>;
  }

  return (
    <main style={pageStyle}>
      {/* SIDEBAR */}
      <aside style={sidebarStyle}>
        <div>
          <div style={brandStyle}>
            <span style={brandIconStyle}>🏍️</span>
            <span>Domi</span><span style={{ color: "#f59e0b" }}>U</span>
          </div>
          <p style={{ marginTop: 12, color: "#94a3b8", fontSize: 14 }}>Magdalena</p>
        </div>
        <nav style={navStyle}>
          {([
            { key: "panel", label: "Panel", icon: "📊" },
            { key: "nuevo-pedido", label: "Crear Pedido", icon: "➕" },
            { key: "pedidos", label: "Pedidos", icon: "📦" },
            { key: "repartidores", label: "Repartidores", icon: "🚴" },
            { key: "locales", label: "Locales", icon: "🏠" },
            { key: "liquidacion", label: "Liquidaciones", icon: "💰" },
          ] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              style={{
                width: "100%", padding: "16px 20px", borderRadius: 18,
                border: tab === item.key ? "1px solid #facc15" : "1px solid rgba(255,255,255,0.08)",
                background: tab === item.key ? "#111827" : "rgba(255,255,255,0.03)",
                color: tab === item.key ? "#ffffff" : "#cbd5e1",
                textAlign: "left", cursor: "pointer", fontSize: 16, fontWeight: 600,
                boxShadow: tab === item.key ? "0 10px 30px rgba(250,204,21,0.18)" : "none",
              }}
              onClick={() => setTab(item.key)}
            >
              <span style={{ display: "inline-flex", width: 24, justifyContent: "center", marginRight: 12 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* CONTENIDO */}
      <section style={{ flex: 1, padding: 32, overflowY: "auto", background: "#060b17" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 36, fontWeight: 900, color: "#f8fafc" }}>{fechaHoy}</h1>
          <span style={{ color: "#94a3b8", fontSize: 14 }}>{currentTime}</span>
        </div>

        {mensaje && <div style={toastStyle} role="alert">{mensaje}</div>}

        {/* ==================== PANEL ==================== */}
        {tab === "panel" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 18, marginBottom: 28 }}>
              <MetricCard label="TOTAL DEL TURNO" value={formatMoney(pedidos.reduce((s, p) => s + p.precio, 0))} footnote={`${pedidos.length} pedidos`} />
              <MetricCard label="EMPRESA RECIBE" value={formatMoney(pedidos.reduce((s, p) => s + p.empresaRecibe, 0))} footnote={`${pedidos.length > 0 ? Math.round((pedidos.reduce((s, p) => s + p.empresaRecibe, 0) / Math.max(pedidos.reduce((s, p) => s + p.precio, 0), 1)) * 100) : 0}%`} />
              <MetricCard label="POR LIQUIDAR" value={formatMoney(pedidos.filter((p) => p.estado === "Entregado" && !p.liquidado).reduce((s, p) => s + p.empresaRecibe, 0))} footnote={`${pedidos.filter((p) => p.estado === "Entregado" && !p.liquidado).length} pedidos`} />
              <MetricCard label="LIQUIDADO" value={formatMoney(pedidos.filter((p) => p.estado === "Entregado" && p.liquidado).reduce((s, p) => s + p.empresaRecibe, 0))} footnote={`${pedidos.filter((p) => p.estado === "Entregado" && p.liquidado).length} pedidos`} />
              <MetricCard label="ENTREGADOS" value={String(pedidos.filter((p) => p.estado === "Entregado").length)} footnote={`${pedidos.length} total`} />
            </div>

            {/* Tabla liquidación por repartidor */}
            <div style={panelCard}>
              <h2 style={sectionTitle}>Liquidación por repartidor</h2>
              <div style={tableContainer}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Repartidor</th>
                      <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Pedidos</th>
                      <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Empresa recibe</th>
                      <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Ganancia</th>
                      <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liquidacionPorRepartidor.map((item) => (
                      <tr key={item.rep.id}>
                        <td style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{item.rep.nombre}</td>
                        <td style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{item.pedidos}</td>
                        <td style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{formatMoney(item.debeEmpresa)}</td>
                        <td style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{formatMoney(item.ganancia)}</td>
                        <td style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <span style={item.liquidado ? pillGreen : pillYellow}>{item.liquidado ? "Liquidado" : "Pendiente"}</span>
                        </td>
                      </tr>
                    ))}
                    {liquidacionPorRepartidor.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "#64748b" }}>No hay repartidores registrados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ==================== CREAR PEDIDO ==================== */}
        {tab === "nuevo-pedido" && (
          <div style={panelCard}>
            <h2 style={sectionTitle}>{pedidoIdEditar ? "Editar pedido" : "Crear pedido"}</h2>
            <form onSubmit={guardarPedido} style={{ display: "grid", gap: 16 }} noValidate>
              <label style={labelStyle}>
                Cliente *
                <input style={inputStyle} placeholder="Nombre del cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} required />
              </label>
              <label style={labelStyle}>
                Teléfono
                <input style={inputStyle} placeholder="3001234567" value={telefono} onChange={(e) => setTelefono(e.target.value)} type="tel" />
              </label>
              <label style={labelStyle}>
                Dirección *
                <input style={inputStyle} placeholder="Dirección de entrega" value={direccion} onChange={(e) => setDireccion(e.target.value)} ref={direccionInputRef} required />
              </label>
              {addressSuggestions.length > 0 && (
                <div style={suggestionList} role="listbox">
                  {addressSuggestions.map((item) => (
                    <button key={item.id} type="button" style={suggestionItem} onClick={() => {
                      setDireccion(item.direccion); setBarrio(item.barrio); setKm(String(item.km));
                      setTiempoMin(item.tiempoMin); setEnvio(String(item.envio)); setAddressSuggestions([]);
                    }}>
                      {item.direccion} · {item.barrio}
                    </button>
                  ))}
                </div>
              )}
              <label style={labelStyle}>
                Barrio
                <input style={inputStyle} placeholder="Barrio" value={barrio} onChange={(e) => setBarrio(e.target.value)} />
              </label>
              <label style={labelStyle}>
                Local
                <select style={inputStyle} value={localId} onChange={(e) => setLocalId(e.target.value)}>
                  <option value="">Selecciona local</option>
                  {locales.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </label>
              <label style={labelStyle}>
                Repartidor
                <select style={inputStyle} value={repartidorId} onChange={(e) => setRepartidorId(e.target.value)}>
                  <option value="">Selecciona repartidor</option>
                  {repartidores.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </label>
              <label style={labelStyle}>
                Kilómetros *
                <input style={inputStyle} placeholder="Distancia en km" type="number" min="0.1" step="0.1" value={km} onChange={(e) => setKm(e.target.value)} required />
              </label>
              <div style={infoBox} aria-live="polite">
                <p>Tiempo estimado: {tiempoMin ? `${tiempoMin} min` : "Pendiente"}</p>
                <p>Envío estimado: {envio ? formatMoney(Number(envio)) : "Pendiente"}</p>
                {tarifas && (
                  <>
                    <p><strong>Tarifa: {formatMoney(tarifas.precio)}</strong> ({km} km)</p>
                    <p>Repartidor: {formatMoney(tarifas.pagoRepartidor)}</p>
                    <p>Empresa: {formatMoney(tarifas.empresaRecibe)}</p>
                  </>
                )}
                {distanceLoading && <p>Calculando ruta...</p>}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" style={primaryBtn}>{pedidoIdEditar ? "Actualizar pedido" : "Guardar pedido"}</button>
                {pedidoIdEditar && (
                  <button type="button" style={{ ...smallBtn, padding: "16px 24px", borderRadius: 20 }} onClick={() => { setPedidoIdEditar(null); }}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* ==================== PEDIDOS ==================== */}
        {tab === "pedidos" && (
          <div style={panelCard}>
            <h2 style={sectionTitle}>Pedidos</h2>
            <div style={filtersStyle}>
              <input style={{ ...inputStyle, flex: 1 }} placeholder="Buscar por cliente, código, barrio..." value={filtroBusqueda} onChange={(e) => setFiltroBusqueda(e.target.value)} />
              <select style={{ ...inputStyle, width: 180 }} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="">Todos los estados</option>
                {estadosPedido.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div style={tableContainer}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Código</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Cliente</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Barrio</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Local</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Repartidor</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Precio</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Repartidor</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Empresa</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Estado</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosPagina.map((p) => (
                    <tr key={p.id}>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{p.codigo}</td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{p.cliente}</td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{p.barrio}</td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{p.localNombre}</td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{p.repartidorNombre}</td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)", fontWeight: 700 }}>{formatMoney(p.precio)}</td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)", color: "#10b981" }}>{formatMoney(p.pagoRepartidor)}</td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)", color: "#facc15" }}>{formatMoney(p.empresaRecibe)}</td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <select
                          style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "#09111d", color: "#f8fafc", fontSize: 13 }}
                          value={p.estado}
                          onChange={(e) => cambiarEstado(p.id, e.target.value)}
                        >
                          {estadosPedido.map((e) => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </td>
                      <td style={{ ...actionsCell, padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <button type="button" style={smallBtn} onClick={() => editarPedido(p)}>Editar</button>
                        <button type="button" style={smallBtn} onClick={() => copiarEmpresa(p)}>Copiar emp.</button>
                        <button type="button" style={smallBtn} onClick={() => copiarRepartidor(p)}>Copiar rep.</button>
                        <button type="button" style={deleteBtn} onClick={() => eliminarPedido(p.id)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                  {pedidosPagina.length === 0 && (
                    <tr><td colSpan={10} style={{ textAlign: "center", padding: 32, color: "#64748b" }}>No hay pedidos</td></tr>
                  )}
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

        {/* ==================== REPARTIDORES ==================== */}
        {tab === "repartidores" && (
          <div style={panelCard}>
            <h2 style={sectionTitle}>Repartidores</h2>
            <form onSubmit={guardarRepartidor} style={{ display: "grid", gap: 16, marginBottom: 24 }}>
              <label style={labelStyle}>
                Nombre *
                <input style={inputStyle} placeholder="Nombre completo" value={repNombre} onChange={(e) => setRepNombre(e.target.value)} required />
              </label>
              <label style={labelStyle}>
                Teléfono
                <input style={inputStyle} placeholder="3001234567" value={repTelefono} onChange={(e) => setRepTelefono(e.target.value)} type="tel" />
              </label>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" style={primaryBtn}>{repEditId ? "Actualizar" : "Crear"}</button>
                {repEditId && (
                  <button type="button" style={{ ...smallBtn, padding: "16px 24px", borderRadius: 20 }} onClick={() => { setRepEditId(null); setRepNombre(""); setRepTelefono(""); }}>Cancelar</button>
                )}
              </div>
            </form>
            {repartidores.map((rep) => (
              <div key={rep.id} style={miniCard}>
                <div>
                  <strong style={{ color: "#f8fafc" }}>{rep.nombre}</strong>
                  <p style={{ margin: "4px 0 0", color: "#94a3b8" }}>{rep.telefono || "Sin teléfono"}</p>
                </div>
                <div style={actionsCell}>
                  <button type="button" style={smallBtn} onClick={() => { setRepEditId(rep.id); setRepNombre(rep.nombre); setRepTelefono(rep.telefono); }}>Editar</button>
                  <button type="button" style={deleteBtn} onClick={() => eliminarRepartidor(rep.id)}>Eliminar</button>
                </div>
              </div>
            ))}
            {repartidores.length === 0 && <p style={{ color: "#64748b", textAlign: "center", padding: 24 }}>No hay repartidores registrados</p>}
          </div>
        )}

        {/* ==================== LOCALES ==================== */}
        {tab === "locales" && (
          <div style={panelCard}>
            <h2 style={sectionTitle}>Locales</h2>
            <form onSubmit={guardarLocal} style={{ display: "grid", gap: 16, marginBottom: 24 }}>
              <label style={labelStyle}>
                Nombre *
                <input style={inputStyle} placeholder="Nombre del local" value={locNombre} onChange={(e) => setLocNombre(e.target.value)} required />
              </label>
              <label style={labelStyle}>
                Dirección
                <input style={inputStyle} placeholder="Dirección" value={locDireccion} onChange={(e) => setLocDireccion(e.target.value)} />
              </label>
              <label style={labelStyle}>
                Teléfono
                <input style={inputStyle} placeholder="6012345678" value={locTelefono} onChange={(e) => setLocTelefono(e.target.value)} type="tel" />
              </label>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" style={primaryBtn}>{locEditId ? "Actualizar" : "Crear"}</button>
                {locEditId && (
                  <button type="button" style={{ ...smallBtn, padding: "16px 24px", borderRadius: 20 }} onClick={() => { setLocEditId(null); setLocNombre(""); setLocDireccion(""); setLocTelefono(""); }}>Cancelar</button>
                )}
              </div>
            </form>
            {locales.map((loc) => (
              <div key={loc.id} style={miniCard}>
                <div>
                  <strong style={{ color: "#f8fafc" }}>{loc.nombre}</strong>
                  <p style={{ margin: "4px 0 0", color: "#94a3b8" }}>{loc.direccion || "Sin dirección"}</p>
                  <p style={{ margin: "4px 0 0", color: "#94a3b8" }}>{loc.telefono || "Sin teléfono"}</p>
                </div>
                <div style={actionsCell}>
                  <button type="button" style={smallBtn} onClick={() => { setLocEditId(loc.id); setLocNombre(loc.nombre); setLocDireccion(loc.direccion); setLocTelefono(loc.telefono); }}>Editar</button>
                  <button type="button" style={deleteBtn} onClick={() => eliminarLocal(loc.id)}>Eliminar</button>
                </div>
              </div>
            ))}
            {locales.length === 0 && <p style={{ color: "#64748b", textAlign: "center", padding: 24 }}>No hay locales registrados</p>}
          </div>
        )}

        {/* ==================== LIQUIDACIÓN ==================== */}
        {tab === "liquidacion" && (
          <div style={panelCard}>
            <h2 style={sectionTitle}>Liquidación por repartidor</h2>
            <div style={tableContainer}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Repartidor</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Entregados</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Empresa recibe</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Ganancia repartidor</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Liquidado</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {liquidacionPorRepartidor.map((item) => (
                    <tr key={item.rep.id}>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{item.rep.nombre}</td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{item.pedidos}</td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{formatMoney(item.debeEmpresa)}</td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)", color: "#10b981", fontWeight: 700 }}>{formatMoney(item.ganancia)}</td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <span style={item.liquidado ? pillGreen : pillYellow}>{item.liquidado ? "Sí" : "No"}</span>
                      </td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <button type="button" style={smallBtn} onClick={() => liquidarRepartidor(item.rep.id)} disabled={item.liquidado}>Liquidar</button>
                      </td>
                    </tr>
                  ))}
                  {liquidacionPorRepartidor.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "#64748b" }}>No hay repartidores registrados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
