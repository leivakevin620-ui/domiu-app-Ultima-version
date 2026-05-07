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

// Instancia única GLOBAL (persiste entre renders)
let _map: any = null;
let _markers: Record<string, any> = {};
let _boundsSet = false;
let _interval: NodeJS.Timeout | null = null;

export default function GoogleMapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [hasData, setHasData] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          setError("Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
          return;
        }

        // 1. Cargar Google Maps (una sola vez globalmente)
        if (!(window as any).google?.maps) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
            script.async = true;
            script.onload = () => {
              console.log("✅ Google Maps cargado");
              resolve();
            };
            script.onerror = () => reject(new Error("Error cargando Google Maps"));
            document.head.appendChild(script);
          });
        }

        // 2. Esperar al div
        let tries = 0;
        while (!mapRef.current && tries < 100 && mountedRef.current) {
          await new Promise(r => setTimeout(r, 50));
          tries++;
        }

        if (!mapRef.current || !mountedRef.current) return;

        // 3. Crear mapa UNA sola vez (global)
        if (!_map) {
          _map = new (window as any).google.maps.Map(mapRef.current, {
            center: { lat: 10.4, lng: -75.5 },
            zoom: 12,
          });
          console.log("✅ Mapa creado (única vez)");
        } else {
          // Mover mapa existente al nuevo div
          const div = _map.getDiv();
          if (div && div.parentNode) {
            div.parentNode.removeChild(div);
          }
          mapRef.current.appendChild(_map.getDiv());
          console.log("♻️ Mapa reutilizado (no se recrea)");
        }

        // 4. Cargar datos iniciales
        await loadData();

        // 5. Iniciar polling (solo una vez globalmente)
        if (!_interval) {
          _interval = setInterval(loadData, 30000); // 30 segundos
          console.log("⏱️ Polling iniciado (30s)");
        }

      } catch (err: any) {
        console.error("Error:", err);
        if (mountedRef.current) setError(err.message);
      }
    };

    const loadData = async () => {
      if (!_map || !mountedRef.current) return;

      try {
        const sb = getSupabaseClient();
        const { data, error } = await sb
          .from("ubicaciones_repartidores")
          .select("*");

        if (error || !data || !mountedRef.current) return;

        setHasData(data.length > 0);
        updateMarkers(data);
      } catch (e) {
        console.error("Error cargando:", e);
      }
    };

    const updateMarkers = (locs: Location[]) => {
      if (!_map) return;

      const bounds = new (window as any).google.maps.LatLngBounds();
      const currentIds = new Set<string>();
      let hasValid = false;

      locs.forEach(loc => {
        if (!loc.latitud || !loc.longitud) return;
        currentIds.add(loc.repartidor_id);
        hasValid = true;

        const color = loc.estado === "disponible" ? "#22c55e" : 
                      loc.estado === "ocupado" ? "#eab308" : "#94a3b8";

        const position = { lat: loc.latitud, lng: loc.longitud };

        if (_markers[loc.repartidor_id]) {
          // Actualizar marcador existente (sin recrear)
          const marker = _markers[loc.repartidor_id];
          marker.setPosition(position);
          marker.setIcon({
            path: (window as any).google.maps.SymbolPath.CIRCLE,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
            scale: 8,
          });
        } else {
          // Crear nuevo marcador
          const marker = new (window as any).google.maps.Marker({
            position,
            map: _map,
            title: loc.nombre_repartidor || "Repartidor",
            icon: {
              path: (window as any).google.maps.SymbolPath.CIRCLE,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
              scale: 8,
            },
          });

          const info = new (window as any).google.maps.InfoWindow({
            content: `<div style="padding:8px"><strong>${loc.nombre_repartidor || "Repartidor"}</strong><br/>Estado: ${loc.estado}<br/>${new Date(loc.ultima_actualizacion).toLocaleTimeString()}</div>`,
          });

          marker.addListener("click", () => info.open(_map, marker));
          _markers[loc.repartidor_id] = marker;
          console.log("📌 Marcador:", loc.nombre_repartidor);
        }

        bounds.extend(new (window as any).google.maps.LatLng(loc.latitud, loc.longitud));
      });

      // Eliminar marcadores que ya no existen
      Object.keys(_markers).forEach(id => {
        if (!currentIds.has(id)) {
          _markers[id].setMap(null);
          delete _markers[id];
        }
      });

      // Ajustar bounds SOLO la primera vez
      if (!_boundsSet && hasValid) {
        _map.fitBounds(bounds);
        _boundsSet = true;
        console.log("🗺️ Bounds ajustados (una sola vez)");
      }
    };

    init();

    return () => {
      mountedRef.current = false;
      // NO limpiar _map, _markers, ni _interval
      // Esto evita que el mapa parpadee al desmontar
    };
  }, []);

  if (error) {
    return (
      <div className="bg-slate-800 p-6 rounded-xl text-center">
        <p className="text-red-400 font-bold">Error: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <div
        ref={mapRef}
        style={{ width: "100%", height: "400px", borderRadius: "12px", background: "#1e293b" }}
      />
      {!hasData && (
        <div className="mt-4 bg-slate-800 p-4 rounded-xl text-center">
          <p className="text-slate-400 text-sm">No hay repartidores conectados</p>
        </div>
      )}
    </div>
  );
}
