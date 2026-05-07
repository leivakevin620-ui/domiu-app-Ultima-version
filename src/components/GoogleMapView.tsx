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

export default function GoogleMapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const channelRef = useRef<any>(null);

  const createOrUpdateMarker = (map: any, loc: Location) => {
    if (!loc.latitud || !loc.longitud) {
      console.log("Coordenadas inválidas para:", loc.nombre_repartidor, loc);
      return;
    }

    const color = loc.estado === "disponible" ? "#22c55e" : 
                  loc.estado === "ocupado" ? "#eab308" : "#94a3b8";
    
    const position = { lat: loc.latitud, lng: loc.longitud };

    if (markersRef.current[loc.repartidor_id]) {
      // Actualizar existente
      const marker = markersRef.current[loc.repartidor_id];
      marker.setPosition(position);
      marker.setIcon({
        path: (window as any).google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2,
        scale: 8,
      });
      console.log("Marcador actualizado:", loc.nombre_repartidor);
    } else {
      // Crear nuevo
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
      markersRef.current[loc.repartidor_id] = marker;
      console.log("Marcador creado:", loc.nombre_repartidor, position);
    }
  };

  const loadLocations = async (map: any, fitBounds: boolean) => {
    try {
      const sb = getSupabaseClient();
      const { data, error } = await sb
        .from("ubicaciones_repartidores")
        .select("*")
        .order("ultima_actualizacion", { ascending: false });

      if (error) {
        console.error("Error cargando ubicaciones:", error);
        return;
      }

      console.log("Datos recibidos:", data);
      setLocations(data || []);

      if (!data || data.length === 0) {
        console.log("No hay ubicaciones para mostrar");
        return;
      }

      // Crear/actualizar marcadores
      data.forEach((loc: Location) => {
        createOrUpdateMarker(map, loc);
      });

      // Ajustar mapa solo si hay datos válidos
      if (fitBounds && data.length > 0) {
        const bounds = new (window as any).google.maps.LatLngBounds();
        let hasValid = false;
        
        data.forEach((loc: Location) => {
          if (loc.latitud && loc.longitud) {
            bounds.extend(new (window as any).google.maps.LatLng(loc.latitud, loc.longitud));
            hasValid = true;
          }
        });

        if (hasValid) {
          map.fitBounds(bounds);
          console.log("Mapa ajustado a bounds");
        }
      }
    } catch (err) {
      console.error("Error:", err);
    }
  };

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError("Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
      return;
    }

    let mounted = true;

    const initMap = async () => {
      try {
        // Cargar Google Maps
        if (!(window as any).google?.maps) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
            script.async = true;
            script.onload = () => {
              console.log("Google Maps cargado");
              resolve();
            };
            script.onerror = () => reject(new Error("Error cargando Google Maps"));
            document.head.appendChild(script);
          });
        }

        // Esperar al div
        let tries = 0;
        while (!mapRef.current && tries < 50 && mounted) {
          await new Promise(r => setTimeout(r, 100));
          tries++;
        }

        if (!mapRef.current || !mounted) return;

        const map = new (window as any).google.maps.Map(mapRef.current, {
          center: { lat: 10.4, lng: -75.5 },
          zoom: 12,
        });

        mapInstance.current = map;
        console.log("Mapa inicializado");

        // Cargar ubicaciones iniciales
        await loadLocations(map, true);
        if (mounted) setLoading(false);

        // Suscribirse a cambios (solo una vez)
        if (!channelRef.current) {
          const sb = getSupabaseClient();
          const channel = sb.channel("admin_gps_v3");
          
          channel
            .on("postgres_changes", {
              event: "*",
              schema: "public",
              table: "ubicaciones_repartidores"
            }, async (payload: any) => {
              console.log("Cambio detectado:", payload);
              if (mounted && mapInstance.current) {
                await loadLocations(mapInstance.current, false);
              }
            })
            .subscribe((status) => {
              console.log("Realtime status:", status);
            });

          channelRef.current = channel;
        }
      } catch (err: any) {
        console.error("Error inicializando:", err);
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    initMap();

    return () => {
      mounted = false;
      if (channelRef.current) {
        getSupabaseClient().removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-800 p-6 rounded-xl text-center">
        <p className="text-slate-400">Cargando GPS...</p>
      </div>
    );
  }

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
        {locations.length === 0 ? (
          <p className="text-slate-400 text-sm text-center">No hay repartidores conectados</p>
        ) : (
          locations.map(loc => (
            <div key={loc.id} className="bg-slate-800 p-3 rounded-lg flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${loc.estado === "disponible" ? "bg-green-500" : loc.estado === "ocupado" ? "bg-yellow-500" : "bg-slate-500"}`} />
                <span className="text-white text-sm">{loc.nombre_repartidor || "Repartidor"}</span>
              </div>
              <span className="text-slate-400 text-xs">{new Date(loc.ultima_actualizacion).toLocaleTimeString()}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
