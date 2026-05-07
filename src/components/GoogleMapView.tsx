"use client";

import { useEffect, useRef, useState } from "react";

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
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Crear marcadores para la URL de Static Maps
  const getMarkersUrl = (locs: Location[]) => {
    return locs
      .filter(loc => loc.latitud && loc.longitud)
      .map(loc => {
        const color = loc.estado === "disponible" ? "green" : 
                     loc.estado === "ocupado" ? "yellow" : "gray";
        return `markers=color:${color}|${loc.latitud},${loc.longitud}`;
      })
      .join("&");
  };

  // Obtener el centro del mapa
  const getCenter = (locs: Location[]) => {
    const valid = locs.filter(loc => loc.latitud && loc.longitud);
    if (valid.length === 0) return "10.4,-75.5";
    const avgLat = valid.reduce((sum, loc) => sum + loc.latitud, 0) / valid.length;
    const avgLng = valid.reduce((sum, loc) => sum + loc.longitud, 0) / valid.length;
    return `${avgLat},${avgLng}`;
  };

  useEffect(() => {
    mountedRef.current = true;

    const loadData = async () => {
      try {
        const sb = (await import("@/lib/supabase")).getSupabaseClient();
        const { data, error } = await sb
          .from("ubicaciones_repartidores")
          .select("*");

        if (error) {
          console.error("Error:", error);
          return;
        }

        if (mountedRef.current && data) {
          setLocations(data);
          setLoading(false);
        }
      } catch (e) {
        console.error("Error cargando:", e);
      }
    };

    loadData();
    
    // Actualizar cada 30 segundos
    intervalRef.current = setInterval(loadData, 30000);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-800 p-8 rounded-xl text-center">
        <p className="text-slate-400">Cargando ubicaciones...</p>
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

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const center = getCenter(locations);
  const markers = getMarkersUrl(locations);
  const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=12&size=600x400&${markers}&key=${apiKey}`;

  return (
    <div>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-yellow-400">📍</span> GPS en Tiempo Real (Actualiza cada 30s)
        </h3>
        
        {apiKey ? (
          <img
            src={mapUrl}
            alt="Mapa GPS"
            className="w-full rounded-xl"
            style={{ height: "400px", objectFit: "cover" }}
          />
        ) : (
          <div className="bg-slate-800 p-8 rounded-xl text-center">
            <p className="text-red-400">Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</p>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {locations.length === 0 ? (
            <p className="text-slate-400 text-sm text-center">No hay repartidores conectados</p>
          ) : (
            locations.map(loc => (
              <div key={loc.id} className="bg-slate-800 p-3 rounded-lg flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    loc.estado === "disponible" ? "bg-green-500" : 
                    loc.estado === "ocupado" ? "bg-yellow-500" : "bg-slate-500"
                  }`} />
                  <span className="text-white text-sm">{loc.nombre_repartidor || "Repartidor"}</span>
                </div>
                <span className="text-slate-400 text-xs">
                  {loc.latitud?.toFixed(4)}, {loc.longitud?.toFixed(4)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
