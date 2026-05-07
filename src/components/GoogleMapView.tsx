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

// Variables persistentes a nivel de módulo
let globalMap: any = null;
let globalMarkers: Record<string, any> = {};
let mapInitialized = false;

export default function GoogleMapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [hasData, setHasData] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    const initMap = async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          setError("Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
          return;
        }

        // Cargar Google Maps una sola vez
        if (!(window as any).google?.maps) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
            script.async = true;
            script.onload = () => resolve();
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

        // Si el mapa ya existe globalmente, moverlo al nuevo div
        if (globalMap && mapRef.current.children.length === 0) {
          const oldDiv = globalMap.getDiv();
          if (oldDiv && oldDiv.parentNode) {
            oldDiv.parentNode.removeChild(oldDiv);
          }
          mapRef.current.appendChild(globalMap.getDiv());
          console.log("♻️ Mapa reutilizado");
        } else if (!globalMap) {
          // Crear mapa por primera vez
          globalMap = new (window as any).google.maps.Map(mapRef.current, {
            center: { lat: 10.4, lng: -75.5 },
            zoom: 12,
            mapTypeId: "roadmap",
          });
          console.log("✅ Mapa creado (primera vez)");
        }

        // Cargar ubicaciones iniciales
        const sb = getSupabaseClient();
        const { data } = await sb
          .from("ubicaciones_repartidores")
          .select("*");

        if (data && mountedRef.current) {
          setLocations(data);
          setHasData(data.length > 0);
          updateMarkers(data);
          
          // Solo ajustar bounds la primera vez
          if (!mapInitialized && data.length > 0) {
            const bounds = new (window as any).google.maps.LatLngBounds();
            data.forEach((loc: Location) => {
              if (loc.latitud && loc.longitud) {
                bounds.extend(new (window as any).google.maps.LatLng(loc.latitud, loc.longitud));
              }
            });
            globalMap.fitBounds(bounds);
            mapInitialized = true;
            console.log("🗺️ Bounds ajustados (primera vez)");
          }
        }

        // Suscribirse a cambios (solo una vez)
        if (!globalMap._channel) {
          const channel = sb.channel("gps_admin_stable_v4");
          channel
            .on("postgres_changes", {
              event: "*",
              schema: "public",
              table: "ubicaciones_repartidores"
            }, async (payload: any) => {
              if (!mountedRef.current) return;
              
              const { data: newData } = await sb
                .from("ubicaciones_repartidores")
                .select("*");
              
              if (newData && mountedRef.current) {
                setLocations(newData);
                setHasData(newData.length > 0);
                updateMarkers(newData);
              }
            })
            .subscribe();
          
          globalMap._channel = channel;
          console.log("📡 Realtime suscrito");
        }

      } catch (err: any) {
        console.error("Error:", err);
        if (mountedRef.current) setError(err.message);
      }
    };

    initMap();

    return () => {
      mountedRef.current = false;
      // No limpiar globalMap al desmontar para reutilizarlo
    };
  }, []);

  const updateMarkers = (locs: Location[]) => {
    if (!globalMap) return;

    const currentIds = new Set<string>();

    locs.forEach(loc => {
      if (!loc.latitud || !loc.longitud) return;
      currentIds.add(loc.repartidor_id);

      const color = loc.estado === "disponible" ? "#22c55e" : 
                    loc.estado === "ocupado" ? "#eab308" : "#94a3b8";
      
      const position = { lat: loc.latitud, lng: loc.longitud };

      if (globalMarkers[loc.repartidor_id]) {
        // Actualizar marcador existente (sin recrear)
        const marker = globalMarkers[loc.repartidor_id];
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
          map: globalMap,
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

        marker.addListener("click", () => info.open(globalMap, marker));
        globalMarkers[loc.repartidor_id] = marker;
      }
    });

    // Eliminar marcadores que ya no existen
    Object.keys(globalMarkers).forEach(id => {
      if (!currentIds.has(id)) {
        globalMarkers[id].setMap(null);
        delete globalMarkers[id];
      }
    });
  };

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
      <div className="mt-4 space-y-2">
        {!hasData && (
          <p className="text-slate-400 text-sm text-center">No hay repartidores conectados</p>
        )}
      </div>
    </div>
  );
}
