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

// Global singleton to persist map and markers across remounts
let globalMap: any = null;
let globalMarkers: Record<string, any> = {};
let globalChannel: any = null;
let globalInitialized = false;

export default function GoogleMapsLive() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      if (!mountedRef.current) return;

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        if (mapRef.current) {
          mapRef.current.innerHTML = '<div style="color:red;padding:20px;">Falta API Key</div>';
        }
        return;
      }

      try {
        // Load Google Maps JS API once
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

        // Wait for div
        let tries = 0;
        while (!mapRef.current && tries < 100 && mountedRef.current) {
          await new Promise(r => setTimeout(r, 50));
          tries++;
        }

        if (!mapRef.current || !mountedRef.current) return;

        if (!globalMap) {
          globalMap = new (window as any).google.maps.Map(mapRef.current, {
            center: { lat: 10.4, lng: -75.5 },
            zoom: 12,
            mapTypeId: "roadmap",
          });
          console.log("✅ Map created (singleton)");
        } else {
          // Move map to this div
          const div = globalMap.getDiv();
          if (div && div.parentNode) {
            div.parentNode.removeChild(div);
          }
          mapRef.current.appendChild(globalMap.getDiv());
          console.log("♻️ Map reused");
        }

        // Load initial positions
        await loadPositions();

        // Subscribe to realtime changes (only once globally)
        if (!globalChannel) {
          const sb = getSupabaseClient();
          globalChannel = sb
            .channel("live_riders_map")
            .on("postgres_changes", {
              event: "*",
              schema: "public",
              table: "ubicaciones_repartidores",
            }, () => {
              if (mountedRef.current) {
                loadPositions();
              }
            })
            .subscribe((status: string) => {
              console.log("Realtime status:", status);
            });
          console.log("📡 Realtime subscribed");
        }
      } catch (err: any) {
        console.error("Error:", err);
        if (mapRef.current) {
          mapRef.current.innerHTML = `<div style="color:red;padding:20px;">Error: ${err.message}</div>`;
        }
      }
    };

    const loadPositions = async () => {
      if (!globalMap || !mountedRef.current) return;

      try {
        const sb = getSupabaseClient();
        const { data, error } = await sb
          .from("ubicaciones_repartidores")
          .select("*");

        if (error || !data || !mountedRef.current) return;

        updateMarkers(data);
      } catch (e) {
        console.error("Error loading positions:", e);
      }
    };

    const updateMarkers = (locs: Location[]) => {
      if (!globalMap) return;

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

        if (globalMarkers[loc.repartidor_id]) {
          // Update existing marker
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
          // Create new marker
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
          console.log("📍 Marker created:", loc.nombre_repartidor);
        }

        bounds.extend(new (window as any).google.maps.LatLng(loc.latitud, loc.longitud));
      });

      // Remove old markers
      Object.keys(globalMarkers).forEach(id => {
        if (!currentIds.has(id)) {
          globalMarkers[id].setMap(null);
          delete globalMarkers[id];
        }
      });

      // Fit bounds only if no previous bounds set (optional)
      if (hasValid) {
        // Optionally fit bounds on first load only
        // globalMap.fitBounds(bounds);
      }
    };

    init();

    return () => {
      mountedRef.current = false;
      // Do NOT clear globalMap, globalMarkers, or globalChannel
      // This ensures persistence across remounts
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
