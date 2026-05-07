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

// Singleton objects
let map: any = null;
let markers: Record<string, any> = {};
let channel: any = null;
let adminMarker: any = null;
let infoWindow: any = null;

// Iconos únicos por ID (usamos emojis como iconos)
const getEmojiForId = (id: string): string => {
  const emojis = ["🛵", "🏍", "🚲", "🛺", "🏎", "🚤", "🚁", "🛸", "🏔"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return emojis[Math.abs(hash) % emojis.length];
};

// Calcular distancia en km (fórmula Haversine)
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Tiempo estimado (asumiendo 30 km/h en ciudad)
const getEstimatedTime = (distanceKm: number): string => {
  const minutes = Math.round((distanceKm / 30) * 60);
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}min`;
};

export default function GoogleMapsLive() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const [adminPos, setAdminPos] = useState<{lat: number, lng: number} | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedRider, setSelectedRider] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;

    const initMap = async () => {
      if (!mounted.current) return;

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        if (mapRef.current) {
          mapRef.current.innerHTML = '<div style="color:red;padding:30px;font-size:18px;text-align:center;">❌ FALTA API KEY</div>';
        }
        return;
      }

      try {
        // 1. Load Google Maps
        if (!(window as any).google?.maps) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
            script.async = true;
            script.onload = () => {
              console.log("✅ Maps loaded");
              resolve();
            };
            script.onerror = () => reject(new Error("Error cargando Maps"));
            document.head.appendChild(script);
          });
        }

        // 2. Get admin location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };
              setAdminPos(pos);
              console.log("📍 Admin position:", pos);

              if (map) {
                map.setCenter(pos);
                // Admin marker with label
                if (!adminMarker) {
                  adminMarker = new (window as any).google.maps.Marker({
                    position: pos,
                    map,
                    title: "TU UBICACIÓN (ADMIN)",
                    label: {
                      text: "🏠 ADMIN",
                      color: "#3b82f6",
                      fontSize: "14px",
                      fontWeight: "bold",
                    },
                    icon: {
                      path: (window as any).google.maps.SymbolPath.CIRCLE,
                      fillColor: "#3b82f6",
                      fillOpacity: 1,
                      strokeColor: "#fff",
                      strokeWeight: 3,
                      scale: 18,
                    },
                  });
                } else {
                  adminMarker.setPosition(pos);
                }
              }
            },
            (error) => {
              console.error("GPS Admin error:", error);
            },
            { enableHighAccuracy: true, timeout: 10000 }
          );
        }

        // 3. Wait for div
        let tries = 0;
        while (!mapRef.current && tries < 100 && mounted.current) {
          await new Promise(r => setTimeout(r, 50));
          tries++;
        }

        if (!mapRef.current || !mounted.current) return;

        // 4. Create or reuse map
        if (!map) {
          map = new (window as any).google.maps.Map(mapRef.current, {
            center: adminPos || { lat: 10.4, lng: -75.5 },
            zoom: 15,
            mapTypeId: "roadmap",
          });
          console.log("✅ Mapa creado");
        } else {
          const div = map.getDiv();
          if (div && div.parentNode) {
            div.parentNode.removeChild(div);
          }
          mapRef.current.appendChild(map.getDiv());
          console.log("♻️ Mapa reutilizado");
        }

        // 5. Load positions
        await loadPositions();

        // 6. Subscribe to changes (only once)
        if (!channel) {
          const sb = getSupabaseClient();
          channel = sb
            .channel("final_gps_v3")
            .on("postgres_changes", {
              event: "*",
              schema: "public",
              table: "ubicaciones_repartidores",
            }, () => {
              if (mounted.current) {
                console.log("🔄 Cambio detectado");
                loadPositions();
              }
            })
            .subscribe((status: string) => {
              console.log("Realtime:", status);
            });
          console.log("📡 Realtime suscrito");
        }
      } catch (err: any) {
        console.error("❌ Error:", err);
        if (mapRef.current) {
          mapRef.current.innerHTML = `<div style="color:red;padding:30px;font-size:16px;text-align:center;">❌ Error: ${err.message}</div>`;
        }
      }
    };

    const loadPositions = async () => {
      if (!map || !mounted.current) return;

      try {
        const sb = getSupabaseClient();
        const { data, error } = await sb
          .from("ubicaciones_repartidores")
          .select("*");

        if (error) {
          console.error("❌ Error Supabase:", error);
          return;
        }

        console.log("📍 Datos recibidos:", data?.length || 0);
        setLocations(data || []);
        updateMarkers(data || []);
      } catch (e) {
        console.error("❌ Error cargando:", e);
      }
    };

    const updateMarkers = (locs: Location[]) => {
      if (!map) return;

      const currentIds = new Set<string>();

      locs.forEach(loc => {
        if (!loc.latitud || !loc.longitud) return;
        currentIds.add(loc.repartidor_id);

        const pos = { lat: loc.latitud, lng: loc.longitud };
        const emoji = getEmojiForId(loc.repartidor_id);
        const color = getColorForId(loc.repartidor_id);

        if (markers[loc.repartidor_id]) {
          // Update existing marker
          const marker = markers[loc.repartidor_id];
          marker.setPosition(pos);
          // Update label (emoji + name)
          marker.setLabel({
            text: `${emoji} ${loc.nombre_repartidor?.substring(0, 10) || "R"}`,
            color: "#fff",
            fontSize: "12px",
            fontWeight: "bold",
          });
        } else {
          // Create NEW marker with UNIQUE emoji icon
          const marker = new (window as any).google.maps.Marker({
            position: pos,
            map,
            title: loc.nombre_repartidor || "Repartidor",
            icon: {
              path: (window as any).google.maps.SymbolPath.CIRCLE,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 3,
              scale: 20, // BIG marker
            },
            label: {
              text: `${emoji} ${loc.nombre_repartidor?.substring(0, 10) || "R"}`,
              color: "#fff",
              fontSize: "12px",
              fontWeight: "bold",
            },
          });

          // InfoWindow with COMPLETE info + DISTANCE
          const iw = new (window as any).google.maps.InfoWindow({
            content: `
              <div style="padding:15px;min-width:250px;font-family:Arial,sans-serif;">
                <div style="font-weight:bold;font-size:16px;margin-bottom:10px;color:#1e293b;">
                  ${emoji} ${loc.nombre_repartidor || "Repartidor"}
                </div>
                <div style="font-size:13px;margin-bottom:6px;color:#333;">
                  <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${loc.estado === 'disponible' ? '#22c55e' : loc.estado === 'ocupado' ? '#eab308' : '#94a3b8'};margin-right:8px;"></span>
                  <strong>Estado:</strong> ${loc.estado}
                </div>
                <div style="font-size:12px;color:#666;margin-bottom:6px;">
                  <strong>Última:</strong> ${new Date(loc.ultima_actualizacion).toLocaleString()}
                </div>
                <div style="font-size:12px;color:#666;margin-bottom:6px;">
                  <strong>Coordenadas:</strong> ${loc.latitud.toFixed(6)}, ${loc.longitud.toFixed(6)}
                </div>
                ${
                  adminPos
                    ? `
                <div style="font-size:13px;color:#3b82f6;margin-top:10px;padding-top:10px;border-top:1px solid #eee;">
                  <strong>📏 Distancia:</strong> ${getDistance(adminPos.lat, adminPos.lng, loc.latitud, loc.longitud).toFixed(2)} km<br/>
                  <strong>⏱ Tiempo estimado:</strong> ${getEstimatedTime(getDistance(adminPos.lat, adminPos.lng, loc.latitud, loc.longitud))}
                </div>`
                    : ""
                }
                <div style="font-size:11px;color:#999;margin-top:8px;">
                  ID: ${loc.repartidor_id.substring(0, 8)}...
                </div>
              </div>
            `,
          });

          marker.addListener("click", () => {
            if (infoWindow) infoWindow.close();
            iw.open(map, marker);
            infoWindow = iw;
            setSelectedRider(loc.repartidor_id);
            // Center map on this rider
            map.panTo(pos);
            map.setZoom(16);
          });

          markers[loc.repartidor_id] = marker;
          console.log("📍 Marcador creado:", loc.nombre_repartidor, emoji);
        }
      });

      // Remove old markers
      Object.keys(markers).forEach(id => {
        if (!currentIds.has(id) && id !== "admin") {
          markers[id].setMap(null);
          delete markers[id];
        }
      });
    };

    initMap();

    return () => {
      mounted.current = false;
      // DO NOT clear anything for persistence
    };
  }, []);

  return (
    <div>
      {/* Status */}
      <div style={{ marginBottom: "16px", padding: "12px", background: "#1e293b", borderRadius: "8px", color: "#cbd5e1", fontSize: "14px" }}>
        {locations.length === 0 ? (
          <span>⚠️ No hay repartidores con GPS activo. Asegúrate de que los repartidores tengan el GPS activado en su app.</span>
        ) : (
          <span>✅ {locations.length} repartidor{locations.length !== 1 ? "es" : ""} con GPS activo</span>
        )}
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        style={{ width: "100%", height: "500px", borderRadius: "12px", background: "#1e293b" }}
      />

      {/* Debug list */}
      <div style={{ marginTop: "16px", padding: "12px", background: "#0f172a", borderRadius: "8px", fontSize: "12px", color: "#94a3b8" }}>
        <p style={{ color: "#f8fafc", fontWeight: "bold", marginBottom: "8px" }}>Debug - {locations.length} repartidores:</p>
        <div style={{ maxHeight: "200px", overflowY: "auto" }}>
          {locations.map(loc => (
            <div key={loc.repartidor_id} style={{ marginBottom: "4px" }}>
              {getEmojiForId(loc.repartidor_id)} {loc.nombre_repartidor} - {loc.latitud?.toFixed(4)}, {loc.longitud?.toFixed(4)} - {loc.estado}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Helper: Get color for ID (bright colors)
function getColorForId(id: string): string {
  const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ff8000", "#8000ff", "#0080ff"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
