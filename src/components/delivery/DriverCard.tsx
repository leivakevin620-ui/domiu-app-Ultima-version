'use client';

import React from 'react';
import type { CourierDriver } from '@/services/assignment';
import { Bike, Car, Truck, Star, CheckCircle, XCircle } from 'lucide-react';

interface DriverCardProps {
  driver: CourierDriver;
}

const vehicleIcons: Record<string, React.ReactNode> = {
  motorcycle: <Bike className="h-4 w-4" />,
  bicycle: <Bike className="h-4 w-4" />,
  car: <Car className="h-4 w-4" />,
};

export function DriverCard({ driver }: DriverCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
          {driver.name.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground">{driver.name}</p>
            {driver.is_available ? (
              <span className="flex items-center gap-1 text-xs text-success">
                <CheckCircle className="h-3 w-3" />
                Disponible
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <XCircle className="h-3 w-3" />
                Ocupado
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              {vehicleIcons[driver.vehicle_type] ?? <Truck className="h-4 w-4" />}
              {driver.vehicle_type}
            </span>
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 text-amber-500" />
              {driver.rating}
            </span>
            <span>{driver.total_deliveries} entregas</span>
          </div>
        </div>
      </div>
    </div>
  );
}
