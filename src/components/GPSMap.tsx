"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

interface RepartidorUbicacion {
  id: string;
  repartidor_id: string;
  nombre_repartidor: string;
  latitud: number;
  longitud: number;
  estado: string;
  ultima_actualizacion: string;
}

export default function GPSMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const [repartidores, setRepartidores] = useState<RepartidorUbicacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const channelRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    let initialized = false;

    async function initMap() {
      if (initialized) return;
      initialized = true;

      try {
        // Esperar a que el div exista
        let attempts = 0;
        while (!mapRef.current && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (!mapRef.current) {
          setError("No se encontró el contenedor del mapa");
          setLoading(false);
          return;
        }

        // Importar Leaflet solo del lado cliente
        const L = await import("leaflet");
        await import("leaflet/dist/leaflet.css");

        if (!mounted) return;

        // Evitar múltiples instancias
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        // Crear mapa
        const map = L.map(mapRef.current, {
          center: [10.4, -75.5],
          zoom: 12,
          zoomControl: true,
        });

        // Agregar capa de OpenStreetMap
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;

        // Cargar ubicaciones iniciales
        const sb = getSupabaseClient();
        const { data, error: sbError } = await sb
          .from("ubicaciones_repartidores")
          .select("*")
          .order("ultima_actualizacion", { ascending: false });

        if (sbError) {
          console.error("Error cargando ubicaciones:", sbError);
          setError("Error cargando ubicaciones");
        } else if (data && mounted) {
          setRepartidores(data);
          actualizarMarcadores(L, map, data);
        }

        // Suscripción a Realtime
        const channel = sb
          .channel("gps_realtime")
          .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "ubicaciones_repartidores",
          }, (payload: any) => {
            console.log("GPS Realtime:", payload);
            cargarUbicaciones();
          })
          .subscribe();

        channelRef.current = channel;

        setLoading(false);
      } catch (err: any) {
        console.error("Error iniciando mapa:", err);
        setError(err.message || "Error cargando mapa");
        setLoading(false);
      }
    }

    function actualizarMarcadores(L: any, map: any, ubicaciones: RepartidorUbicacion[]) {
      // Limpiar marcadores anteriores
      Object.values(markersRef.current).forEach((marker: any) => {
        if (map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
      });
      markersRef.current = {};

      // Colores por estado
      const colores: { [key: string]: string } = {
        disponible: "#22c55e",
        ocupado: "#eab308",
        desconectado: "#94a3b8",
      };

      // Agregar nuevos marcadores
      ubicaciones.forEach((rep) => {
        if (!rep.latitud || !rep.longitud) return;

        const color = colores[rep.estado] || colores.desconectado;
        
        // Crear icono personalizado
        const icono = L.divIcon({
          className: "custom-marker",
          html: `<div style="
            background: ${color};
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([rep.latitud, rep.longitud], { icon: icono })
          .addTo(map)
          .bindPopup(`
            <strong>${rep.nombre_repartidor || "Repartidor"}</strong><br/>
            Estado: ${rep.estado}<br/>
            Actualizado: ${new Date(rep.ultima_actualizacion).toLocaleTimeString()}
          `);

        markersRef.current[rep.repartidor_id] = marker;
      });
    }

    async function cargarUbicaciones() {
      try {
        const sb = getSupabaseClient();
        const { data, error: sbError } = await sb
          .from("ubicaciones_repartidores")
          .select("*")
          .order("ultima_actualizacion", { ascending: false });

        if (sbError) {
          console.error("Error recargando:", sbError);
          return;
        }

        if (data && mounted) {
          setRepartidores(data);
          if (mapInstanceRef.current) {
            const L = await import("leaflet");
            actualizarMarcadores(L, mapInstanceRef.current, data);
          }
        }
      } catch (err) {
        console.error("Error cargando ubicaciones:", err);
      }
    }

    initMap();

    return () => {
      mounted = false;
      if (channelRef.current) {
        const sb = getSupabaseClient();
        sb.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <p>Cargando mapa GPS...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "red" }}>
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <div ref={mapRef} style={{ width: "100%", height: "400px", borderRadius: "12px", overflow: "hidden" }} />
      
      {/* Lista de repartidores debajo del mapa */}
      <div style={{ marginTop: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Repartidores conectados</h3>
        {repartidores.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 14 }}>No hay repartidores conectados</p>
        ) : (
          repartidores.map((rep) => (
            <div key={rep.id} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              background: "white",
              borderRadius: 8,
              marginBottom: 8,
              border: "1px solid #e2e8f0",
            }}>
              <div>
                <strong style={{ fontSize: 14 }}>{rep.nombre_repartidor || "Repartidor"}</strong>
                <span style={{
                  marginLeft: 8,
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  background: rep.estado === "disponible" ? "#dcfce7" : rep.estado === "ocupado" ? "#fef9c3" : "#f1f5f9",
                  color: rep.estado === "disponible" ? "#16a34a" : rep.estado === "ocupado" ? "#ca8a04" : "#64748b",
                }}>
                  {rep.estado}
                </span>
              </div>
              <div style={{ textAlign: "right", fontSize: 12, color: "#64748b" }}>
                <div>{rep.latitud?.toFixed(6)}, {rep.longitud?.toFixed(6)}</div>
                <div>{new Date(rep.ultima_actualizacion).toLocaleTimeString()}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
