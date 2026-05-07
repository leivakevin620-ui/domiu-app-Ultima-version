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

let map: any = null;
let markers: Record<string, any> = {};
let polylines: Record<string, any> = {};
let history: Record<string, Array<{lat: number, lng: number}>> = {};
let channel: any = null;

export default function GoogleMapsLive() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return locations;
    return locations.filter(l => l.nombre_repartidor?.toLowerCase().includes(search.toLowerCase()));
  }, [locations, search]);

  useEffect(() => {
    mounted.current = true;

    const init = async () => {
      if (!mounted.current) return;

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        if (mapRef.current) mapRef.current.innerHTML = '<div style="color:red;padding:20px;">Falta API Key</div>';
        return;
      }

      try {
        // Cargar Maps
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

        // Esperar div
        let tries = 0;
        while (!mapRef.current && tries < 100 && mounted.current) {
          await new Promise(r => setTimeout(r, 50));
          tries++;
        }
        if (!mapRef.current || !mounted.current) return;

        // Crear o reutilizar mapa
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

        // Cargar posiciones
        await loadPositions();

        // Suscribirse a cambios
        if (!channel) {
          const sb = getSupabaseClient();
          channel = sb
            .channel("locations_live")
            .on("postgres_changes", { event: "*", schema: "public", table: "ubicaciones_repartidores" }, () => {
              if (mounted.current) loadPositions();
            })
            .subscribe();
          console.log("📡 Realtime suscrito");
        }
      } catch (err: any) {
        console.error("Error:", err);
        if (mapRef.current) mapRef.current.innerHTML = `<div style="color:red;padding:20px;">Error: ${err.message}</div>`;
      }
    };

    const loadPositions = async () => {
      if (!map || !mounted.current) return;
      try {
        const sb = getSupabaseClient();
        const { data, error } = await sb.from("ubicaciones_repartidores").select("*");
        if (error || !data) return;
        setLocations(data);
        updateMarkers(data);
      } catch (e) { console.error("Error cargando:", e); }
    };

    const updateMarkers = (locs: Location[]) => {
      if (!map) return;
      const currentIds = new Set<string>();

      locs.forEach(loc => {
        if (!loc.latitud || !loc.longitud) return;
        currentIds.add(loc.repartidor_id);

        // Color único
        const color = getColor(loc.repartidor_id);
        const pos = { lat: loc.latitud, lng: loc.longitud };

        // Historial
        if (!history[loc.repartidor_id]) history[loc.repartidor_id] = [];
        history[loc.repartidor_id].push(pos);
        if (history[loc.repartidor_id].length > 50) history[loc.repartidor_id] = history[loc.repartidor_id].slice(-50);

        if (markers[loc.repartidor_id]) {
          // Actualizar
          markers[loc.repartidor_id].setPosition(pos);
          markers[loc.repartidor_id].setIcon({
            path: (window as any).google.maps.SymbolPath.CIRCLE,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
            scale: 8,
          });
        } else {
          // Crear marcador básico (círculo de color)
          const marker = new (window as any).google.maps.Marker({
            position: pos,
            map,
            title: loc.nombre_repartidor || "Repartidor",
            icon: {
              path: (window as any).google.maps.SymbolPath.CIRCLE,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
              scale: 8,
            },
            label: {
              text: getInitials(loc.nombre_repartidor),
              color: "#fff",
              fontSize: "10px",
              fontWeight: "bold",
            },
          });
          markers[loc.repartidor_id] = marker;
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

      // Eliminar los que ya no existen
      Object.keys(markers).forEach(id => {
        if (!currentIds.has(id)) {
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
      // NO limpiar nada
    };
  }, []);

  const selectRider = (id: string) => {
    const loc = locations.find(l => l.repartidor_id === id);
    if (loc && map) {
      map.panTo({ lat: loc.latitud, lng: loc.longitud });
      map.setZoom(16);
    }
  };

  return (
    <div>
      <div ref={mapRef} style={{ width: "100%", height: "400px", borderRadius: "12px", background: "#1e293b" }} />

      <div className="mt-4 bg-slate-900 rounded-xl border border-slate-800 p-4">
        <div className="flex items-center gap-3 mb-3">
          <input
            type="text"
            placeholder="Buscar repartidor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm border border-slate-700 focus:border-yellow-400 focus:outline-none"
          />
          <span className="text-slate-400 text-sm">{filtered.length} con GPS activo</span>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">
              {search ? "No encontrado" : "No hay repartidores con GPS activo"}
            </p>
          ) : (
            filtered.map(loc => {
              const color = getColor(loc.repartidor_id);
              const initials = getInitials(loc.nombre_repartidor || "");
              return (
                <div
                  key={loc.repartidor_id}
                  onClick={() => selectRider(loc.repartidor_id)}
                  className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: color }}>
                    {initials}
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-semibold">{loc.nombre_repartidor || "Repartidor"}</p>
                    <p className="text-slate-400 text-xs">{new Date(loc.ultima_actualizacion).toLocaleTimeString()}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block w-2 h-2 rounded-full ${loc.estado === 'disponible' ? 'bg-green-500' : loc.estado === 'ocupado' ? 'bg-yellow-500' : 'bg-slate-500'}`} />
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

function getColor(id: string) {
  const colors = ["#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f97316","#6366f1"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
  if (!name) return "?";
  const parts = name.split(" ");
  return parts.length > 1 ? (parts[0][0]+parts[1][0]).toUpperCase() : name.substring(0,2).toUpperCase();
}
