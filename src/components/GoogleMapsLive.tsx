"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

interface Location {
  id: string;
  repartidor_id: string;
  nombre_repartidor: string;
  latitud: number;
  longitud: number;
  estado: string;
  ultima_actualizacion: string;
}

// Singleton
let map: any = null;
let markers: Record<string, any> = {};
let polylines: Record<string, any> = {};
let history: Record<string, Array<{lat: number, lng: number}>> = {};
let channel: any = null;
let infoWindow: any = null;

// Color único por ID
const getColor = (id: string) => {
  const colors = ["#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f97316","#6366f1"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export default function GoogleMapsLive() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const init = async () => {
      if (!mounted.current) return;

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        if (mapRef.current) mapRef.current.innerHTML = '<div style="color:red;padding:20px">Falta API Key</div>';
        return;
      }

      try {
        // 1. Cargar Google Maps
        if (!(window as any).google?.maps) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
            script.async = true;
            script.onload = () => { console.log("✅ Maps loaded"); resolve(); };
            script.onerror = () => reject(new Error("Error Maps"));
            document.head.appendChild(script);
          });
        }

        // 2. Obtener ubicación admin
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              if (map) {
                map.setCenter(p);
                // Marcador admin
                if (!markers["admin"]) {
                  markers["admin"] = new (window as any).google.maps.Marker({
                    position: p,
                    map,
                    title: "Tu ubicación",
                    icon: {
                      path: (window as any).google.maps.SymbolPath.CIRCLE,
                      fillColor: "#3b82f6",
                      fillOpacity: 1,
                      strokeColor: "#fff",
                      strokeWeight: 2,
                      scale: 10,
                    },
                  });
                } else {
                  markers["admin"].setPosition(p);
                }
              }
            },
            (err) => console.error("GPS admin error:", err),
            { enableHighAccuracy: true, timeout: 5000 }
          );
        }

        // 3. Esperar div
        let tries = 0;
        while (!mapRef.current && tries < 100 && mounted.current) {
          await new Promise(r => setTimeout(r, 50));
          tries++;
        }
        if (!mapRef.current || !mounted.current) return;

        // 4. Crear o reutilizar mapa
        if (!map) {
          map = new (window as any).google.maps.Map(mapRef.current, {
            center: { lat: 10.4, lng: -75.5 },
            zoom: 14,
            mapTypeId: "roadmap",
          });
          console.log("✅ Mapa creado");
        } else {
          const div = map.getDiv();
          if (div && div.parentNode) div.parentNode.removeChild(div);
          mapRef.current.appendChild(map.getDiv());
          console.log("♻️ Mapa reutilizado");
        }

        // 5. Cargar posiciones iniciales
        await loadPositions();

        // 6. Suscribirse a cambios (solo una vez)
        if (!channel) {
          const sb = getSupabaseClient();
          channel = sb
            .channel("locations_live")
            .on("postgres_changes", { event: "*", schema: "public", table: "ubicaciones_repartidores" }, () => {
              if (mounted.current) loadPositions();
            })
            .subscribe((status: string) => console.log("Realtime:", status));
          console.log("📡 Realtime suscrito");
        }
      } catch (err: any) {
        console.error("Error:", err);
        if (mapRef.current) mapRef.current.innerHTML = `<div style="color:red;padding:20px">Error: ${err.message}</div>`;
      }
    };

    const loadPositions = async () => {
      if (!map || !mounted.current) return;
      try {
        const sb = getSupabaseClient();
        const { data, error } = await sb.from("ubicaciones_repartidores").select("*");
        if (error || !data) return;
        updateAll(data);
      } catch (e) { console.error("Error cargando:", e); }
    };

    const updateAll = (locs: Location[]) => {
      if (!map) return;
      const currentIds = new Set<string>();

      locs.forEach(loc => {
        if (!loc.latitud || !loc.longitud) return;
        currentIds.add(loc.repartidor_id);
        const color = getColor(loc.repartidor_id);
        const pos = { lat: loc.latitud, lng: loc.longitud };

        // Historial
        if (!history[loc.repartidor_id]) history[loc.repartidor_id] = [];
        history[loc.repartidor_id].push(pos);
        if (history[loc.repartidor_id].length > 100) history[loc.repartidor_id] = history[loc.repartidor_id].slice(-100);

        if (markers[loc.repartidor_id]) {
          // Actualizar marcador
          const marker = markers[loc.repartidor_id];
          marker.setPosition(pos);
          marker.setIcon({
            path: (window as any).google.maps.SymbolPath.CIRCLE,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
            scale: 8,
          });
          // Actualizar etiqueta (nombre completo, truncado)
          const shortName = (loc.nombre_repartidor || "R").substring(0, 12);
          marker.setLabel({
            text: shortName,
            color: "#fff",
            fontSize: "11px",
            fontWeight: "bold",
          });
        } else {
          // Crear marcador con nombre
          const shortName = (loc.nombre_repartidor || "R").substring(0, 12);
          markers[loc.repartidor_id] = new (window as any).google.maps.Marker({
            position: pos,
            map,
            icon: {
              path: (window as any).google.maps.SymbolPath.CIRCLE,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
              scale: 8,
              labelOrigin: new (window as any).google.maps.Point(0, -10),
            },
            label: {
              text: shortName,
              color: "#fff",
              fontSize: "11px",
              fontWeight: "bold",
            },
            title: loc.nombre_repartidor || "Repartidor",
          });

          // InfoWindow con info completa (se abre al hacer clic)
          const iw = new (window as any).google.maps.InfoWindow({
            content: `
              <div style="padding:12px;min-width:200px;">
                <div style="font-weight:bold;font-size:14px;margin-bottom:8px;">${loc.nombre_repartidor || "Repartidor"}</div>
                <div style="font-size:12px;margin-bottom:4px;">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${loc.estado==='disponible'?'#22c55e':loc.estado==='ocupado'?'#eab308':'#94a3b8'};margin-right:6px;"></span>
                  ${loc.estado}
                </div>
                <div style="font-size:11px;color:#666;margin-bottom:4px;">Última: ${new Date(loc.ultima_actualizacion).toLocaleTimeString()}</div>
                <div style="font-size:11px;color:#666;">${loc.latitud.toFixed(6)}, ${loc.longitud.toFixed(6)}</div>
                <div style="font-size:11px;color:${color};margin-top:4px;">● Trayectoria: ${history[loc.repartidor_id]?.length || 0} puntos</div>
              </div>
            `,
          });

          markers[loc.repartidor_id].addListener("click", () => {
            if (infoWindow) infoWindow.close();
            iw.open(map, markers[loc.repartidor_id]);
            infoWindow = iw;
          });

          console.log("📍 Marcador:", loc.nombre_repartidor);
        }

        // Trayectoria
        if (history[loc.repartidor_id].length >= 2) {
          if (polylines[loc.repartidor_id]) {
            polylines[loc.repartidor_id].setPath(history[loc.repartidor_id]);
          } else {
            polylines[loc.repartidor_id] = new (window as any).google.maps.Polyline({
              path: history[loc.repartidor_id],
              geodesic: true,
              strokeColor: color,
              strokeOpacity: 0.7,
              strokeWeight: 3,
              map,
            });
          }
        }
      });

      // Eliminar los que ya no están
      Object.keys(markers).forEach(id => {
        if (!currentIds.has(id) && id !== "admin") {
          markers[id].setMap(null);
          delete markers[id];
          if (polylines[id]) { polylines[id].setMap(null); delete polylines[id]; }
          delete history[id];
        }
      });
    };

    init();

    return () => {
      mounted.current = false;
      // NO limpiar nada para persistencia
    };
  }, []);

  return (
    <div>
      <div
        ref={mapRef}
        style={{ width: "100%", height: "500px", borderRadius: "12px", background: "#1e293b" }}
      />
    </div>
  );
}
