'use client';

import React from 'react';
import type { OrderData } from '@/services/orders';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import { DeliveryStatusTimeline } from '@/components/delivery/DeliveryStatusTimeline';
import { Truck } from 'lucide-react';

interface NegocioOrderCardProps {
  order: OrderData;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onNextStatus?: (id: string) => void;
}

const statusFlow: Record<string, string> = {
  pending: 'Aceptar pedido',
  confirmed: 'Marcar como preparando',
  preparing: 'Marcar como listo',
  ready: 'Marcar como listo',
};

export function NegocioOrderCard({ order, onAccept, onReject, onNextStatus }: NegocioOrderCardProps) {
  const nextLabel = statusFlow[order.status];

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    confirmed: 'bg-blue-100 text-blue-800',
    preparing: 'bg-purple-100 text-purple-800',
    ready: 'bg-green-100 text-green-800',
    assigned: 'bg-indigo-100 text-indigo-800',
    picked_up: 'bg-purple-100 text-purple-800',
    in_transit: 'bg-amber-100 text-amber-800',
    delivered: 'bg-muted text-muted-foreground',
    cancelled: 'bg-destructive/10 text-destructive',
  };

  const isDeliveryPhase = ['assigned', 'picked_up', 'in_transit', 'delivered'].includes(order.status);

  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-foreground">{order.order_number}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                statusColors[order.status] ?? 'bg-muted text-muted-foreground'
              }`}
            >
              {order.status}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{order.customer_name}</p>
        </div>
        <span className="text-lg font-bold text-foreground">${order.total_amount.toFixed(2)}</span>
      </div>

      <div className="mb-3 space-y-1">
        {order.items.map((item) => (
          <div key={item.product_id} className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {item.quantity}x {item.product_name}
            </span>
            <span className="text-foreground">${item.item_total.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="mb-3 text-xs text-muted-foreground">
        <p>📍 {order.delivery_address}</p>
        {order.special_instructions && <p className="mt-1">📝 {order.special_instructions}</p>}
      </div>

      {/* Delivery info */}
      {order.courier_name && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-primary/5 p-2">
          <Truck className="h-4 w-4 text-primary" />
          <span className="text-xs text-muted-foreground">
            Repartidor: <strong className="text-foreground">{order.courier_name}</strong>
          </span>
        </div>
      )}

      {/* Timeline */}
      <div className="mb-4 border-t border-border pt-3">
        {isDeliveryPhase ? (
          <DeliveryStatusTimeline status={order.status} />
        ) : (
          <OrderTimeline status={order.status} />
        )}
      </div>

      {/* Actions */}
      {order.status === 'pending' && onAccept && onReject && (
        <div className="flex gap-2">
          <button
            onClick={() => onAccept(order.id)}
            className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Aceptar
          </button>
          <button
            onClick={() => onReject(order.id)}
            className="flex-1 rounded-lg bg-destructive/10 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
          >
            Rechazar
          </button>
        </div>
      )}

      {nextLabel && onNextStatus && order.status === 'confirmed' && (
        <button
          onClick={() => onNextStatus(order.id)}
          className="w-full rounded-lg bg-primary/10 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        >
          {nextLabel}
        </button>
      )}

      {nextLabel && onNextStatus && order.status === 'preparing' && (
        <button
          onClick={() => onNextStatus(order.id)}
          className="w-full rounded-lg bg-primary/10 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
}
