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
let trails: Record<string, Array<{lat: number, lng: number}>> = {};
let channel: any = null;
let adminMarker: any = null;

// Very bright, distinct colors
const getBrightColor = (id: string): string => {
  const colors = [
    "#FF0000", // Bright Red
    "#00FF00", // Bright Green
    "#0000FF", // Bright Blue
    "#FFFF00", // Bright Yellow
    "#FF00FF", // Bright Magenta
    "#00FFFF", // Bright Cyan
    "#FF8000", // Bright Orange
    "#8000FF", // Bright Purple
    "#0080FF", // Bright Light Blue
    "#FF0080", // Bright Pink
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function GoogleMapsLive() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const [status, setStatus] = useState<string>("Iniciando...");
  const [locations, setLocations] = useState<Location[]>([]);
  const [adminPos, setAdminPos] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    mounted.current = true;

    const initMap = async () => {
      if (!mounted.current) return;

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      console.log("🔑 API Key:", apiKey ? "OK" : "MISSING");
      
      if (!apiKey) {
        setStatus("❌ MISSING: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
        if (mapRef.current) {
          mapRef.current.innerHTML = '<div style="color:red;padding:30px;font-size:18px;text-align:center;">❌ FALTA API KEY</div>';
        }
        return;
      }

      try {
        // 1. Load Google Maps
        if (!(window as any).google?.maps) {
          setStatus("🔄 Cargando Google Maps...");
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
            script.async = true;
            script.onload = () => {
              console.log("✅ Maps loaded");
              setStatus("✅ Maps cargado");
              resolve();
            };
            script.onerror = () => {
              console.error("❌ Error cargando Maps");
              reject(new Error("Error cargando Maps"));
            };
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
                // Create or update admin marker
                if (!adminMarker) {
                  adminMarker = new (window as any).google.maps.Marker({
                    position: pos,
                    map,
                    title: "TU UBICACIÓN (ADMIN)",
                    icon: {
                      path: (window as any).google.maps.SymbolPath.CIRCLE,
                      fillColor: "#3b82f6",
                      fillOpacity: 1,
                      strokeColor: "#FFFFFF",
                      strokeWeight: 3,
                      scale: 16,
                    },
                    label: {
                      text: "ADMIN",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      fontWeight: "bold",
                    },
                  });
                  console.log("📍 Admin marker created");
                } else {
                  adminMarker.setPosition(pos);
                }
              }
            },
            (error) => {
              console.error("GPS Admin error:", error);
              setStatus("⚠️ No se pudo obtener tu ubicación");
            },
            { enableHighAccuracy: true, timeout: 10000 }
          );
        }

        // 3. Wait for div
        setStatus("🔄 Esperando contenedor...");
        let tries = 0;
        while (!mapRef.current && tries < 100 && mounted.current) {
          await new Promise(r => setTimeout(r, 50));
          tries++;
        }

        if (!mapRef.current || !mounted.current) {
          setStatus("❌ No se encontró el contenedor del mapa");
          return;
        }

        // 4. Create or reuse map
        if (!map) {
          setStatus("🔄 Creando mapa...");
          map = new (window as any).google.maps.Map(mapRef.current, {
            center: adminPos || { lat: 10.4, lng: -75.5 },
            zoom: 15,
            mapTypeId: "roadmap",
          });
          console.log("✅ Mapa creado");
          setStatus("✅ Mapa creado");
        } else {
          const div = map.getDiv();
          if (div && div.parentNode) {
            div.parentNode.removeChild(div);
          }
          mapRef.current.appendChild(map.getDiv());
          console.log("♻️ Mapa reutilizado");
          setStatus("✅ Mapa listo");
        }

        // 5. Load positions
        await loadPositions();

        // 6. Subscribe to changes (only once)
        if (!channel) {
          setStatus("🔄 Suscribiendo a cambios...");
          const sb = getSupabaseClient();
          channel = sb
            .channel("gps_final_v2")
            .on("postgres_changes", {
              event: "*",
              schema: "public",
              table: "ubicaciones_repartidores",
            }, () => {
              if (mounted.current) {
                console.log("🔄 Cambio detectado, recargando...");
                loadPositions();
              }
            })
            .subscribe((subStatus: string) => {
              console.log("Realtime:", subStatus);
              if (subStatus === "SUBSCRIBED") {
                setStatus("✅ Mapa listo - Esperando repartidores...");
              }
            });
          console.log("📡 Realtime suscrito");
        }

      } catch (err: any) {
        console.error("❌ Error:", err);
        setStatus(`❌ Error: ${err.message}`);
        if (mapRef.current) {
          mapRef.current.innerHTML = `<div style="color:red;padding:30px;font-size:16px;text-align:center;">❌ Error: ${err.message}</div>`;
        }
      }
    };

    const loadPositions = async () => {
      if (!map || !mounted.current) return;

      try {
        setStatus("🔄 Cargando ubicaciones...");
        const sb = getSupabaseClient();
        const { data, error } = await sb
          .from("ubicaciones_repartidores")
          .select("*");

        if (error) {
          console.error("❌ Error Supabase:", error);
          setStatus(`❌ Error Supabase: ${error.message}`);
          return;
        }

        console.log("📍 Datos recibidos:", data?.length || 0, "registros");
        setLocations(data || []);
        
        if (!data || data.length === 0) {
          setStatus("⚠️ No hay repartidores con GPS activo");
          return;
        }

        updateMarkers(data);
        setStatus(`✅ ${data.length} repartidores visibles`);
      } catch (e) {
        console.error("❌ Error cargando:", e);
        setStatus("❌ Error cargando ubicaciones");
      }
    };

    const updateMarkers = (locs: Location[]) => {
      if (!map) return;

      const currentIds = new Set<string>();
      let markersCreated = 0;
      let markersUpdated = 0;

      locs.forEach(loc => {
        if (!loc.latitud || !loc.longitud) {
          console.log("⚠️ Coordenadas inválidas para:", loc.nombre_repartidor);
          return;
        }
        
        currentIds.add(loc.repartidor_id);
        const color = getBrightColor(loc.repartidor_id);
        const pos = { lat: loc.latitud, lng: loc.longitud };

        // Update trail history
        if (!trails[loc.repartidor_id]) {
          trails[loc.repartidor_id] = [];
        }
        trails[loc.repartidor_id].push(pos);
        if (trails[loc.repartidor_id].length > 100) {
          trails[loc.repartidor_id] = trails[loc.repartidor_id].slice(-100);
        }

        if (markers[loc.repartidor_id]) {
          // Update existing marker
          const marker = markers[loc.repartidor_id];
          marker.setPosition(pos);
          marker.setIcon({
            path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3 3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.01 6-3.01s5.97 1.02 6 3.01c-1.29 1.94-3.5 3.22-6 3.22z",
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#FFFFFF",
            strokeWeight: 3,
            scale: 18, // BIG marker
          });
          // Update label (full name, max 12 chars)
          const displayName = (loc.nombre_repartidor || "R").substring(0, 12);
          marker.setLabel({
            text: displayName,
            color: "#FFFFFF",
            fontSize: "13px",
            fontWeight: "bold",
          });
          markersUpdated++;
        } else {
          // Create NEW marker - BIG and VISIBLE
          console.log("📍 Creando marcador GRANDE para:", loc.nombre_repartidor, "Color:", color);
          
          const displayName = (loc.nombre_repartidor || "R").substring(0, 12);
          markers[loc.repartidor_id] = new (window as any).google.maps.Marker({
            position: pos,
            map,
            title: loc.nombre_repartidor || "Repartidor",
            icon: {
              path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3 3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.01 6-3.01s5.97 1.02 6 3.01c-1.29 1.94-3.5 3.22-6 3.22z",
              fillColor: color,
              fillOpacity: 1,
              strokeColor: "#FFFFFF",
              strokeWeight: 3,
              scale: 18, // BIG marker
              labelOrigin: new (window as any).google.maps.Point(12, 12),
            },
            label: {
              text: displayName,
              color: "#FFFFFF",
              fontSize: "13px",
              fontWeight: "bold",
            },
          });

          // Draw trail (thick line)
          if (trails[loc.repartidor_id].length >= 2) {
            const trailLine = new (window as any).google.maps.Polyline({
              path: trails[loc.repartidor_id],
              geodesic: true,
              strokeColor: color,
              strokeOpacity: 0.8,
              strokeWeight: 8, // VERY THICK trail
              map,
            });
            markers[loc.repartidor_id].trail = trailLine;
            console.log("🛣️ Trayectoria dibujada para:", loc.nombre_repartidor);
          }

          markersCreated++;
        }
      });

      console.log(`✅ ${markersCreated} marcadores creados, ${markersUpdated} actualizados`);

      // Remove old markers
      Object.keys(markers).forEach(id => {
        if (!currentIds.has(id) && id !== "admin") {
          if (markers[id].trail) {
            markers[id].trail.setMap(null);
          }
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
      {/* Status message */}
      <div style={{ marginBottom: "16px", padding: "12px", background: "#1e293b", borderRadius: "8px", color: "#cbd5e1", fontSize: "14px" }}>
        {status}
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        style={{ width: "100%", height: "500px", borderRadius: "12px", background: "#1e293b" }}
      />
    </div>
  );
}
