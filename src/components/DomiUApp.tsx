"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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

type AppConfig = {
  tarifaBase: number;
  costoPorKm: number;
  porcentajeRepartidor: number;
};

const estadosPedido = ["Pendiente", "Asignado", "Recibido", "Entregado"] as const;
const ITEMS_PER_PAGE = 15;

function generarId() {
  return `DOM-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);
}

function calcularEnvio(km: number, config: AppConfig) {
  return Math.max(config.tarifaBase, Math.round(km * config.costoPorKm));
}

function calcularPagoRepartidor(precio: number, porcentaje: number) {
  return Math.round(precio * (porcentaje / 100));
}

export default function DomiUApp() {
  const [tab, setTab] = useState<Tab>("panel");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [repartidores, setRepartidores] = useState<Repartidor[]>([]);
  const [locales, setLocales] = useState<Local[]>([]);
  const [config, setConfig] = useState<AppConfig>({ tarifaBase: 2500, costoPorKm: 1200, porcentajeRepartidor: 55 });
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }));
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: pedidosData }, { data: repartidoresData }, { data: localesData }, { data: configData }] = await Promise.all([
        supabase.from("pedidos").select("*").order("created_at", { ascending: false }),
        supabase.from("repartidores").select("*").eq("activo", true).order("created_at", { ascending: false }),
        supabase.from("locales").select("*").eq("activo", true).order("created_at", { ascending: false }),
        supabase.from("app_config").select("*").single(),
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
      if (repartidoresData) {
        setRepartidores(repartidoresData.map((r: any) => ({
          id: r.id, nombre: r.nombre, telefono: r.telefono,
        })));
      }
      if (localesData) {
        setLocales(localesData.map((l: any) => ({
          id: l.id, nombre: l.nombre, direccion: l.direccion, telefono: l.telefono,
        })));
      }
      if (configData) {
        setConfig({
          tarifaBase: configData.tarifa_base,
          costoPorKm: configData.costo_por_km,
          porcentajeRepartidor: configData.porcentaje_repartidor,
        });
      }
    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showMessage = useCallback((text: string) => {
    setMensaje(text);
    setTimeout(() => setMensaje(""), 3000);
  }, []);

  const fechaHoy = useMemo(() => new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }), []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#02060d" }}>
        <p style={{ color: "#94a3b8" }}>Cargando DomiU...</p>
      </div>
    );
  }

  return (
    <main style={{ display: "flex", minHeight: "100vh", background: "#02060d", color: "#cbd5e1", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <aside style={{ width: 300, padding: 32, background: "#09101c", borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 28, fontWeight: 900, color: "#f8fafc" }}>
            <span style={{ display: "inline-flex", width: 40, height: 40, borderRadius: 14, background: "#fbbf24", color: "#0f172a", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏍️</span>
            <span>Domi</span><span style={{ color: "#f59e0b" }}>U</span>
          </div>
          <p style={{ marginTop: 12, color: "#94a3b8", fontSize: 14 }}>Magdalena</p>
        </div>
        <nav style={{ display: "grid", gap: 12 }}>
          {[
            { key: "panel", label: "Panel", icon: "📊" },
            { key: "nuevo-pedido", label: "Crear Pedido", icon: "➕" },
            { key: "pedidos", label: "Pedidos", icon: "📦" },
            { key: "repartidores", label: "Repartidores", icon: "🚴" },
            { key: "locales", label: "Locales", icon: "🏠" },
            { key: "liquidacion", label: "Liquidaciones", icon: "💰" },
            { key: "config", label: "Configuración", icon: "⚙️" },
          ].map((item) => (
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
              onClick={() => setTab(item.key as Tab)}
            >
              <span style={{ display: "inline-flex", width: 24, justifyContent: "center", marginRight: 12 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <section style={{ flex: 1, padding: 32, overflowY: "auto", background: "#060b17" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 36, fontWeight: 900, color: "#f8fafc" }}>{fechaHoy}</h1>
          </div>
          <span style={{ color: "#94a3b8", fontSize: 14 }}>{currentTime}</span>
        </div>

        {mensaje && (
          <div style={{ padding: "16px 20px", borderRadius: 20, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#ffffff", marginBottom: 24, fontWeight: 600 }}>
            {mensaje}
          </div>
        )}

        {tab === "panel" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 18 }}>
            {[
              { label: "TOTAL DEL TURNO", value: formatMoney(pedidos.reduce((s, p) => s + p.precio, 0)), footnote: `${pedidos.length} pedidos` },
              { label: "EMPRESA RECIBE", value: formatMoney(pedidos.reduce((s, p) => s + p.empresaRecibe, 0)), footnote: `${pedidos.length > 0 ? Math.round((pedidos.reduce((s, p) => s + p.empresaRecibe, 0) / Math.max(pedidos.reduce((s, p) => s + p.precio, 0), 1)) * 100) : 0}%` },
              { label: "ENTREGADOS", value: String(pedidos.filter((p) => p.estado === "Entregado").length), footnote: `${pedidos.length} total` },
            ].map((card, i) => (
              <div key={i} style={{ background: "#0b1221", borderRadius: 24, padding: 28, border: "1px solid rgba(255,255,255,0.08)" }}>
                <p style={{ color: "#facc15", fontSize: 13, fontWeight: 700, margin: "0 0 12px" }}>{card.label}</p>
                <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#ffffff" }}>{card.value}</h2>
                <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 14 }}>{card.footnote}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "nuevo-pedido" && (
          <div style={{ background: "#0f172a", borderRadius: 24, padding: 32, border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 style={{ margin: "0 0 24px", fontSize: 24, fontWeight: 800, color: "#f8fafc" }}>Crear pedido</h2>
            <p style={{ color: "#94a3b8" }}>Funcionalidad completa en desarrollo con Supabase.</p>
          </div>
        )}

        {tab === "pedidos" && (
          <div style={{ background: "#0f172a", borderRadius: 24, padding: 32, border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 style={{ margin: "0 0 24px", fontSize: 24, fontWeight: 800, color: "#f8fafc" }}>Pedidos</h2>
            <p style={{ color: "#94a3b8" }}>{pedidos.length} pedidos registrados</p>
          </div>
        )}

        {tab === "repartidores" && (
          <div style={{ background: "#0f172a", borderRadius: 24, padding: 32, border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 style={{ margin: "0 0 24px", fontSize: 24, fontWeight: 800, color: "#f8fafc" }}>Repartidores</h2>
            {repartidores.map((rep) => (
              <div key={rep.id} style={{ padding: 20, borderRadius: 20, background: "#0b1221", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 12 }}>
                <strong style={{ color: "#f8fafc" }}>{rep.nombre}</strong>
                <p style={{ margin: "4px 0 0", color: "#94a3b8" }}>{rep.telefono || "Sin teléfono"}</p>
              </div>
            ))}
            {repartidores.length === 0 && <p style={{ color: "#64748b" }}>No hay repartidores registrados</p>}
          </div>
        )}

        {tab === "locales" && (
          <div style={{ background: "#0f172a", borderRadius: 24, padding: 32, border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 style={{ margin: "0 0 24px", fontSize: 24, fontWeight: 800, color: "#f8fafc" }}>Locales</h2>
            {locales.map((loc) => (
              <div key={loc.id} style={{ padding: 20, borderRadius: 20, background: "#0b1221", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 12 }}>
                <strong style={{ color: "#f8fafc" }}>{loc.nombre}</strong>
                <p style={{ margin: "4px 0 0", color: "#94a3b8" }}>{loc.direccion || "Sin dirección"}</p>
              </div>
            ))}
            {locales.length === 0 && <p style={{ color: "#64748b" }}>No hay locales registrados</p>}
          </div>
        )}

        {tab === "liquidacion" && (
          <div style={{ background: "#0f172a", borderRadius: 24, padding: 32, border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 style={{ margin: "0 0 24px", fontSize: 24, fontWeight: 800, color: "#f8fafc" }}>Liquidación</h2>
            <p style={{ color: "#94a3b8" }}>En desarrollo</p>
          </div>
        )}

        {tab === "config" && (
          <div style={{ background: "#0f172a", borderRadius: 24, padding: 32, border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 style={{ margin: "0 0 24px", fontSize: 24, fontWeight: 800, color: "#f8fafc" }}>Configuración</h2>
            <p style={{ color: "#94a3b8" }}>Tarifa base: {formatMoney(config.tarifaBase)} | Costo/km: {formatMoney(config.costoPorKm)} | Repartidor: {config.porcentajeRepartidor}%</p>
          </div>
        )}
      </section>
    </main>
  );
}
