'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Clock } from 'lucide-react';

interface BusinessCardProps {
  name: string;
  image?: string;
  category?: string;
  rating?: number;
  deliveryTime?: string;
  deliveryFee?: string;
  isOpen?: boolean;
  className?: string;
}

export function BusinessCard({
  name,
  image,
  category,
  rating = 0,
  deliveryTime,
  deliveryFee,
  isOpen = true,
  className,
}: BusinessCardProps) {
  return (
    <Card hover className={cn('overflow-hidden', className)}>
      <div className="aspect-video w-full bg-muted">
        {image ? (
          <img src={image} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-muted-foreground/30">
            🏪
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-foreground truncate">{name}</h3>
            {category && <p className="text-xs text-muted-foreground">{category}</p>}
          </div>
          {!isOpen && <Badge variant="destructive">Cerrado</Badge>}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          {rating > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
              {rating.toFixed(1)}
            </span>
          )}
          {deliveryTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {deliveryTime}
            </span>
          )}
          {deliveryFee && <span>{deliveryFee}</span>}
        </div>
      </div>
    </Card>
  );
}
