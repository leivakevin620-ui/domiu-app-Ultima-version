'use client';

import React from 'react';
import type { OrderStatus } from '@/services/orders';

interface Step {
  status: OrderStatus | 'pending_business';
  label: string;
  description: string;
}

const steps: Step[] = [
  { status: 'pending', label: 'Pendiente', description: 'Esperando confirmación del negocio' },
  { status: 'confirmed', label: 'Confirmado', description: 'El negocio ha aceptado tu pedido' },
  { status: 'preparing', label: 'Preparando', description: 'Tu pedido está siendo preparado' },
  { status: 'ready', label: 'Listo', description: 'Pedido terminado, esperando repartidor' },
  { status: 'delivered', label: 'Entregado', description: '¡Pedido entregado con éxito!' },
];

const statusIndex: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  assigned: 4,
  picked_up: 4,
  in_transit: 4,
  delivered: 4,
  cancelled: -1,
};

export function OrderTimeline({ status }: { status: OrderStatus }) {
  const currentIndex = statusIndex[status] ?? -1;
  const isCancelled = status === 'cancelled';

  if (isCancelled) {
    return (
      <div className="space-y-3">
        {steps.map((step, i) => {
          const done = i < statusIndex.pending;
          return (
            <div key={step.status} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    done
                      ? 'border-destructive bg-destructive/10 text-destructive'
                      : i === 0
                        ? 'border-destructive bg-destructive/10 text-destructive'
                        : 'border-muted bg-muted/10 text-muted-foreground'
                  }`}
                >
                  {done ? '✕' : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`mt-1 h-full w-0.5 ${
                      done ? 'bg-destructive/30' : 'bg-muted'
                    }`}
                    style={{ minHeight: '1.5rem' }}
                  />
                )}
              </div>
              <div className="pb-4">
                <p className={`text-sm font-medium ${done || i === 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {i === 0 ? 'Pedido cancelado' : step.description}
                </p>
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-2 rounded-lg bg-destructive/5 p-3">
          <span className="text-sm font-medium text-destructive">Pedido cancelado</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
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
              {i < steps.length - 1 && (
                <div
                  className={`mt-1 h-full w-0.5 ${
                    done ? 'bg-primary' : 'bg-muted'
                  }`}
                  style={{ minHeight: '1.5rem' }}
                />
              )}
            </div>
            <div className={`pb-4 ${active ? '' : ''}`}>
              <p
                className={`text-sm font-medium ${
                  done || active ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </p>
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
