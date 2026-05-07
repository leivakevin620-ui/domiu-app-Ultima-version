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
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

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
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Error cargando Google Maps"));
            document.head.appendChild(script);
          });
        }

        // Esperar al div
        if (!mapRef.current) {
          await new Promise(r => setTimeout(r, 500));
        }

        if (!mapRef.current || !mounted) return;

        const map = new (window as any).google.maps.Map(mapRef.current, {
          center: { lat: 10.4, lng: -75.5 },
          zoom: 12,
          mapTypeId: "roadmap",
        });

        mapInstance.current = map;

        // Cargar ubicaciones
        const sb = getSupabaseClient();
        const { data } = await sb
          .from("ubicaciones_repartidores")
          .select("*")
          .order("ultima_actualizacion", { ascending: false });

        if (data && mounted) {
          setLocations(data);
          updateMarkers(data);
        }

        // Tiempo real
        const channel = sb
          .channel("admin_gps_map")
          .on("postgres_changes", { event: "*", schema: "public", table: "ubicaciones_repartidores" }, async () => {
            const { data: newData } = await sb
              .from("ubicaciones_repartidores")
              .select("*")
              .order("ultima_actualizacion", { ascending: false });
            if (newData && mounted) {
              setLocations(newData);
              updateMarkers(newData);
            }
          })
          .subscribe();

        return () => {
          sb.removeChannel(channel);
        };
      } catch (err: any) {
        if (mounted) setError(err.message);
      }
    };

    initMap();

    return () => { mounted = false; };
  }, []);

  const updateMarkers = (locs: Location[]) => {
    if (!mapInstance.current) return;

    // Limpiar marcadores
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const bounds = new (window as any).google.maps.LatLngBounds();

    locs.forEach(loc => {
      if (!loc.latitud || !loc.longitud) return;

      const color = loc.estado === "disponible" ? "#22c55e" : loc.estado === "ocupado" ? "#eab308" : "#94a3b8";

      const marker = new (window as any).google.maps.Marker({
        position: { lat: loc.latitud, lng: loc.longitud },
        map: mapInstance.current,
        title: loc.nombre_repartidor,
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
        content: `<b>${loc.nombre_repartidor}</b><br>Estado: ${loc.estado}<br>${new Date(loc.ultima_actualizacion).toLocaleTimeString()}`,
      });

      marker.addListener("click", () => info.open(mapInstance.current, marker));
      markersRef.current.push(marker);
      bounds.extend(new (window as any).google.maps.LatLng(loc.latitud, loc.longitud));
    });

    if (locs.length > 0) mapInstance.current.fitBounds(bounds);
  };

  if (error) {
    return (
      <div className="bg-slate-800 p-6 rounded-xl text-center">
        <p className="text-red-400 font-bold">Error GPS: {error}</p>
        <p className="text-slate-400 text-sm mt-2">Verifica la API Key en Vercel y autoriza el dominio en Google Cloud Console</p>
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
        {locations.map(loc => (
          <div key={loc.id} className="bg-slate-800 p-3 rounded-lg flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${loc.estado === "disponible" ? "bg-green-500" : loc.estado === "ocupado" ? "bg-yellow-500" : "bg-slate-500"}`} />
              <span className="text-white text-sm">{loc.nombre_repartidor}</span>
            </div>
            <span className="text-slate-400 text-xs">{new Date(loc.ultima_actualizacion).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
