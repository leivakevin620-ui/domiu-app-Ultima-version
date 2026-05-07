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

// Variables globales para persistencia
let map: any = null;
let markers: Record<string, any> = {};
let trails: Record<string, Array<{lat: number, lng: number}>> = {};
let channel: any = null;

// Generar color único y BRILLANTE por ID
const getBrightColor = (id: string): string => {
  const brightColors = [
    "#FF0000", // Rojo brillante
    "#00FF00", // Verde brillante
    "#0000FF", // Azul brillante
    "#FFFF00", // Amarillo brillante
    "#FF00FF", // Magenta brillante
    "#00FFFF", // Cian brillante
    "#FF8000", // Naranja brillante
    "#8000FF", // Púrpura brillante
    "#FF0080", // Rosa brillante
    "#80FF00", // Lima brillante
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return brightColors[Math.abs(hash) % brightColors.length];
};

export default function GoogleMapsLive() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const [status, setStatus] = useState<string>("Iniciando...");
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    mounted.current = true;

    const initMap = async () => {
      if (!mounted.current) return;

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      console.log("🔑 API Key:", apiKey ? "✅ Presente" : "❌ FALTA");
      
      if (!apiKey) {
        setStatus("❌ FALTA: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
        return;
      }

      try {
        // 1. Cargar Google Maps
        if (!(window as any).google?.maps) {
          setStatus("🔄 Cargando Google Maps...");
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
            script.async = true;
            script.onload = () => {
              console.log("✅ Google Maps cargado");
              setStatus("✅ Maps cargado");
              resolve();
            };
            script.onerror = () => {
              console.error("❌ Error cargando Maps");
              reject(new Error("Error cargando Google Maps"));
            };
            document.head.appendChild(script);
          });
        }

        // 2. Esperar al div del mapa
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

        // 3. Crear o reutilizar el mapa
        if (!map) {
          setStatus("🔄 Creando mapa...");
          map = new (window as any).google.maps.Map(mapRef.current, {
            center: { lat: 10.4, lng: -75.5 },
            zoom: 14,
            mapTypeId: "roadmap",
          });
          console.log("✅ Mapa creado");
          setStatus("✅ Mapa creado y listo");
        } else {
          const div = map.getDiv();
          if (div && div.parentNode) {
            div.parentNode.removeChild(div);
          }
          mapRef.current.appendChild(map.getDiv());
          console.log("♻️ Mapa reutilizado");
          setStatus("✅ Mapa reutilizado");
        }

        // 4. Cargar ubicaciones iniciales
        await loadLocations();

        // 5. Suscribirse a cambios (solo una vez)
        if (!channel) {
          const sb = getSupabaseClient();
          channel = sb
            .channel("gps_realtime_final")
            .on("postgres_changes", {
              event: "*",
              schema: "public",
              table: "ubicaciones_repartidores",
            }, () => {
              if (mounted.current) {
                console.log("🔄 Cambio detectado, recargando...");
                loadLocations();
              }
            })
            .subscribe((subStatus: string) => {
              console.log("📡 Realtime:", subStatus);
              if (subStatus === "SUBSCRIBED") {
                setStatus("✅ Mapa listo - Esperando repartidores...");
              }
            });
          console.log("📡 Suscrito a cambios");
        }

      } catch (err: any) {
        console.error("❌ Error:", err);
        setStatus(`❌ Error: ${err.message}`);
      }
    };

    const loadLocations = async () => {
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

        console.log("📍 Ubicaciones recibidas:", data?.length || 0);
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

        // Guardar en historial (trail)
        if (!trails[loc.repartidor_id]) {
          trails[loc.repartidor_id] = [];
        }
        trails[loc.repartidor_id].push(pos);
        if (trails[loc.repartidor_id].length > 100) {
          trails[loc.repartidor_id] = trails[loc.repartidor_id].slice(-100);
        }

        if (markers[loc.repartidor_id]) {
          // Actualizar marcador existente
          const marker = markers[loc.repartidor_id];
          marker.setPosition(pos);
          marker.setIcon({
            path: (window as any).google.maps.SymbolPath.CIRCLE,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#FFFFFF",
            strokeWeight: 3,
            scale: 16, // GRANDE
          });
          // Actualizar etiqueta (nombre completo, máximo 15 caracteres)
          const displayName = (loc.nombre_repartidor || "R").substring(0, 15);
          marker.setLabel({
            text: displayName,
            color: "#FFFFFF",
            fontSize: "12px",
            fontWeight: "bold",
          });
          markersUpdated++;
        } else {
          // Crear NUEVO marcador GRANDE con nombre
          const displayName = (loc.nombre_repartidor || "R").substring(0, 15);
          console.log("📍 Creando marcador GRANDE para:", loc.nombre_repartidor, "Color:", color);
          
          markers[loc.repartidor_id] = new (window as any).google.maps.Marker({
            position: pos,
            map: map,
            title: loc.nombre_repartidor || "Repartidor",
            icon: {
              path: (window as any).google.maps.SymbolPath.CIRCLE,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: "#FFFFFF",
              strokeWeight: 3,
              scale: 16, // GRANDE Y VISIBLE
            },
            label: {
              text: displayName,
              color: "#FFFFFF",
              fontSize: "12px",
              fontWeight: "bold",
            },
          });

          // Ventana de información (al hacer clic)
          const infoWindow = new (window as any).google.maps.InfoWindow({
            content: `
              <div style="padding:15px; min-width:220px;">
                <div style="font-weight:bold; font-size:16px; margin-bottom:10px; color:#000;">${loc.nombre_repartidor || "Repartidor"}</div>
                <div style="font-size:13px; margin-bottom:6px; color:#333;">
                  <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${loc.estado === 'disponible' ? '#22c55e' : loc.estado === 'ocupado' ? '#eab308' : '#94a3b8'}; margin-right:8px;"></span>
                  <strong>Estado:</strong> ${loc.estado}
                </div>
                <div style="font-size:12px; color:#666; margin-bottom:6px;"><strong>Última:</strong> ${new Date(loc.ultima_actualizacion).toLocaleTimeString()}</div>
                <div style="font-size:12px; color:#666; margin-bottom:6px;"><strong>Coordenadas:</strong> ${loc.latitud.toFixed(6)}, ${loc.longitud.toFixed(6)}</div>
                <div style="font-size:12px; color:${color};"><strong>● Trayectoria:</strong> ${trails[loc.repartidor_id]?.length || 0} puntos</div>
              </div>
            `,
          });

          markers[loc.repartidor_id].addListener("click", () => {
            if ((window as any).currentInfoWindow) {
              (window as any).currentInfoWindow.close();
            }
            infoWindow.open(map, markers[loc.repartidor_id]);
            (window as any).currentInfoWindow = infoWindow;
          });

          markersCreated++;
        }

        // Dibujar TRAYECTORIA (línea gruesa)
        if (trails[loc.repartidor_id].length >= 2) {
          // Eliminar línea anterior si existe
          if (markers[loc.repartidor_id].trail) {
            markers[loc.repartidor_id].trail.setMap(null);
          }

          const trailLine = new (window as any).google.maps.Polyline({
            path: trails[loc.repartidor_id],
            geodesic: true,
            strokeColor: color,
            strokeOpacity: 0.8,
            strokeWeight: 6, // GRUESA
            map: map,
          });

          markers[loc.repartidor_id].trail = trailLine;
          console.log("🛣️ Trayectoria dibujada para:", loc.nombre_repartidor);
        }
      });

      console.log(`✅ ${markersCreated} marcadores creados, ${markersUpdated} actualizados`);

      // Eliminar marcadores que ya no existen
      Object.keys(markers).forEach(id => {
        if (!currentIds.has(id)) {
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
      // NO limpiar nada para persistencia
    };
  }, []);

  return (
    <div>
      {/* Mensaje de estado */}
      <div style={{ marginBottom: "16px", padding: "12px", background: "#1e293b", borderRadius: "8px", color: "#cbd5e1", fontSize: "14px" }}>
        {status}
      </div>

      {/* Mapa */}
      <div
        ref={mapRef}
        style={{ width: "100%", height: "500px", borderRadius: "12px", background: "#1e293b" }}
      />

      {/* Información de debug */}
      <div style={{ marginTop: "16px", padding: "12px", background: "#0f172a", borderRadius: "8px" }}>
        <p style={{ color: "#f8fafc", fontSize: "14px", fontWeight: "bold", marginBottom: "8px" }}>
          📍 {locations.length} Repartidores con GPS:
        </p>
        <div style={{ maxHeight: "200px", overflowY: "auto" }}>
          {locations.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: "12px" }}>No hay repartidores conectados. Asegúrate de que tengan el GPS activo.</p>
          ) : (
            locations.map(loc => (
              <div key={loc.repartidor_id} style={{ color: "#cbd5e1", fontSize: "12px", marginBottom: "4px" }}>
                🔹 {loc.nombre_repartidor} - {loc.latitud?.toFixed(4)}, {loc.longitud?.toFixed(4)} - {loc.estado}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Instrucciones */}
      <div style={{ marginTop: "12px", padding: "12px", background: "#1e293b", borderRadius: "8px", fontSize: "12px", color: "#94a3b8" }}>
        <p><strong style={{ color: "#f8fafc" }}>Instrucciones:</strong></p>
        <p>1. Asegúrate de autorizar tu dominio en Google Cloud Console</p>
        <p>2. Ve a: https://console.cloud.google.com/ → Credenciales → Tu API Key</p>
        <p>3. Restricciones de aplicación → Sitios web → Agrega:</p>
        <p style={{ color: "#fbbf24" }}>   https://domiu-app-ultima-version.vercel.app/*</p>
        <p style={{ color: "#fbbf24" }}>   https://*.vercel.app/*</p>
        <p>4. Guarda cambios (espera 5 minutos)</p>
      </div>
    </div>
  );
}
