'use client';

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { ProductPlaceholder } from '@/components/ui/placeholders';
import { Plus, Check, ShoppingBag } from 'lucide-react';

interface ProductCardProps {
  name: string;
  price: number;
  image?: string;
  description?: string;
  currency?: string;
  isAvailable?: boolean;
  category?: string;
  isAdded?: boolean;
  inCart?: boolean;
  onAdd?: () => void;
  onViewCart?: () => void;
  className?: string;
}

export function ProductCard({
  name,
  price,
  image,
  description,
  currency = '$',
  isAvailable = true,
  category,
  isAdded,
  inCart,
  onAdd,
  onViewCart,
  className,
}: ProductCardProps) {
  const [justAdded, setJustAdded] = React.useState(false);

  const handleAdd = () => {
    if (justAdded) return;
    setJustAdded(true);
    onAdd?.();
    setTimeout(() => setJustAdded(false), 1500);
  };

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1',
        !isAvailable && 'opacity-60',
        className,
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            className="object-cover transition-all duration-500 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <ProductPlaceholder />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/0 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {category && (
          <div className="absolute left-3 top-3 z-10">
            <span className="inline-flex items-center rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-foreground backdrop-blur-sm dark:bg-black/50 dark:text-white">
              {category}
            </span>
          </div>
        )}

        {!isAvailable && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <span className="rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground shadow-lg">
              No disponible
            </span>
          </div>
        )}

        {justAdded && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-success/30 backdrop-blur-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success shadow-xl">
              <Check className="h-7 w-7 text-white" />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-foreground truncate leading-tight">
              {name}
            </h4>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-base font-bold text-foreground tracking-tight">
            {currency}{price.toFixed(2)}
          </span>

          {isAvailable && onAdd && (
            justAdded || isAdded ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success text-white shadow-lg">
                <Check className="h-5 w-5" />
              </div>
            ) : inCart ? (
              <button
                onClick={onViewCart}
                className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-all duration-200 hover:bg-primary/20 active:scale-95"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                En carrito
              </button>
            ) : (
              <button
                onClick={handleAdd}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-200 hover:bg-primary/90 hover:shadow-xl active:scale-90"
              >
                <Plus className="h-5 w-5 transition-transform duration-200 group-hover:rotate-90" />
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
