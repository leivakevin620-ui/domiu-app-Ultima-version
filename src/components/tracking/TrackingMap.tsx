'use client';

import React from 'react';
import type { DriverLocation, RoutePoint, TrackingInfo } from '@/services/tracking';
import { Truck, Store, MapPin, Navigation } from 'lucide-react';

interface TrackingMapProps {
  trackingInfo: TrackingInfo | null;
  driverLocation?: DriverLocation | null;
  height?: string;
}

export function TrackingMap({ trackingInfo, driverLocation, height = 'h-80' }: TrackingMapProps) {
  if (!trackingInfo) {
    return (
      <div className={`${height} flex items-center justify-center rounded-xl border border-border bg-card`}>
        <p className="text-sm text-muted-foreground">Esperando ubicación del repartidor...</p>
      </div>
    );
  }

  const driverPos = driverLocation
    ? { lat: driverLocation.latitude, lng: driverLocation.longitude }
    : null;

  const biz = trackingInfo.businessLocation;
  const cust = trackingInfo.customerLocation;

  const allPoints = [
    ...(driverPos ? [{ ...driverPos, type: 'driver' as const }] : []),
    { ...biz, type: 'business' as const },
    { ...cust, type: 'customer' as const },
  ];

  const lats = allPoints.map((p) => p.lat);
  const lngs = allPoints.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const pad = 0.002;
  const rangeLat = maxLat - minLat + pad * 2 || 0.01;
  const rangeLng = maxLng - minLng + pad * 2 || 0.01;

  const toPercent = (lat: number, lng: number) => ({
    top: `${((maxLat + pad - lat) / rangeLat) * 100}%`,
    left: `${((lng - (minLng - pad)) / rangeLng) * 100}%`,
  });

  const bizPos = toPercent(biz.lat, biz.lng);
  const custPos = toPercent(cust.lat, cust.lng);
  const driverPosPct = driverPos ? toPercent(driverPos.lat, driverPos.lng) : null;

  return (
    <div className={`relative ${height} w-full overflow-hidden rounded-xl border border-border bg-gradient-to-br from-slate-50 to-slate-100`}>
      {/* Grid lines */}
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`h-${i}`} className="absolute left-0 right-0 border-t border-slate-200/50" style={{ top: `${(i / 5) * 100}%` }} />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`v-${i}`} className="absolute bottom-0 top-0 border-l border-slate-200/50" style={{ left: `${(i / 5) * 100}%` }} />
        ))}
      </div>

      {/* Business marker */}
      <div
        className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-all duration-500"
        style={{ top: bizPos.top, left: bizPos.left }}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 shadow-lg shadow-orange-500/30">
          <Store className="h-4 w-4 text-white" />
        </div>
        <span className="mt-0.5 whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 shadow-sm">
          {trackingInfo.isLive ? 'Negocio' : 'Negocio'}
        </span>
      </div>

      {/* Customer marker */}
      <div
        className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-all duration-500"
        style={{ top: custPos.top, left: custPos.left }}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
          <MapPin className="h-4 w-4 text-white" />
        </div>
        <span className="mt-0.5 whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 shadow-sm">
          Entrega
        </span>
      </div>

      {/* Driver marker */}
      {driverPosPct && (
        <div
          className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-all duration-1000 ease-linear"
          style={{ top: driverPosPct.top, left: driverPosPct.left }}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/40"
            style={{ transform: `rotate(${driverLocation?.heading ?? 0}deg)` }}
          >
            <Truck className="h-5 w-5 text-white" />
          </div>
          <span className="mt-0.5 whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-primary shadow-sm">
            Repartidor
          </span>
        </div>
      )}

      {/* Route line (dashed) */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <line
          x1={`${bizPos.left}`}
          y1={`${bizPos.top}`}
          x2={`${custPos.left}`}
          y2={`${custPos.top}`}
          stroke="#94a3b8"
          strokeWidth="2"
          strokeDasharray="6 4"
          opacity={0.4}
        />
        {driverPosPct && (
          <line
            x1={driverPosPct.left}
            y1={driverPosPct.top}
            x2={`${custPos.left}`}
            y2={`${custPos.top}`}
            stroke="#6366f1"
            strokeWidth="2.5"
            strokeDasharray="8 4"
            opacity={0.7}
          />
        )}
      </svg>

      {/* Compass / Legend */}
      <div className="absolute bottom-3 right-3 rounded-lg bg-white/90 p-2 shadow-sm">
        <Navigation className="h-5 w-5 text-slate-400" />
      </div>

      <div className="absolute bottom-3 left-3 flex gap-3 rounded-lg bg-white/90 px-3 py-1.5 shadow-sm">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
          <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
          Negocio
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Entrega
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
          <div className="h-2.5 w-2.5 rounded-full bg-primary" />
          Repartidor
        </div>
      </div>
    </div>
  );
}
