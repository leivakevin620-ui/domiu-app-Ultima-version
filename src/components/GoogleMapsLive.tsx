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

// Singleton
let globalMap: any = null;
let globalOverlays: Record<string, any> = {};
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
        // Load Google Maps
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

        // Subscribe to realtime changes (only once)
        if (!globalChannel) {
          const sb = getSupabaseClient();
          globalChannel = sb
            .channel("live_riders_overlay")
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

        updateOverlays(data);
      } catch (e) {
        console.error("Error loading positions:", e);
      }
    };

    const updateOverlays = (locs: Location[]) => {
      if (!globalMap) return;

      const currentIds = new Set<string>();
      let overlayClass: any = null;

      // Define overlay class if not defined
      if (!(window as any).RiderOverlay) {
        class RiderOverlay extends (window as any).google.maps.OverlayView {
          private position: any;
          private div: HTMLDivElement | null = null;
          private loc: Location;

          constructor(pos: any, loc: Location) {
            super();
            this.position = pos;
            this.loc = loc;
            this.setMap(globalMap);
          }

          onAdd() {
            this.div = document.createElement("div");
            this.div.style.position = "absolute";
            this.div.style.background = this.loc.estado === "disponible" ? "#22c55e" : 
                                     this.loc.estado === "ocupado" ? "#eab308" : "#94a3b8";
            this.div.style.color = "#fff";
            this.div.style.padding = "6px 10px";
            this.div.style.borderRadius = "8px";
            this.div.style.fontSize = "12px";
            this.div.style.fontWeight = "bold";
            this.div.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
            this.div.style.whiteSpace = "nowrap";
            this.div.style.cursor = "pointer";
            this.div.innerHTML = `
              <div>${this.loc.nombre_repartidor || "Repartidor"}</div>
              <div style="font-size:10px;font-weight:normal;margin-top:2px;">
                ${this.loc.estado} • ${new Date(this.loc.ultima_actualizacion).toLocaleTimeString()}
              </div>
              <div style="font-size:10px;font-weight:normal;">
                ${this.loc.latitud?.toFixed(4)}, ${this.loc.longitud?.toFixed(4)}
              </div>
            `;
            const panes = this.getPanes();
            panes?.overlayLayer.appendChild(this.div);
          }

          draw() {
            const projection = this.getProjection();
            if (!projection || !this.div) return;
            const point = projection.fromLatLngToDivPixel(this.position);
            if (point) {
              this.div.style.left = (point.x - this.div.offsetWidth / 2) + "px";
              this.div.style.top = (point.y - this.div.offsetHeight - 10) + "px";
            }
          }

          onRemove() {
            if (this.div && this.div.parentNode) {
              this.div.parentNode.removeChild(this.div);
              this.div = null;
            }
          }

          updatePosition(pos: any, loc: Location) {
            this.position = pos;
            this.loc = loc;
            if (this.div) {
              this.div.style.background = loc.estado === "disponible" ? "#22c55e" : 
                                         loc.estado === "ocupado" ? "#eab308" : "#94a3b8";
              this.div.innerHTML = `
                <div>${loc.nombre_repartidor || "Repartidor"}</div>
                <div style="font-size:10px;font-weight:normal;margin-top:2px;">
                  ${loc.estado} • ${new Date(loc.ultima_actualizacion).toLocaleTimeString()}
                </div>
                <div style="font-size:10px;font-weight:normal;">
                  ${loc.latitud?.toFixed(4)}, ${loc.longitud?.toFixed(4)}
                </div>
              `;
            }
            this.draw();
          }
        }
        (window as any).RiderOverlay = RiderOverlay;
      }

      locs.forEach(loc => {
        if (!loc.latitud || !loc.longitud) return;
        currentIds.add(loc.repartidor_id);

        const pos = new (window as any).google.maps.LatLng(loc.latitud, loc.longitud);

        if (globalOverlays[loc.repartidor_id]) {
          // Update existing overlay
          const overlay = globalOverlays[loc.repartidor_id];
          overlay.updatePosition(pos, loc);
        } else {
          // Create new overlay
          const OverlayClass = (window as any).RiderOverlay;
          const overlay = new OverlayClass(pos, loc);
          globalOverlays[loc.repartidor_id] = overlay;
          console.log("📍 Overlay created:", loc.nombre_repartidor);
        }
      });

      // Remove old overlays
      Object.keys(globalOverlays).forEach(id => {
        if (!currentIds.has(id)) {
          globalOverlays[id].setMap(null);
          delete globalOverlays[id];
        }
      });
    };

    init();

    return () => {
      mountedRef.current = false;
      // Do NOT clear globalMap, globalOverlays, or globalChannel
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
