"use client";

import { useEffect, useRef, useState, useMemo } from "react";
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
let globalMap: any = null;
let globalMarkers: Record<string, any> = {};
let globalPolylines: Record<string, any> = {};
let globalHistory: Record<string, Array<{lat: number, lng: number}>> = {};
let globalChannel: any = null;
let globalInfoWindow: any = null;

// Colores únicos por ID
const getColorForId = (id: string) => {
  const colors = [
    "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
    "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// Iniciales del nombre
const getInitials = (name: string) => {
  if (!name) return "?";
  const parts = name.split(" ");
  return parts.length > 1
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
};

export default function GoogleMapsLive() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const [adminPos, setAdminPos] = useState<{lat: number, lng: number} | null>(null);
  const [ridersList, setRidersList] = useState<Location[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Filtrar solo por nombre
  const filteredRiders = useMemo(() => {
    if (!searchTerm) return ridersList;
    return ridersList.filter(r =>
      r.nombre_repartidor?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [ridersList, searchTerm]);

  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      if (!mountedRef.current) return;

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        if (mapRef.current) {
          mapRef.current.innerHTML = '<div style="color:red;padding:20px;">Falta API Key</div>';
        }
        return;
      }

      try {
        // 1. Cargar Google Maps
        if (!(window as any).google?.maps) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
            script.async = true;
            script.onload = () => {
              console.log("✅ Maps loaded");
              resolve();
            };
            script.onerror = () => reject(new Error("Error cargando Maps"));
            document.head.appendChild(script);
          });
        }

        // 2. Obtener ubicación del admin
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };
              setAdminPos(pos);
              if (globalMap) {
                globalMap.setCenter(pos);
                // Marcador admin
                if (!globalMarkers["admin"]) {
                  const adminMarker = new (window as any).google.maps.Marker({
                    position: pos,
                    map: globalMap,
                    title: "Tu ubicación (Admin)",
                    icon: {
                      path: (window as any).google.maps.SymbolPath.CIRCLE,
                      fillColor: "#3b82f6",
                      fillOpacity: 1,
                      strokeColor: "#fff",
                      strokeWeight: 2,
                      scale: 10,
                    },
                  });
                  globalMarkers["admin"] = { marker: adminMarker };
                } else {
                  globalMarkers["admin"].marker.setPosition(pos);
                }
              }
            },
            (error) => {
              console.error("GPS Admin error:", error);
            },
            { enableHighAccuracy: true, timeout: 5000 }
          );
        }

        // 3. Esperar div
        let tries = 0;
        while (!mapRef.current && tries < 100 && mountedRef.current) {
          await new Promise(r => setTimeout(r, 50));
          tries++;
        }

        if (!mapRef.current || !mountedRef.current) return;

        if (!globalMap) {
          globalMap = new (window as any).google.maps.Map(mapRef.current, {
            center: adminPos || { lat: 10.4, lng: -75.5 },
            zoom: 14,
            mapTypeId: "roadmap",
          });
          console.log("✅ Mapa creado (singleton)");
        } else {
          const div = globalMap.getDiv();
          if (div && div.parentNode) {
            div.parentNode.removeChild(div);
          }
          mapRef.current.appendChild(globalMap.getDiv());
          console.log("♻️ Mapa reutilizado");
        }

        // 4. Cargar posiciones iniciales
        await loadPositions();

        // 5. Suscribirse a cambios (solo una vez)
        if (!globalChannel) {
          const sb = getSupabaseClient();
          globalChannel = sb
            .channel("live_riders_v6")
            .on("postgres_changes", {
              event: "*",
              schema: "public",
              table: "ubicaciones_repartidores",
            }, () => {
              if (mountedRef.current) {
                loadPositions();
              }
            })
            .subscribe((status: string) => {
              console.log("Realtime status:", status);
            });
          console.log("📡 Realtime suscrito");
        }
      } catch (err: any) {
        console.error("Error:", err);
        if (mapRef.current) {
          mapRef.current.innerHTML = `<div style="color:red;padding:20px;">Error: ${err.message}</div>`;
        }
      }
    };

    const loadPositions = async () => {
      if (!globalMap || !mountedRef.current) return;

      try {
        const sb = getSupabaseClient();
        const { data, error } = await sb
          .from("ubicaciones_repartidores")
          .select("*");

        if (error || !data || !mountedRef.current) return;

        setRidersList(data);
        updateMarkersAndTrails(data);
      } catch (e) {
        console.error("Error cargando posiciones:", e);
      }
    };

    const updateMarkersAndTrails = (locs: Location[]) => {
      if (!globalMap) return;

      const currentIds = new Set<string>();

      locs.forEach(loc => {
        if (!loc.latitud || !loc.longitud) return;
        currentIds.add(loc.repartidor_id);

        const color = getColorForId(loc.repartidor_id);
        const initials = getInitials(loc.nombre_repartidor || "R");
        const position = { lat: loc.latitud, lng: loc.longitud };

        // Actualizar historial
        if (!globalHistory[loc.repartidor_id]) {
          globalHistory[loc.repartidor_id] = [];
        }
        globalHistory[loc.repartidor_id].push(position);
        if (globalHistory[loc.repartidor_id].length > 50) {
          globalHistory[loc.repartidor_id] = globalHistory[loc.repartidor_id].slice(-50);
        }

        if (globalMarkers[loc.repartidor_id]) {
          // Actualizar marcador existente
          const markerData = globalMarkers[loc.repartidor_id];
          markerData.marker.setPosition(position);
          markerData.loc = loc;
        } else {
          // Crear nuevo marcador con avatar
          const svgMarker = {
            path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.01 6-3.01s5.97 1.02 6 3.01c-1.29 1.94-3.5 3.22-6 3.22z",
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
            scale: 1.5,
            labelOrigin: new (window as any).google.maps.Point(12, 12),
          };

          const marker = new (window as any).google.maps.Marker({
            position,
            map: globalMap,
            icon: svgMarker,
            label: {
              text: initials,
              color: "#fff",
              fontSize: "10px",
              fontWeight: "bold",
            },
            title: loc.nombre_repartidor || "Repartidor",
          });

          // InfoWindow con información completa (se abre al hacer clic)
          const infoWindow = new (window as any).google.maps.InfoWindow({
            content: `
              <div style="padding:12px;min-width:200px;">
                <div style="font-weight:bold;font-size:14px;margin-bottom:8px;">${loc.nombre_repartidor || "Repartidor"}</div>
                <div style="font-size:12px;margin-bottom:4px;">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${loc.estado === 'disponible' ? '#22c55e' : loc.estado === 'ocupado' ? '#eab308' : '#94a3b8'};margin-right:6px;"></span>
                  ${loc.estado}
                </div>
                <div style="font-size:11px;color:#666;margin-bottom:4px;">Última: ${new Date(loc.ultima_actualizacion).toLocaleTimeString()}</div>
                <div style="font-size:11px;color:#666;">${loc.latitud?.toFixed(6)}, ${loc.longitud?.toFixed(6)}</div>
                <div style="font-size:11px;color:${color};margin-top:4px;">● Trayectoria: ${globalHistory[loc.repartidor_id]?.length || 0} puntos</div>
              </div>
            `,
          });

          marker.addListener("click", () => {
            if (globalInfoWindow) globalInfoWindow.close();
            infoWindow.open(globalMap, marker);
            globalInfoWindow = infoWindow;
          });

          globalMarkers[loc.repartidor_id] = { marker, infoWindow, loc };
          console.log("📍 Marcador creado:", loc.nombre_repartidor);
        }

        // Actualizar línea de trayectoria
        updateTrail(loc.repartidor_id, color);
      });

      // Eliminar marcadores y líneas que ya no existen
      Object.keys(globalMarkers).forEach(id => {
        if (!currentIds.has(id) && id !== "admin") {
          globalMarkers[id].marker.setMap(null);
          if (globalMarkers[id].infoWindow) globalMarkers[id].infoWindow.close();
          delete globalMarkers[id];
          if (globalPolylines[id]) {
            globalPolylines[id].setMap(null);
            delete globalPolylines[id];
          }
          delete globalHistory[id];
        }
      });
    };

    const updateTrail = (riderId: string, color: string) => {
      const history = globalHistory[riderId];
      if (!history || history.length < 2) return;

      if (globalPolylines[riderId]) {
        globalPolylines[riderId].setPath(history);
      } else {
        const polyline = new (window as any).google.maps.Polyline({
          path: history,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.7,
          strokeWeight: 3,
          map: globalMap,
        });
        globalPolylines[riderId] = polyline;
        console.log("🛣️ Trayectoria creada para:", riderId);
      }
    };

    const handleSelectRider = (riderId: string) => {
      if (globalMarkers[riderId]) {
        const { marker, loc } = globalMarkers[riderId];
        globalMap?.panTo({ lat: loc.latitud, lng: loc.longitud });
        globalMap?.setZoom(16);
        // Abrir info window
        if (globalInfoWindow) globalInfoWindow.close();
        globalMarkers[riderId].infoWindow.open(globalMap, marker);
        globalInfoWindow = globalMarkers[riderId].infoWindow;
      }
    };

    init();

    return () => {
      mountedRef.current = false;
      // NO limpiar nada para persistencia
    };
  }, []);

  return (
    <div>
      <div
        ref={mapRef}
        style={{ width: "100%", height: "400px", borderRadius: "12px", background: "#1e293b" }}
      />
      
      {/* Lista simple abajo: SOLO NOMBRES con color */}
      <div className="mt-4 bg-slate-900 rounded-xl border border-slate-800 p-4">
        <div className="flex items-center gap-3 mb-3">
          <input
            type="text"
            placeholder="Buscar repartidor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm border border-slate-700 focus:border-yellow-400 focus:outline-none"
          />
          <span className="text-slate-400 text-sm">
            {filteredRiders.length} conectados
          </span>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {filteredRiders.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">
              {searchTerm ? "No se encontraron repartidores" : "No hay repartidores con GPS activo"}
            </p>
          ) : (
            filteredRiders.map(loc => {
              const color = getColorForId(loc.repartidor_id);
              const initials = getInitials(loc.nombre_repartidor || "R");
              
              return (
                <div
                  key={loc.repartidor_id}
                  onClick={() => {
                    if (globalMarkers[loc.repartidor_id]) {
                      const { marker, loc: l } = globalMarkers[loc.repartidor_id];
                      globalMap?.panTo({ lat: l.latitud, lng: l.longitud });
                      globalMap?.setZoom(16);
                      if (globalInfoWindow) globalInfoWindow.close();
                      globalMarkers[loc.repartidor_id].infoWindow.open(globalMap, marker);
                      globalInfoWindow = globalMarkers[loc.repartidor_id].infoWindow;
                    }
                  }}
                  className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors"
                >
                  {/* Avatar con iniciales y color único */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: color }}
                  >
                    {initials}
                  </div>
                  
                  <div className="flex-1">
                    <p className="text-white text-sm font-semibold">{loc.nombre_repartidor || "Repartidor"}</p>
                    <p className="text-slate-400 text-xs">
                      {new Date(loc.ultima_actualizacion).toLocaleTimeString()}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      loc.estado === 'disponible' ? 'bg-green-500' : 
                      loc.estado === 'ocupado' ? 'bg-yellow-500' : 'bg-slate-500'
                    }`} />
                    <p className="text-slate-500 text-xs mt-1">
                      {globalHistory[loc.repartidor_id]?.length || 0} pts
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
