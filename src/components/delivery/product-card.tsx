'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Plus } from 'lucide-react';

interface ProductCardProps {
  name: string;
  price: number;
  image?: string;
  description?: string;
  currency?: string;
  onAdd?: () => void;
  className?: string;
}

export function ProductCard({
  name,
  price,
  image,
  description,
  currency = '$',
  onAdd,
  className,
}: ProductCardProps) {
  return (
    <Card hover className={cn('overflow-hidden', className)}>
      <div className="flex gap-4 p-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
          {image ? (
            <img src={image} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-2xl text-muted-foreground/30">
              🍽️
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col justify-between min-w-0">
          <div>
            <h4 className="text-sm font-medium text-foreground truncate">{name}</h4>
            {description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{description}</p>}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              {currency}
              {price.toFixed(2)}
            </span>
            {onAdd && (
              <button
                onClick={onAdd}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
