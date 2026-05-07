"use client";

import { useEffect, useRef } from "react";
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

// Variables verdaderamente globales (fuera del componente)
let _mapInstance: any = null;
let _markers: Record<string, any> = {};
let _firstLoad = true;
let _pollInterval: any = null;

export default function GoogleMapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      if (!mountedRef.current) return;

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        if (mapRef.current) {
          mapRef.current.innerHTML = '<div style="color:red;padding:20px;">Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</div>';
        }
        return;
      }

      try {
        // 1. Cargar Google Maps (una sola vez globalmente)
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

        // 2. Esperar al div
        let tries = 0;
        while (!mapRef.current && tries < 100 && mountedRef.current) {
          await new Promise(r => setTimeout(r, 50));
          tries++;
        }

        if (!mapRef.current || !mountedRef.current) return;

        // 3. Crear mapa UNA sola vez
        if (!_mapInstance) {
          _mapInstance = new (window as any).google.maps.Map(mapRef.current, {
            center: { lat: 10.4, lng: -75.5 },
            zoom: 12,
          });
          console.log("✅ Mapa creado (PERSISTENTE)");
        } else {
          // Mover el div del mapa a este contenedor
          const oldDiv = _mapInstance.getDiv();
          if (oldDiv && oldDiv.parentNode) {
            oldDiv.parentNode.removeChild(oldDiv);
          }
          mapRef.current.appendChild(_mapInstance.getDiv());
          console.log("♻️ Mapa movido (sin recrear)");
        }

        // 4. Cargar datos iniciales
        await loadAndUpdate();

        // 5. Polling cada 30 segundos (solo una vez)
        if (!_pollInterval) {
          _pollInterval = setInterval(loadAndUpdate, 30000);
          console.log("⏱️ Polling cada 30s");
        }

      } catch (err: any) {
        console.error("Error:", err);
        if (mapRef.current) {
          mapRef.current.innerHTML = `<div style="color:red;padding:20px;">Error: ${err.message}</div>`;
        }
      }
    };

    const loadAndUpdate = async () => {
      if (!_mapInstance || !mountedRef.current) return;

      try {
        const sb = getSupabaseClient();
        const { data, error } = await sb
          .from("ubicaciones_repartidores")
          .select("*");

        if (error || !data || !mountedRef.current) return;

        updateMarkers(data);
      } catch (e) {
        console.error("Error cargando:", e);
      }
    };

    const updateMarkers = (locs: Location[]) => {
      if (!_mapInstance) return;

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
          // Actualizar marcador existente (SIN recrear)
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
            map: _mapInstance,
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

          marker.addListener("click", () => info.open(_mapInstance, marker));
          _markers[loc.repartidor_id] = marker;
          console.log("📍 Marcador:", loc.nombre_repartidor);
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
      if (_firstLoad && hasValid) {
        _mapInstance.fitBounds(bounds);
        _firstLoad = false;
        console.log("🗺️ Bounds ajustados (una vez)");
      }
    };

    init();

    return () => {
      mountedRef.current = false;
      // NO limpiar _mapInstance, _markers, ni _pollInterval
      // Esto hace que el mapa sea COMPLETAMENTE persistente
    };
  }, []);

  return (
    <div>
      <div
        ref={mapRef}
        style={{ width: "100%", height: "400px", borderRadius: "12px", background: "#1e293b" }}
      />
    </div>
  );
}
