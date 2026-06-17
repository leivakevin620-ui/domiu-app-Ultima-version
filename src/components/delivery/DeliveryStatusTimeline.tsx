'use client';

import React from 'react';
import type { OrderStatus } from '@/services/orders';

interface DeliveryStep {
  status: OrderStatus;
  label: string;
  icon: string;
}

const deliverySteps: DeliveryStep[] = [
  { status: 'assigned', label: 'Asignado', icon: '📋' },
  { status: 'picked_up', label: 'Recogido', icon: '📦' },
  { status: 'in_transit', label: 'En camino', icon: '🚚' },
  { status: 'delivered', label: 'Entregado', icon: '✅' },
];

const statusIndex: Record<string, number> = {
  assigned: 0,
  picked_up: 1,
  in_transit: 2,
  delivered: 3,
};

export function DeliveryStatusTimeline({ status }: { status: OrderStatus }) {
  if (!['assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'].includes(status)) {
    return (
      <p className="text-xs text-muted-foreground">
        Esperando asignación de repartidor...
      </p>
    );
  }

  const isCancelled = status === 'cancelled';
  const currentIndex = statusIndex[status] ?? -1;

  return (
    <div className="space-y-0">
      {deliverySteps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;

        if (isCancelled && i > 0) {
          return (
            <div key={step.status} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-muted bg-muted/10 text-xs text-muted-foreground">
                  {i + 1}
                </div>
                {i < deliverySteps.length - 1 && <div className="mt-1 h-full w-0.5 bg-muted" style={{ minHeight: '1.5rem' }} />}
              </div>
              <div className="pb-4">
                <p className="text-sm text-muted-foreground">{step.label}</p>
              </div>
            </div>
          );
        }

        return (
          <div key={step.status} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-300 ${
                  done
                    ? 'border-primary bg-primary text-primary-foreground'
                    : active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted bg-muted/10 text-muted-foreground'
                }`}
              >
                {done ? '✓' : i + 1}
              </div>
              {i < deliverySteps.length - 1 && (
                <div
                  className={`mt-1 h-full w-0.5 ${done ? 'bg-primary' : 'bg-muted'}`}
                  style={{ minHeight: '1.5rem' }}
                />
              )}
            </div>
            <div className="pb-4">
              <p
                className={`text-sm font-medium ${
                  done || active ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
