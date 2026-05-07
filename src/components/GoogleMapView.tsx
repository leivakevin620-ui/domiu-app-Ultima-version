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

// Variables persistentes FUERA del componente
let persistentMap: any = null;
let persistentMarkers: Record<string, any> = {};
let boundsSet = false;

export default function GoogleMapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [hasData, setHasData] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          setError("Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
          return;
        }

        // Cargar Google Maps UNA vez
        if (!(window as any).google?.maps) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
            script.async = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error("Error cargando Google Maps"));
            document.head.appendChild(script);
          });
        }

        // Esperar al div
        let tries = 0;
        while (!mapRef.current && tries < 50 && mountedRef.current) {
          await new Promise(r => setTimeout(r, 100));
          tries++;
        }

        if (!mapRef.current || !mountedRef.current) return;

        // Crear mapa solo si no existe
        if (!persistentMap) {
          persistentMap = new (window as any).google.maps.Map(mapRef.current, {
            center: { lat: 10.4, lng: -75.5 },
            zoom: 12,
          });
          console.log("✅ Mapa creado (una sola vez)");
        } else {
          // Reutilizar mapa existente
          const div = persistentMap.getDiv();
          if (div && div.parentNode) {
            div.parentNode.removeChild(div);
          }
          mapRef.current.appendChild(persistentMap.getDiv());
          console.log("♻️ Mapa reutilizado");
        }

        // Cargar datos iniciales
        await loadAndUpdate();

        // Polling cada 5 segundos (en lugar de Realtime)
        intervalRef.current = setInterval(loadAndUpdate, 5000);
        console.log("⏱️ Polling iniciado (5 seg)");

      } catch (err: any) {
        console.error("Error:", err);
        if (mountedRef.current) setError(err.message);
      }
    };

    const loadAndUpdate = async () => {
      if (!persistentMap || !mountedRef.current) return;

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
      const map = persistentMap;
      if (!map) return;

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

        if (persistentMarkers[loc.repartidor_id]) {
          // Actualizar marcador existente (sin recrear)
          const marker = persistentMarkers[loc.repartidor_id];
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
          });

          const info = new (window as any).google.maps.InfoWindow({
            content: `<div style="padding:8px"><strong>${loc.nombre_repartidor || "Repartidor"}</strong><br/>Estado: ${loc.estado}<br/>${new Date(loc.ultima_actualizacion).toLocaleTimeString()}</div>`,
          });

          marker.addListener("click", () => info.open(map, marker));
          persistentMarkers[loc.repartidor_id] = marker;
        }

        bounds.extend(new (window as any).google.maps.LatLng(loc.latitud, loc.longitud));
      });

      // Eliminar marcadores que ya no existen
      Object.keys(persistentMarkers).forEach(id => {
        if (!currentIds.has(id)) {
          persistentMarkers[id].setMap(null);
          delete persistentMarkers[id];
        }
      });

      // Ajustar bounds SOLO la primera vez
      if (!boundsSet && hasValid) {
        map.fitBounds(bounds);
        boundsSet = true;
        console.log("🗺️ Bounds ajustados (una sola vez)");
      }
    };

    init();

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log("⏱️ Polling detenido");
      }
      // NO limpiar persistentMap ni persistentMarkers
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
