'use client';

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { BusinessPlaceholder } from '@/components/ui/placeholders';
import { Star, MapPin, Timer } from 'lucide-react';

interface BusinessCardProps {
  name: string;
  image?: string;
  logo?: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
  deliveryTime?: string;
  deliveryFee?: string;
  isOpen?: boolean;
  isFeatured?: boolean;
  distance?: string;
  promotion?: string;
  className?: string;
}

export function BusinessCard({
  name,
  image,
  logo,
  category,
  rating = 0,
  reviewCount,
  deliveryTime,
  deliveryFee,
  isOpen = true,
  isFeatured,
  distance,
  promotion,
  className,
}: BusinessCardProps) {
  return (
    <div className={cn('group cursor-pointer', className)}>
      <div className="relative mb-3 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted shadow-md transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-0.5">
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-all duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <BusinessPlaceholder />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-transparent" />

        {promotion && (
          <div className="absolute left-3 top-3 z-10">
            <Badge variant="warning" className="bg-warning text-warning-foreground shadow-lg">
              {promotion}
            </Badge>
          </div>
        )}

        {isFeatured && (
          <div className="absolute right-3 top-3 z-10">
            <Badge variant="default" className="bg-white/90 text-foreground shadow-lg backdrop-blur-sm">
              Destacado
            </Badge>
          </div>
        )}

        {!isOpen && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <Badge variant="destructive" className="px-4 py-1.5 text-sm shadow-lg">
              Cerrado
            </Badge>
          </div>
        )}

        <div className="absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between">
          <div className="flex items-center gap-1.5">
            {distance && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
                <MapPin className="h-3 w-3" />
                {distance}
              </span>
            )}
            {deliveryTime && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
                <Timer className="h-3 w-3" />
                {deliveryTime}
              </span>
            )}
          </div>
          {rating > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-foreground shadow-sm">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-start gap-3">
        {logo && (
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border shadow-sm">
            <Image
              src={logo}
              alt={name}
              fill
              sizes="48px"
              className="object-cover"
              loading="lazy"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground truncate leading-tight">
            {name}
          </h3>
          {category && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{category}</p>
          )}
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {reviewCount !== undefined && reviewCount > 0 && (
              <span className="text-muted-foreground/60">{reviewCount}+ pedidos</span>
            )}
            {deliveryFee && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span>{deliveryFee}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
