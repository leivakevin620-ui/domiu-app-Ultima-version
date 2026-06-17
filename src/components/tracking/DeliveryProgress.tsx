'use client';

import React from 'react';
import type { TrackingInfo } from '@/services/tracking';
import { Truck, Store, MapPin } from 'lucide-react';

interface DeliveryProgressProps {
  trackingInfo: TrackingInfo | null;
  currentStatus: string;
}

export function DeliveryProgress({ trackingInfo, currentStatus }: DeliveryProgressProps) {
  const etaSteps = [
    { key: 'confirmed', label: 'Confirmado' },
    { key: 'preparing', label: 'Preparando' },
    { key: 'ready', label: 'Listo' },
    { key: 'assigned', label: 'Asignado' },
    { key: 'picked_up', label: 'Recogido' },
    { key: 'in_transit', label: 'En camino' },
    { key: 'delivered', label: 'Entregado' },
  ];

  const statusOrder: Record<string, number> = {
    pending: 0,
    confirmed: 1,
    preparing: 2,
    ready: 3,
    assigned: 4,
    picked_up: 5,
    in_transit: 6,
    delivered: 7,
  };

  const currentIdx = statusOrder[currentStatus] ?? 0;

  const progressPercent = Math.min((currentIdx / (etaSteps.length - 1)) * 100, 100);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Progreso de entrega
        </span>
        {trackingInfo?.distanceKm !== undefined && trackingInfo.distanceKm <= 0.5 && currentStatus === 'in_transit' && (
          <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            ¡Muy cerca!
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Step indicators */}
      <div className="relative">
        {etaSteps.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={step.key} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold transition-all ${
                    done
                      ? 'border-primary bg-primary text-primary-foreground'
                      : active
                        ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                        : 'border-muted bg-muted/10 text-muted-foreground'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </div>
                {i < etaSteps.length - 1 && (
                  <div className={`mt-0.5 h-4 w-0.5 ${done ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </div>
              <div className={`pb-2 ${active ? '' : ''}`}>
                <p className={`text-xs font-medium ${done || active ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Driver proximity indicator */}
      {trackingInfo?.isLive && currentStatus === 'in_transit' && (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-primary/5 p-3">
          <Truck className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              {trackingInfo.distanceKm <= 1
                ? 'El repartidor está muy cerca'
                : `El repartidor está a ${trackingInfo.distanceKm} km`}
            </p>
            <p className="text-xs text-muted-foreground">
              Llegada estimada en {trackingInfo.etaMinutes} minutos
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
