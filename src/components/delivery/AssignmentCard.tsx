'use client';

import React from 'react';
import type { OrderData } from '@/services/orders';
import { Clock, MapPin, ShoppingBag } from 'lucide-react';

interface AssignmentCardProps {
  order: OrderData;
  onAccept: (orderId: string) => void;
  onReject?: (orderId: string) => void;
}

export function AssignmentCard({ order, onAccept, onReject }: AssignmentCardProps) {
  return (
    <div className="rounded-xl border-2 border-primary/20 bg-card p-5 shadow-lg shadow-primary/5">
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          Nueva solicitud
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(order.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <h3 className="mt-2 text-lg font-semibold text-foreground">{order.business_name}</h3>

      <div className="mt-3 space-y-2 text-sm">
        <p className="flex items-start gap-2 text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          {order.delivery_address}
        </p>
        <p className="flex items-start gap-2 text-muted-foreground">
          <ShoppingBag className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          {order.items.length} artículos · ${order.total_amount.toFixed(2)}
        </p>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onAccept(order.id)}
          className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Aceptar
        </button>
        {onReject && (
          <button
            onClick={() => onReject(order.id)}
            className="flex-1 rounded-lg bg-muted py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/80"
          >
            Rechazar
          </button>
        )}
      </div>
    </div>
  );
}
