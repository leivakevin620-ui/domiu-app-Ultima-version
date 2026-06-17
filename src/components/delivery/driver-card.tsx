'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Star, Phone } from 'lucide-react';

interface DriverCardProps {
  name: string;
  photo?: string;
  rating?: number;
  vehicle?: string;
  plate?: string;
  phone?: string;
  isOnline?: boolean;
  deliveriesCount?: number;
  className?: string;
}

export function DriverCard({
  name,
  photo,
  rating = 0,
  vehicle,
  plate,
  phone,
  isOnline = true,
  deliveriesCount,
  className,
}: DriverCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start gap-4">
        <Avatar src={photo} initials={name.charAt(0)} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-foreground truncate">{name}</h4>
            <Badge variant={isOnline ? 'success' : 'secondary'}>
              {isOnline ? 'En línea' : 'Desconectado'}
            </Badge>
          </div>
          {rating > 0 && (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
              {rating.toFixed(1)}
            </span>
          )}
          {vehicle && (
            <p className="mt-1 text-xs text-muted-foreground">
              {vehicle}{plate ? ` · ${plate}` : ''}
            </p>
          )}
          {deliveriesCount !== undefined && (
            <p className="text-xs text-muted-foreground">{deliveriesCount} entregas</p>
          )}
        </div>
        {phone && (
          <button className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5 text-primary transition-colors hover:bg-primary/10">
            <Phone className="h-4 w-4" />
          </button>
        )}
      </div>
    </Card>
  );
}
