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

// Singleton para persistencia
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

// Iniciales del nombre
const getInitials = (name: string) => {
  if (!name) return "?";
  const p = name.split(" ");
  return p.length > 1 ? (p[0][0]+p[1][0]).toUpperCase() : name.substring(0,2).toUpperCase();
};

export default function GoogleMapsLive() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const [adminPos, setAdminPos] = useState<{lat: number, lng: number} | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  // Filtrar solo por búsqueda de nombre
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

        // 2. Obtener ubicación del admin
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            pos => {
              const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              setAdminPos(p);
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
            err => console.error("GPS admin error:", err),
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
            center: adminPos || { lat: 10.4, lng: -75.5 },
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

        // 5. Cargar ubicaciones iniciales
        await loadLocations();

        // 6. Suscribirse a cambios (solo una vez)
        if (!channel) {
          const sb = getSupabaseClient();
          channel = sb
            .channel("locations_realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "ubicaciones_repartidores" }, () => {
              if (mounted.current) loadLocations();
            })
            .subscribe((status: string) => console.log("Realtime:", status));
          console.log("📡 Realtime listo");
        }
      } catch (err: any) {
        console.error("Error:", err);
        if (mapRef.current) mapRef.current.innerHTML = `<div style="color:red;padding:20px">Error: ${err.message}</div>`;
      }
    };

    const loadLocations = async () => {
      if (!map || !mounted.current) return;
      try {
        const sb = getSupabaseClient();
        const { data, error } = await sb.from("ubicaciones_repartidores").select("*");
        if (error || !data) return;
        setLocations(data);
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

        // Actualizar historial
        if (!history[loc.repartidor_id]) history[loc.repartidor_id] = [];
        history[loc.repartidor_id].push(pos);
        if (history[loc.repartidor_id].length > 100) history[loc.repartidor_id] = history[loc.repartidor_id].slice(-100);

        if (markers[loc.repartidor_id]) {
          // Actualizar marcador existente
          const m = markers[loc.repartidor_id];
          m.setPosition(pos);
          m.setIcon({
            path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10 10-10-4.48-10-10-10zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3 3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.01 6-3.01s5.97 1.02 6 3.01c-1.29 1.94-3.5 3.22-6 3.22z",
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
            scale: 1.5,
            labelOrigin: new (window as any).google.maps.Point(12, 12),
          });
          m.setLabel({ text: getInitials(loc.nombre_repartidor), color: "#fff", fontSize: "10px", fontWeight: "bold" });
        } else {
          // Crear nuevo marcador
          const marker = new (window as any).google.maps.Marker({
            position: pos,
            map,
            icon: {
              path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10 10-10-4.48-10-10-10zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3 3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.01 6-3.01s5.97 1.02 6 3.01c-1.29 1.94-3.5 3.22-6 3.22z",
              fillColor: color,
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
              scale: 1.5,
              labelOrigin: new (window as any).google.maps.Point(12, 12),
            },
            label: {
              text: getInitials(loc.nombre_repartidor),
              color: "#fff",
              fontSize: "10px",
              fontWeight: "bold",
            },
            title: loc.nombre_repartidor,
          });

          // InfoWindow con toda la info (se abre al hacer clic)
          const iw = new (window as any).google.maps.InfoWindow({
            content: `
              <div style="padding:12px;min-width:200px;">
                <div style="font-weight:bold;font-size:14px;margin-bottom:8px;">${loc.nombre_repartidor}</div>
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

          marker.addListener("click", () => {
            if (infoWindow) infoWindow.close();
            iw.open(map, marker);
            infoWindow = iw;
            setSelected(loc.repartidor_id);
          });

          markers[loc.repartidor_id] = marker;
          console.log("📍 Marcador:", loc.nombre_repartidor);
        }

        // Actualizar línea de trayectoria
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
            console.log("🛣️ Trayectoria creada para:", loc.nombre_repartidor);
          }
        }
      });

      // Eliminar los que ya no están
      Object.keys(markers).forEach(id => {
        if (!currentIds.has(id) && id !== "admin") {
          markers[id].setMap(null);
          delete markers[id];
          if (polylines[id]) {
            polylines[id].setMap(null);
            delete polylines[id];
          }
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

  // Seleccionar repartidor desde la lista
  const selectRider = (id: string) => {
    setSelected(id);
    const loc = locations.find(l => l.repartidor_id === id);
    if (loc && map) {
      map.panTo({ lat: loc.latitud, lng: loc.longitud });
      map.setZoom(16);
      if (markers[id]) {
        if (infoWindow) infoWindow.close();
        markers[id].infoWindow?.open(map, markers[id]);
      }
    }
  };

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
              const isSelected = selected === loc.repartidor_id;
              return (
                <div
                  key={loc.repartidor_id}
                  onClick={() => selectRider(loc.repartidor_id)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${isSelected ? "bg-slate-700" : "hover:bg-slate-800"}`}
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
                    <span className={`inline-block w-2 h-2 rounded-full ${loc.estado === 'disponible' ? 'bg-green-500' : loc.estado === 'ocupado' ? 'bg-yellow-500' : 'bg-slate-500'}`} />
                    <p className="text-slate-500 text-xs mt-1">
                      {history[loc.repartidor_id]?.length || 0} pts
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
