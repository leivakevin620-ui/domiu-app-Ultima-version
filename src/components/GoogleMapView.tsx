"use client";

import { useEffect, useState } from "react";
import { GoogleMap, MarkerF, InfoWindowF, useJsApiLoader } from "@react-google-maps/api";
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

interface GoogleMapViewProps {
  repartidores: Location[];
}

const containerStyle = {
  width: "100%",
  height: "500px",
  borderRadius: "12px",
};

const center = {
  lat: 10.4,
  lng: -75.5,
};

const colors: Record<string, string> = {
  disponible: "#22c55e",
  ocupado: "#eab308",
  desconectado: "#94a3b8",
};

export default function GoogleMapView({ repartidores }: GoogleMapViewProps) {
  const [locations, setLocations] = useState<Location[]>(repartidores || []);
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const channelRef = useRef<any>(null);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  useEffect(() => {
    if (!isLoaded) return;

    const sb = getSupabaseClient();

    const channel = sb
      .channel("gps_realtime_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "ubicaciones_repartidores" }, () => {
        loadLocations();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        sb.removeChannel(channelRef.current);
      }
    };
  }, [isLoaded]);

  function loadLocations() {
    const sb = getSupabaseClient();
    sb.from("ubicaciones_repartidores")
      .select("*")
      .order("ultima_actualizacion", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setLocations(data);
        }
      });
  }

  if (!isLoaded) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", height: "500px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        Cargando mapa...
      </div>
    );
  }

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "#ef4444", height: "500px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        Falta configurar Google Maps API Key en .env.local
      </div>
    );
  }

  const validLocations = locations.filter((loc) => loc.latitud && loc.longitud);

  return (
    <div>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={12}
        onLoad={(map) => setMap(map)}
        options={{
          zoomControl: true,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        }}
      >
        {validLocations.map((loc) => (
          <MarkerF
            key={loc.repartidor_id}
            position={{ lat: loc.latitud, lng: loc.longitud }}
            title={loc.nombre_repartidor || "Repartidor"}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: colors[loc.estado] || colors.desconectado,
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 3,
              scale: 10,
            }}
            onClick={() => setSelectedMarker(loc.repartidor_id)}
          >
            {selectedMarker === loc.repartidor_id && (
              <InfoWindowF
                onCloseClick={() => setSelectedMarker(null)}
              >
                <div>
                  <strong>{loc.nombre_repartidor || "Repartidor"}</strong>
                  <br />
                  Estado: {loc.estado}
                  <br />
                  Actualizado: {new Date(loc.ultima_actualizacion).toLocaleTimeString()}
                </div>
              </InfoWindowF>
            )}
          </MarkerF>
        ))}
      </GoogleMap>

      <div style={{ marginTop: "16px" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>
          Repartidores conectados ({validLocations.length})
        </h3>
        {validLocations.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: "14px" }}>No hay repartidores conectados</p>
        ) : (
          validLocations.map((loc) => (
            <div
              key={loc.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                background: "#1e293b",
                borderRadius: "8px",
                marginBottom: "8px",
                border: "1px solid #334155",
              }}
            >
              <div>
                <strong style={{ fontSize: "14px", color: "#f8fafc" }}>
                  {loc.nombre_repartidor || "Repartidor"}
                </strong>
                <span
                  style={{
                    marginLeft: "8px",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 600,
                    background:
                      loc.estado === "disponible"
                        ? "#166534"
                        : loc.estado === "ocupado"
                        ? "#854d0e"
                        : "#334155",
                    color:
                      loc.estado === "disponible"
                        ? "#86efac"
                        : loc.estado === "ocupado"
                        ? "#fef08a"
                        : "#94a3b8",
                  }}
                >
                  {loc.estado}
                </span>
              </div>
              <div style={{ textAlign: "right", fontSize: "12px", color: "#64748b" }}>
                <div>
                  {loc.latitud?.toFixed(6)}, {loc.longitud?.toFixed(6)}
                </div>
                <div>{new Date(loc.ultima_actualizacion).toLocaleTimeString()}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
