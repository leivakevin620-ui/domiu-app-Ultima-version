'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

type MapPointKind = 'business' | 'customer' | 'courier' | 'pickup' | 'delivery' | 'default';

export type OpenStreetMapPoint = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color?: string;
  kind?: MapPointKind;
};

export type OpenStreetRoutePoint = { lat: number; lng: number };

export type OpenStreetSecondaryRoute = {
  id: string;
  points: OpenStreetRoutePoint[];
  color?: string;
};

export type ResolvedRoute = {
  path: OpenStreetRoutePoint[];
  distanceKm: number | null;
  durationMinutes: number | null;
  source: 'osrm' | 'direct';
};

interface OpenStreetLiveMapProps {
  points: OpenStreetMapPoint[];
  route?: OpenStreetRoutePoint[];
  secondaryRoutes?: OpenStreetSecondaryRoute[];
  center?: OpenStreetRoutePoint;
  zoom?: number;
  className?: string;
  onPointClick?: (id: string) => void;
  followPointId?: string;
  onRouteResolved?: (route: ResolvedRoute) => void;
}

declare global {
  interface Window {
    L?: any;
    __domiuLeafletPromise?: Promise<any>;
  }
}

const DEFAULT_CENTER = { lat: 11.2408, lng: -74.199 };

function validColor(value?: string) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#2563EB';
}

function markerSymbol(kind: MapPointKind | undefined) {
  if (kind === 'courier') return '🛵';
  if (kind === 'business' || kind === 'pickup') return '🏪';
  if (kind === 'customer' || kind === 'delivery') return '📍';
  return '•';
}

function markerIcon(L: any, point: OpenStreetMapPoint) {
  const kind = point.kind || 'default';
  const color = validColor(point.color);
  const pulse = kind === 'courier' ? '<span class="domiu-live-map-pulse"></span>' : '';
  return L.divIcon({
    className: 'domiu-live-map-icon',
    html: `<span class="domiu-live-map-marker domiu-live-map-marker--${kind}" style="--domiu-marker:${color}">${pulse}<span class="domiu-live-map-symbol">${markerSymbol(kind)}</span></span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    tooltipAnchor: [0, -22],
  });
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

    if (!document.querySelector('style[data-domiu-live-map]')) {
      const style = document.createElement('style');
      style.dataset.domiuLiveMap = 'true';
      style.textContent = `
        .domiu-live-map-icon{background:transparent!important;border:0!important}
        .domiu-live-map-marker{position:relative;display:flex;width:40px;height:40px;align-items:center;justify-content:center;border:3px solid #fff;border-radius:999px;background:var(--domiu-marker);box-shadow:0 8px 24px rgba(15,23,42,.28);transform:translateZ(0)}
        .domiu-live-map-symbol{position:relative;z-index:2;font-size:18px;line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,.2))}
        .domiu-live-map-marker--default .domiu-live-map-symbol{color:#fff;font-size:24px}
        .domiu-live-map-pulse{position:absolute;inset:-8px;z-index:1;border-radius:999px;background:var(--domiu-marker);opacity:.32;animation:domiu-map-pulse 1.6s ease-out infinite}
        @keyframes domiu-map-pulse{0%{transform:scale(.75);opacity:.45}75%,100%{transform:scale(1.45);opacity:0}}
        .leaflet-tooltip{border:0!important;border-radius:10px!important;box-shadow:0 8px 24px rgba(15,23,42,.18)!important;font-weight:700!important}
      `;
      document.head.appendChild(style);
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

function directDistanceKm(points: OpenStreetRoutePoint[]) {
  if (points.length < 2) return null;
  const start = points[0];
  const end = points.at(-1)!;
  const radius = 6371;
  const dLat = ((end.lat - start.lat) * Math.PI) / 180;
  const dLng = ((end.lng - start.lng) * Math.PI) / 180;
  const lat1 = (start.lat * Math.PI) / 180;
  const lat2 = (end.lat * Math.PI) / 180;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

async function resolveDrivingRoute(points: OpenStreetRoutePoint[]): Promise<ResolvedRoute> {
  const valid = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  const fallbackDistance = directDistanceKm(valid);
  const fallback: ResolvedRoute = {
    path: valid,
    distanceKm: fallbackDistance,
    durationMinutes: fallbackDistance == null ? null : Math.max(2, Math.ceil((fallbackDistance / 25) * 60)),
    source: 'direct',
  };
  if (valid.length < 2) return fallback;

  const coordinates = valid.map((point) => `${point.lng},${point.lat}`).join(';');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`,
      { signal: controller.signal },
    );
    if (!response.ok) return fallback;
    const data = await response.json();
    const route = data?.routes?.[0];
    const coordinatesResult = route?.geometry?.coordinates;
    if (!Array.isArray(coordinatesResult) || coordinatesResult.length < 2) return fallback;
    return {
      path: coordinatesResult.map(([lng, lat]: [number, number]) => ({ lat, lng })),
      distanceKm: Number.isFinite(route.distance) ? route.distance / 1000 : fallbackDistance,
      durationMinutes: Number.isFinite(route.duration) ? Math.max(1, Math.ceil(route.duration / 60)) : fallback.durationMinutes,
      source: 'osrm',
    };
  } catch {
    return fallback;
  } finally {
    window.clearTimeout(timeout);
  }
}

