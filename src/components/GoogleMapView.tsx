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

// Singleton pattern - el mapa vive fuera del ciclo de vida de React
class MapManager {
  private static instance: MapManager;
  private map: any = null;
  private markers: Record<string, any> = {};
  private firstLoad: boolean = true;
  private interval: NodeJS.Timeout | null = null;
  private initialized: boolean = false;

  static getInstance(): MapManager {
    if (!MapManager.instance) {
      MapManager.instance = new MapManager();
    }
    return MapManager.instance;
  }

  async init(container: HTMLDivElement, onError: (msg: string) => void) {
    if (this.initialized) {
      this.moveToContainer(container);
      return;
    }

    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        onError("Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
        return;
      }

      // Cargar Maps
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

      // Crear mapa
      this.map = new (window as any).google.maps.Map(container, {
        center: { lat: 10.4, lng: -75.5 },
        zoom: 12,
      });

      console.log("✅ Mapa creado (singleton)");
      this.initialized = true;

      // Cargar datos
      await this.loadData();

      // Polling
      if (!this.interval) {
        this.interval = setInterval(() => this.loadData(), 30000);
        console.log("⏱️ Polling iniciado");
      }
    } catch (err: any) {
      console.error("Error:", err);
      onError(err.message);
    }
  }

  private moveToContainer(container: HTMLDivElement) {
    if (!this.map) return;
    const div = this.map.getDiv();
    if (div && div.parentNode) {
      div.parentNode.removeChild(div);
    }
    container.appendChild(this.map.getDiv());
    console.log("♻️ Mapa movido a nuevo contenedor");
  }

  private async loadData() {
    if (!this.map) return;

    try {
      const sb = getSupabaseClient();
      const { data, error } = await sb
        .from("ubicaciones_repartidores")
        .select("*");

      if (error || !data) return;
      this.updateMarkers(data);
    } catch (e) {
      console.error("Error cargando:", e);
    }
  }

  private updateMarkers(locs: Location[]) {
    if (!this.map) return;

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

      if (this.markers[loc.repartidor_id]) {
        const marker = this.markers[loc.repartidor_id];
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
        const marker = new (window as any).google.maps.Marker({
          position,
          map: this.map,
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

        marker.addListener("click", () => info.open(this.map, marker));
        this.markers[loc.repartidor_id] = marker;
      }

      bounds.extend(new (window as any).google.maps.LatLng(loc.latitud, loc.longitud));
    });

    // Eliminar marcadores viejos
    Object.keys(this.markers).forEach(id => {
      if (!currentIds.has(id)) {
        this.markers[id].setMap(null);
        delete this.markers[id];
      }
    });

    // Ajustar bounds solo la primera vez
    if (this.firstLoad && hasValid) {
      this.map.fitBounds(bounds);
      this.firstLoad = false;
      console.log("🗺️ Bounds ajustados (una vez)");
    }
  }
}

export default function GoogleMapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mapRef.current;
    const errorDiv = errorRef.current;
    
    if (!container) return;

    const onError = (msg: string) => {
      if (errorDiv) {
        errorDiv.innerHTML = `<div style="color:red;padding:20px;">Error: ${msg}</div>`;
      }
    };

    const manager = MapManager.getInstance();
    manager.init(container, onError);

    return () => {
      // NO hacer nada al desmontar - el singleton persiste
    };
  }, []);

  return (
    <div>
      <div
        ref={mapRef}
        style={{ width: "100%", height: "400px", borderRadius: "12px", background: "#1e293b" }}
      />
      <div ref={errorRef} />
    </div>
  );
}
