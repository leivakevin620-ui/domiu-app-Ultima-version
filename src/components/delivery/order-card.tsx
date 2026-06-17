'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Store } from 'lucide-react';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'in_transit' | 'delivered' | 'cancelled';

interface OrderCardProps {
  id: string;
  status: OrderStatus;
  businessName: string;
  itemsCount: number;
  total: number;
  currency?: string;
  deliveryAddress?: string;
  estimatedTime?: string;
  onClick?: () => void;
  className?: string;
}

const statusConfig: Record<OrderStatus, { label: string; variant: 'warning' | 'info' | 'success' | 'destructive' | 'default' | 'secondary' }> = {
  pending: { label: 'Pendiente', variant: 'warning' },
  confirmed: { label: 'Confirmado', variant: 'info' },
  preparing: { label: 'Preparando', variant: 'info' },
  in_transit: { label: 'En camino', variant: 'default' },
  delivered: { label: 'Entregado', variant: 'success' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

export function OrderCard({
  id,
  status,
  businessName,
  itemsCount,
  total,
  currency = '$',
  deliveryAddress,
  estimatedTime,
  onClick,
  className,
}: OrderCardProps) {
  const config = statusConfig[status];

  return (
    <Card hover onClick={onClick} className={cn('cursor-pointer p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground shrink-0">
            <Store className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{businessName}</p>
            <p className="text-xs text-muted-foreground">
              {itemsCount} producto{itemsCount !== 1 ? 's' : ''} · {currency}
              {total.toFixed(2)}
            </p>
          </div>
        </div>
        <Badge variant={config.variant}>{config.label}</Badge>
      </div>
      {(deliveryAddress || estimatedTime) && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {deliveryAddress && (
            <span className="flex items-center gap-1 truncate max-w-[200px]">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {deliveryAddress}
            </span>
          )}
          {estimatedTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {estimatedTime}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
