'use client';

import React from 'react';
import type { TrackingInfo } from '@/services/tracking';
import { Clock, Navigation, MapPin } from 'lucide-react';

interface EtaCardProps {
  trackingInfo: TrackingInfo | null;
  isLive?: boolean;
}

export function EtaCard({ trackingInfo, isLive }: EtaCardProps) {
  if (!trackingInfo) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Clock className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Calculando tiempo estimado...</p>
            <p className="text-xs text-muted-foreground">Esperando ubicación del repartidor</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Tiempo estimado
        </span>
        {isLive && (
          <span className="flex items-center gap-1 text-xs text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            En vivo
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{trackingInfo.etaMinutes} min</p>
            <p className="text-xs text-muted-foreground">Tiempo estimado de llegada</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Distancia</p>
            <p className="text-sm font-semibold text-foreground">{trackingInfo.distanceKm} km</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Velocidad</p>
            <p className="text-sm font-semibold text-foreground">
              {trackingInfo.driverLocation ? `${Math.round(trackingInfo.driverLocation.speed)} km/h` : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
