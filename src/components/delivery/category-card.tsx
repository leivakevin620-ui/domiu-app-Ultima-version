'use client';

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

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
    <button
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-center gap-2 transition-all duration-200',
        active && 'scale-105',
        className,
      )}
    >
      <div
        className={cn(
          'relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl shadow-sm transition-all duration-300 group-hover:shadow-md group-hover:-translate-y-0.5',
          active ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'bg-muted'
        )}
      >
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            sizes="80px"
            className="object-cover transition-all duration-500 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center text-2xl transition-transform duration-500 group-hover:scale-110">
            {icon ?? <span className="text-muted-foreground/30">📁</span>}
          </div>
        )}
      </div>
      <div className="text-center">
        <span className="block text-xs font-semibold text-foreground truncate max-w-[80px] leading-tight">
          {name}
        </span>
        {productCount !== undefined && (
          <span className="text-[10px] text-muted-foreground">{productCount} lugares</span>
        )}
      </div>
    </button>
  );
}
