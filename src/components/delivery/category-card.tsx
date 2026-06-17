'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface CategoryCardProps {
  name: string;
  icon?: React.ReactNode;
  productCount?: number;
  image?: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function CategoryCard({
  name,
  icon,
  productCount,
  image,
  active,
  onClick,
  className,
}: CategoryCardProps) {
  return (
    <Card
      hover
      onClick={onClick}
      className={cn(
        'cursor-pointer overflow-hidden p-4 text-center transition-all',
        active && 'ring-2 ring-primary',
        className,
      )}
    >
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-2xl">
        {image ? (
          <img src={image} alt={name} className="h-full w-full rounded-full object-cover" />
        ) : (
          icon ?? <span className="text-muted-foreground/30">📁</span>
        )}
      </div>
      <h4 className="text-sm font-medium text-foreground truncate">{name}</h4>
      {productCount !== undefined && (
        <p className="mt-0.5 text-xs text-muted-foreground">{productCount} productos</p>
      )}
    </Card>
  );
}
