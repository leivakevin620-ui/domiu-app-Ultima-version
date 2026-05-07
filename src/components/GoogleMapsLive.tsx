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

let map: any = null;
let markers: any = {};

export default function GoogleMapsLive() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const [status, setStatus] = useState<string>("Iniciando...");
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    mounted.current = true;

    const init = async () => {
      if (!mounted.current) return;

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      console.log("🔑 API Key:", apiKey ? "OK" : "FALTA");
      setStatus(`🔑 API Key: ${apiKey ? "OK" : "FALTA"}`);

      if (!apiKey) {
        setStatus("❌ FALTA NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
        return;
      }

      try {
        // 1. Cargar Google Maps
        if (!(window as any).google?.maps) {
          setStatus("🔄 Cargando Google Maps...");
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
            script.async = true;
            script.onload = () => {
              console.log("✅ Maps loaded");
              setStatus("✅ Maps cargado");
              resolve();
            };
            script.onerror = () => {
              console.error("❌ Error cargando Maps");
              reject(new Error("Error cargando Maps"));
            };
            document.head.appendChild(script);
          });
        } else {
          setStatus("✅ Maps ya estaba cargado");
        }

        // 2. Esperar div
        setStatus("🔄 Esperando contenedor...");
        let tries = 0;
        while (!mapRef.current && tries < 100 && mounted.current) {
          await new Promise(r => setTimeout(r, 50));
          tries++;
        }

        if (!mapRef.current) {
          setStatus("❌ No se encontró el div del mapa");
          return;
        }

        // 3. Crear mapa
        if (!map) {
          setStatus("🔄 Creando mapa...");
          map = new (window as any).google.maps.Map(mapRef.current, {
            center: { lat: 10.4, lng: -75.5 },
            zoom: 14,
          });
          console.log("✅ Mapa creado");
          setStatus("✅ Mapa creado");
        } else {
          // Mover a este div
          const div = map.getDiv();
          if (div && div.parentNode) {
            div.parentNode.removeChild(div);
          }
          mapRef.current.appendChild(map.getDiv());
          setStatus("✅ Mapa reutilizado");
        }

        // 4. Marcador de prueba (siempre visible)
        if (!markers["test"]) {
          setStatus("🔄 Creando marcador de prueba...");
          markers["test"] = new (window as any).google.maps.Marker({
            position: { lat: 10.4, lng: -75.5 },
            map,
            title: "MARCADOR DE PRUEBA",
            label: {
              text: "PRUEBA",
              color: "#000",
              fontSize: "14px",
              fontWeight: "bold",
            },
          });
          console.log("🧪 Marcador de prueba creado");
          setStatus("✅ Marcador de prueba visible");
        }

        // 5. Cargar ubicaciones
        setStatus("🔄 Cargando ubicaciones...");
        await loadPositions();

        // 6. Suscribirse a cambios
        const sb = getSupabaseClient();
        const channel = sb
          .channel("simple_test")
          .on("postgres_changes", { event: "*", schema: "public", table: "ubicaciones_repartidores" }, () => {
            if (mounted.current) {
              console.log("🔄 Cambio detectado");
              loadPositions();
            }
          })
          .subscribe((status: string) => {
            console.log("Realtime:", status);
            if (status === "SUBSCRIBED") {
              setStatus(`✅ Mapa listo - ${locations.length} ubicaciones`);
            }
          });

        console.log("📡 Realtime suscrito");

      } catch (err: any) {
        console.error("❌ Error:", err);
        setStatus(`❌ Error: ${err.message}`);
      }
    };

    const loadPositions = async () => {
      if (!map || !mounted.current) return;
      try {
        const sb = getSupabaseClient();
        const { data, error } = await sb.from("ubicaciones_repartidores").select("*");
        
        if (error) {
          console.error("❌ Error Supabase:", error);
          setStatus(`❌ Error Supabase: ${error.message}`);
          return;
        }

        console.log("📍 Datos recibidos:", data?.length || 0);
        setLocations(data || []);
        setStatus(`✅ ${data?.length || 0} ubicaciones encontradas`);

        if (!data || data.length === 0) {
          console.log("⚠️ No hay ubicaciones");
          return;
        }

        // Actualizar marcadores
        updateMarkers(data);
      } catch (e: any) {
        console.error("❌ Error cargando:", e);
        setStatus(`❌ Error cargando: ${e.message}`);
      }
    };

    const updateMarkers = (locs: Location[]) => {
      if (!map) return;
      const currentIds = new Set<string>();

      locs.forEach(loc => {
        if (!loc.latitud || !loc.longitud) {
          console.log("⚠️ Coordenadas inválidas:", loc.nombre_repartidor);
          return;
        }
        currentIds.add(loc.repartidor_id);

        const pos = { lat: loc.latitud, lng: loc.longitud };

        if (markers[loc.repartidor_id]) {
          // Actualizar
          markers[loc.repartidor_id].setPosition(pos);
          console.log("🔄 Actualizado:", loc.nombre_repartidor);
        } else {
          // Crear nuevo marcador básico
          console.log("📍 Creando marcador para:", loc.nombre_repartidor);
          markers[loc.repartidor_id] = new (window as any).google.maps.Marker({
            position: pos,
            map,
            title: loc.nombre_repartidor || "Repartidor",
            label: {
              text: (loc.nombre_repartidor || "R").substring(0, 8),
              color: "#fff",
              fontSize: "12px",
              fontWeight: "bold",
            },
          });
          setStatus(`✅ ${Object.keys(markers).length} marcadores visibles`);
        }
      });

      // Eliminar los que ya no están
      Object.keys(markers).forEach(id => {
        if (!currentIds.has(id) && id !== "test") {
          markers[id].setMap(null);
          delete markers[id];
        }
      });
    };

    init();

    return () => {
      mounted.current = false;
    };
  }, []);

  return (
    <div>
      {/* Estado actual */}
      <div className="mb-4 bg-slate-800 p-3 rounded-xl text-sm text-slate-300">
        {status}
      </div>

      {/* Mapa */}
      <div
        ref={mapRef}
        style={{ width: "100%", height: "500px", borderRadius: "12px", background: "#1e293b" }}
      />

      {/* Lista de debug */}
      <div className="mt-4 bg-slate-900 rounded-xl border border-slate-800 p-4">
        <h4 className="text-white font-bold mb-2">Debug - {locations.length} repartidores:</h4>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {locations.length === 0 ? (
            <p className="text-slate-500 text-sm">No hay ubicaciones. Asegúrate que los repartidores tengan el GPS activo.</p>
          ) : (
            locations.map(loc => (
              <div key={loc.repartidor_id} className="text-xs text-slate-400">
                📍 {loc.nombre_repartidor} - {loc.latitud?.toFixed(4)}, {loc.longitud?.toFixed(4)} - {loc.estado}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
