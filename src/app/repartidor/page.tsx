"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

function RealTimeClock() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      setDate(p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear());
      setTime(p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()));
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);

  return <div>{date} — {time}</div>;
}

export default function RiderApp() {
  const { user, profile, logout } = useAuth();
  const [riderData, setRiderData] = useState<any>(null);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [estadoRider, setEstadoRider] = useState("No disponible");
  const subRef = useRef<any>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const { data: rider } = await supabase
        .from("repartidores")
        .select("*")
        .eq("user_id", user.id)
        .single();
      setRiderData(rider);
      if (rider) {
        setEstadoRider(rider.estado || "No disponible");
        const { data } = await supabase
          .from("pedidos")
          .select("*")
          .eq("repartidor_id", rider.id)
          .order("created_at", { ascending: false });
        setPedidos(data || []);
      }
    } catch (e) {
      console.error("Error cargando datos:", e);
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
      supabase.removeChannel(subRef.current);
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
      supabase.removeChannel(channel);
    };
  }, [user, riderData, loadData]);

  async function cambiarEstado(nuevoEstado: string) {
    if (!riderData) return;
    const { error } = await supabase
      .from("repartidores")
      .update({ estado: nuevoEstado })
      .eq("id", riderData.id);
    if (!error) {
      setEstadoRider(nuevoEstado);
    } else {
      console.error("Error cambiando estado:", error.message);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#02060d" }}>
        <p style={{ color: "#94a3b8" }}>Cargando...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#02060d", color: "#cbd5e1", fontFamily: "'Inter', system-ui, sans-serif", padding: 32 }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: "#f8fafc", margin: 0 }}>Domi<span style={{ color: "#facc15" }}>U</span> — Repartidor</h1>
            <p style={{ color: "#94a3b8", margin: "4px 0 0" }}>{profile?.nombre}</p>
            <p style={{ color: "#64748b", fontSize: 14, margin: "2px 0 0" }}>{profile?.email}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <RealTimeClock />
            <button onClick={async () => { await logout(); }} style={{ marginTop: 8, padding: "8px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#f8fafc", cursor: "pointer", fontSize: 14 }}>
              Cerrar sesión
            </button>
          </div>
        </div>

        <div style={{ padding: 24, borderRadius: 20, background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>Tu estado actual</h2>
          <span style={{ padding: "8px 20px", borderRadius: 999, background: estadoRider === "Disponible" ? "#10b981" : estadoRider === "Ocupado" ? "#f59e0b" : "#ef4444", color: "#fff", fontSize: 14, fontWeight: 700 }}>
            {estadoRider}
          </span>
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button onClick={() => cambiarEstado("Disponible")} style={{ flex: 1, padding: "12px 16px", borderRadius: 14, border: estadoRider === "Disponible" ? "2px solid #10b981" : "1px solid rgba(255,255,255,0.12)", background: estadoRider === "Disponible" ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)", color: "#f8fafc", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
              Disponible
            </button>
            <button onClick={() => cambiarEstado("Ocupado")} style={{ flex: 1, padding: "12px 16px", borderRadius: 14, border: estadoRider === "Ocupado" ? "2px solid #f59e0b" : "1px solid rgba(255,255,255,0.12)", background: estadoRider === "Ocupado" ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)", color: "#f8fafc", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
              Ocupado
            </button>
            <button onClick={() => cambiarEstado("No disponible")} style={{ flex: 1, padding: "12px 16px", borderRadius: 14, border: estadoRider === "No disponible" ? "2px solid #ef4444" : "1px solid rgba(255,255,255,0.12)", background: estadoRider === "No disponible" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)", color: "#f8fafc", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
              No disponible
            </button>
          </div>
        </div>

        <div style={{ padding: 24, borderRadius: 20, background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>Pedidos asignados ({pedidos.length})</h2>
          {pedidos.length === 0 ? (
            <p style={{ color: "#64748b", textAlign: "center", padding: 24 }}>No tienes pedidos asignados.</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {pedidos.map((p: any) => (
                <div key={p.id} style={{ padding: 16, borderRadius: 16, background: "#0b1221", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <strong style={{ color: "#facc15" }}>{p.codigo}</strong>
                    <span style={{ padding: "4px 12px", borderRadius: 999, background: p.estado === "Entregado" ? "#10b981" : p.estado === "Cancelado" ? "#ef4444" : "#64748b", color: "#fff", fontSize: 12, fontWeight: 700 }}>
                      {p.estado}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 4px", color: "#f8fafc", fontWeight: 600 }}>{p.cliente}</p>
                  <p style={{ margin: "0 0 4px", color: "#94a3b8", fontSize: 14 }}>{p.direccion}</p>
                  {p.barrio && <p style={{ margin: "0 0 4px", color: "#64748b", fontSize: 13 }}>{p.barrio}</p>}
                  {p.telefono && <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>Tel: {p.telefono}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
