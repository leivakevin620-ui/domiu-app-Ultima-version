'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

type Point = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color?: string;
};

type RoutePoint = { lat: number; lng: number };

interface OpenStreetLiveMapProps {
  points: Point[];
  route?: RoutePoint[];
  center?: RoutePoint;
  zoom?: number;
  className?: string;
  onPointClick?: (id: string) => void;
}

declare global {
  interface Window {
    L?: any;
    __domiuLeafletPromise?: Promise<any>;
  }
}

function loadLeaflet() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Navegador no disponible'));
  if (window.L) return Promise.resolve(window.L);
  if (window.__domiuLeafletPromise) return window.__domiuLeafletPromise;

  window.__domiuLeafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-domiu-leaflet]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.dataset.domiuLeaflet = 'true';
      document.head.appendChild(link);
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-domiu-leaflet]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.L));
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar el mapa')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.dataset.domiuLeaflet = 'true';
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error('No se pudo cargar el mapa'));
    document.head.appendChild(script);
  });

  return window.__domiuLeafletPromise;
}

export function OpenStreetLiveMap({
  points,
  route = [],
  center,
  zoom = 14,
  className = 'h-full w-full',
  onPointClick,
}: OpenStreetLiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void loadLeaflet()
      .then((L) => {
        if (!active || !containerRef.current || mapRef.current) return;
        const initial = center || points[0] || { lat: 11.2408, lng: -74.199 };
        const map = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true,
        }).setView([initial.lat, initial.lng], zoom);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        }).addTo(map);
        mapRef.current = map;
        layerRef.current = L.layerGroup().addTo(map);
        setReady(true);
        window.setTimeout(() => map.invalidateSize(), 50);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Mapa no disponible');
      });

    return () => {
      active = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!ready || !window.L || !mapRef.current || !layerRef.current) return;
    const L = window.L;
    const layer = layerRef.current;
    layer.clearLayers();

    const bounds: [number, number][] = [];
    for (const item of points) {
      if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) continue;
      const marker = L.circleMarker([item.lat, item.lng], {
        radius: 10,
        color: '#ffffff',
        weight: 3,
        fillColor: item.color || '#2563EB',
        fillOpacity: 1,
      }).addTo(layer);
      marker.bindTooltip(item.label, { direction: 'top', offset: [0, -8], opacity: 0.95 });
      if (onPointClick) marker.on('click', () => onPointClick(item.id));
      bounds.push([item.lat, item.lng]);
    }

    const validRoute = route.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
    if (validRoute.length >= 2) {
      L.polyline(
        validRoute.map((item) => [item.lat, item.lng]),
        { color: '#2563EB', weight: 5, opacity: 0.85, dashArray: '10 8' },
      ).addTo(layer);
      for (const item of validRoute) bounds.push([item.lat, item.lng]);
    }

    if (bounds.length > 1) mapRef.current.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });
    else if (bounds.length === 1) mapRef.current.setView(bounds[0], zoom);
    else if (center) mapRef.current.setView([center.lat, center.lng], zoom);

    window.setTimeout(() => mapRef.current?.invalidateSize(), 30);
  }, [center, onPointClick, points, ready, route, zoom]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted/40 ${className}`}>
        <div className="p-6 text-center">
          <MapPin className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold">{error}</p>
          <p className="mt-1 text-xs text-muted-foreground">Usa el botón de navegación externa mientras se restablece la conexión.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      {!ready && <div className="absolute inset-0 animate-pulse bg-muted" />}
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
