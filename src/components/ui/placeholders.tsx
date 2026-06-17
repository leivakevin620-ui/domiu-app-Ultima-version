'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Store, Package, User } from 'lucide-react';

export function BusinessPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-muted to-muted/50',
        className
      )}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <Store className="h-10 w-10 text-muted-foreground/20" />
        <p className="text-xs font-medium text-muted-foreground/40">Sin imagen</p>
      </div>
    </div>
  );
}

export function BusinessBannerPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative aspect-[2/1] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10',
        className
      )}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <Store className="h-8 w-8 text-primary/20" />
        <p className="text-xs font-medium text-primary/30">Sin banner</p>
      </div>
    </div>
  );
}

export function ProductPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative aspect-square w-full overflow-hidden rounded-2xl bg-gradient-to-br from-muted to-muted/50',
        className
      )}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <Package className="h-8 w-8 text-muted-foreground/20" />
        <p className="text-xs font-medium text-muted-foreground/40">Sin imagen</p>
      </div>
    </div>
  );
}

export function AvatarPlaceholder({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-20 w-20',
  };
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-gradient-to-br from-muted-foreground/10 to-muted-foreground/5',
        sizeClasses[size],
        className
      )}
    >
      <User className={cn('text-muted-foreground/30', size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-5 w-5' : 'h-8 w-8')} />
    </div>
  );
}

export function LogoPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-2xl bg-gradient-to-br from-muted-foreground/10 to-muted-foreground/5 p-4',
        className
      )}
    >
      <Store className="h-6 w-6 text-muted-foreground/30" />
    </div>
  );
}
