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
  const [error, setError] = useState("");
  const [hasData, setHasData] = useState(false);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError("Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
      return;
    }

    let mounted = true;
    let realtimeChannel: any = null;

    const init = async () => {
      try {
        // 1. Cargar Google Maps
        if (!(window as any).google?.maps) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
            script.async = true;
            script.onload = () => {
              console.log("✅ Google Maps loaded");
              resolve();
            };
            script.onerror = () => reject(new Error("Error cargando Google Maps"));
            document.head.appendChild(script);
          });
        }

        // 2. Esperar al div del mapa
        let tries = 0;
        while (!mapRef.current && tries < 100 && mounted) {
          await new Promise(r => setTimeout(r, 50));
          tries++;
        }

        if (!mapRef.current || !mounted) return;

        // 3. Crear mapa
        const map = new (window as any).google.maps.Map(mapRef.current, {
          center: { lat: 10.4, lng: -75.5 },
          zoom: 12,
          mapTypeId: "roadmap",
        });

        mapInstance.current = map;
        console.log("✅ Mapa creado");

        // 4. Cargar ubicaciones iniciales
        const sb = getSupabaseClient();
        const { data, error: dbError } = await sb
          .from("ubicaciones_repartidores")
          .select("*");

        if (dbError) {
          console.error("❌ Error DB:", dbError);
          setError("Error cargando ubicaciones");
          return;
        }

        console.log("📍 Datos recibidos:", data);

        if (data && data.length > 0) {
          setHasData(true);
          updateMarkers(data, true); // true = primera vez, ajustar mapa
        } else {
          console.log("⚠️ No hay datos en ubicaciones_repartidores");
          setHasData(false);
        }

        // 5. Suscribirse a cambios (realtime)
        realtimeChannel = sb.channel("gps_admin_simple");
        realtimeChannel
          .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "ubicaciones_repartidores"
          }, (payload: any) => {
            console.log("🔄 Cambio detectado:", payload);
            if (!mounted) return;
            
            // Recargar datos
            sb.from("ubicaciones_repartidores")
              .select("*")
              .then(({ data: newData }) => {
                if (newData && mounted) {
                  setHasData(newData.length > 0);
                  updateMarkers(newData, false); // false = no ajustar mapa
                }
              });
          })
          .subscribe((status: string) => {
            console.log("📡 Realtime status:", status);
          });

      } catch (err: any) {
        console.error("❌ Error inicializando:", err);
        if (mounted) setError(err.message);
      }
    };

    init();

    return () => {
      mounted = false;
      if (realtimeChannel) {
        getSupabaseClient().removeChannel(realtimeChannel);
      }
    };
  }, []);

  const updateMarkers = (locations: Location[], firstTime: boolean) => {
    const map = mapInstance.current;
    if (!map) return;

    const bounds = new (window as any).google.maps.LatLngBounds();
    let hasValidLocation = false;

    locations.forEach(loc => {
      if (!loc.latitud || !loc.longitud) return;

      const color = loc.estado === "disponible" ? "#22c55e" : 
                    loc.estado === "ocupado" ? "#eab308" : "#94a3b8";

      const position = { lat: loc.latitud, lng: loc.longitud };

      if (markersRef.current[loc.repartidor_id]) {
        // Actualizar marcador existente (sin recrear)
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
        markersRef.current[loc.repartidor_id] = marker;
        console.log("📌 Marcador creado:", loc.nombre_repartidor, position);
      }

      bounds.extend(new (window as any).google.maps.LatLng(loc.latitud, loc.longitud));
      hasValidLocation = true;
    });

    // Solo ajustar el mapa la primera vez
    if (firstTime && hasValidLocation) {
      map.fitBounds(bounds);
      console.log("🗺️ Mapa ajustado a bounds");
    }
  };

  if (error) {
    return (
      <div className="bg-slate-800 p-6 rounded-xl text-center">
        <p className="text-red-400 font-bold">Error: {error}</p>
        <p className="text-slate-400 text-sm mt-2">
          Verifica la API Key y que el dominio esté autorizado en Google Cloud Console
        </p>
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
          <p className="text-slate-400 text-sm">
            No hay repartidores conectados. Para ver el GPS, asegúrate de que los repartidores tengan el GPS activado en su app.
          </p>
        </div>
      )}
    </div>
  );
}