function animateMarker(marker: any, destination: OpenStreetRoutePoint, frameRef: { current: number | null }) {
  if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
  const current = marker.getLatLng();
  const start = { lat: Number(current.lat), lng: Number(current.lng) };
  const startedAt = performance.now();
  const duration = 900;

  const frame = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    marker.setLatLng([
      start.lat + (destination.lat - start.lat) * eased,
      start.lng + (destination.lng - start.lng) * eased,
    ]);
    if (progress < 1) frameRef.current = requestAnimationFrame(frame);
    else frameRef.current = null;
  };
  frameRef.current = requestAnimationFrame(frame);
}

export function OpenStreetLiveMap({
  points,
  route = [],
  secondaryRoutes = [],
  center,
  zoom = 14,
  className = 'h-full w-full',
  onPointClick,
  followPointId,
  onRouteResolved,
}: OpenStreetLiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const animationRefs = useRef<Map<string, { current: number | null }>>(new Map());
  const fittedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const routeKey = useMemo(
    () => route.map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`).join('|'),
    [route],
  );

  useEffect(() => {
    let active = true;
    void loadLeaflet()
      .then((L) => {
        if (!active || !containerRef.current || mapRef.current) return;
        const initial = center || points[0] || DEFAULT_CENTER;
        const map = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true,
          preferCanvas: true,
        }).setView([initial.lat, initial.lng], zoom);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        }).addTo(map);
        mapRef.current = map;
        routeLayerRef.current = L.layerGroup().addTo(map);
        markerLayerRef.current = L.layerGroup().addTo(map);
        setReady(true);
        window.setTimeout(() => map.invalidateSize(), 80);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Mapa no disponible');
      });

    return () => {
      active = false;
      for (const animation of animationRefs.current.values()) {
        if (animation.current != null) cancelAnimationFrame(animation.current);
      }
      animationRefs.current.clear();
      markersRef.current.clear();
      if (mapRef.current) mapRef.current.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      routeLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !window.L || !mapRef.current || !markerLayerRef.current) return;
    const L = window.L;
    const activeIds = new Set(points.map((point) => point.id));

    for (const [id, marker] of markersRef.current.entries()) {
      if (!activeIds.has(id)) {
        markerLayerRef.current.removeLayer(marker);
        markersRef.current.delete(id);
        const animation = animationRefs.current.get(id);
        if (animation?.current != null) cancelAnimationFrame(animation.current);
        animationRefs.current.delete(id);
      }
    }

    const bounds: [number, number][] = [];
    for (const item of points) {
      if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) continue;
      bounds.push([item.lat, item.lng]);
      const existing = markersRef.current.get(item.id);
      if (existing) {
        existing.setIcon(markerIcon(L, item));
        existing.setTooltipContent(item.label);
        const animation = animationRefs.current.get(item.id) || { current: null };
        animationRefs.current.set(item.id, animation);
        animateMarker(existing, item, animation);
        existing.off('click');
        if (onPointClick) existing.on('click', () => onPointClick(item.id));
      } else {
        const marker = L.marker([item.lat, item.lng], { icon: markerIcon(L, item), riseOnHover: true })
          .addTo(markerLayerRef.current)
          .bindTooltip(item.label, { direction: 'top', offset: [0, -8], opacity: 0.96 });
        if (onPointClick) marker.on('click', () => onPointClick(item.id));
        markersRef.current.set(item.id, marker);
        animationRefs.current.set(item.id, { current: null });
      }
    }

    if (!fittedRef.current && bounds.length > 0) {
      if (bounds.length > 1) mapRef.current.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });
      else mapRef.current.setView(bounds[0], zoom);
      fittedRef.current = true;
    }

    if (followPointId) {
      const followed = points.find((point) => point.id === followPointId);
      if (followed) mapRef.current.panTo([followed.lat, followed.lng], { animate: true, duration: 0.7 });
    }

    window.setTimeout(() => mapRef.current?.invalidateSize(), 30);
  }, [followPointId, onPointClick, points, ready, zoom]);

  useEffect(() => {
    if (!ready || !window.L || !routeLayerRef.current) return;
    let active = true;
    const L = window.L;
    const layer = routeLayerRef.current;
    layer.clearLayers();

    for (const secondary of secondaryRoutes) {
      const valid = secondary.points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
      if (valid.length < 2) continue;
      L.polyline(
        valid.map((point) => [point.lat, point.lng]),
        { color: validColor(secondary.color), weight: 4, opacity: 0.45, dashArray: '7 9' },
      ).addTo(layer);
    }

    void resolveDrivingRoute(route).then((resolved) => {
      if (!active) return;
      if (resolved.path.length >= 2) {
        L.polyline(
          resolved.path.map((point) => [point.lat, point.lng]),
          {
            color: '#2563EB',
            weight: 6,
            opacity: 0.92,
            lineCap: 'round',
            lineJoin: 'round',
            dashArray: resolved.source === 'direct' ? '10 8' : undefined,
          },
        ).addTo(layer);
      }
      onRouteResolved?.(resolved);
    });

    return () => {
      active = false;
    };
  }, [onRouteResolved, ready, routeKey, secondaryRoutes]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted/40 ${className}`}>
        <div className="p-6 text-center">
          <MapPin className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold">{error}</p>
          <p className="mt-1 text-xs text-muted-foreground">Revisa tu conexión y vuelve a cargar el mapa.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      {!ready && <div className="absolute inset-0 animate-pulse bg-muted" />}
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-3 top-3 z-[450] flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide shadow-lg backdrop-blur">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> En vivo
      </div>
    </div>
  );
}
