'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Store, Package, User, ImageIcon } from 'lucide-react';

export function BusinessPlaceholder({ className }: { className?: string }) {
  return (
    <div className={cn('relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#FFF8D4] via-white to-[#EEF1F5]', className)}>
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#FFD400]/25" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm"><Store className="h-7 w-7 text-[#A17D00]" /></span>
        <p className="text-xs font-black text-[#68707D]">Imagen en validación</p>
      </div>
    </div>
  );
}

export function BusinessBannerPlaceholder({ className }: { className?: string }) {
  return (
    <div className={cn('relative aspect-[2/1] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#FFF9DC] via-[#FFF0A3] to-[#FFD400]', className)}>
      <div className="absolute -left-12 -top-16 h-48 w-48 rounded-full border-[26px] border-white/35" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"><Store className="h-9 w-9 text-[#6E5700]" /><p className="text-xs font-black text-[#6E5700]">Comercio local DomiU</p></div>
    </div>
  );
}

export function ProductPlaceholder({ className }: { className?: string }) {
  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-gradient-to-br from-[#FFF9DC] via-white to-[#EDF0F4]', className)} aria-label="Foto oficial en validación">
      <div className="absolute -right-7 -top-7 h-24 w-24 rounded-full bg-[#FFD400]/30" />
      <div className="absolute -bottom-8 -left-7 h-24 w-24 rounded-full border-[14px] border-[#FFD400]/15" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-2 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5"><ImageIcon className="h-6 w-6 text-[#A17D00]" /></span>
        <p className="max-w-28 text-[10px] font-black leading-tight text-[#626A75]">Foto oficial en validación</p>
      </div>
    </div>
  );
}

export function AvatarPlaceholder({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'h-8 w-8', md: 'h-12 w-12', lg: 'h-20 w-20' };
  return <div className={cn('flex items-center justify-center rounded-full bg-gradient-to-br from-muted-foreground/10 to-muted-foreground/5', sizeClasses[size], className)}><User className={cn('text-muted-foreground/30', size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-5 w-5' : 'h-8 w-8')} /></div>;
}

export function LogoPlaceholder({ className }: { className?: string }) {
  return <div className={cn('flex items-center justify-center rounded-2xl bg-gradient-to-br from-muted-foreground/10 to-muted-foreground/5 p-4', className)}><Package className="h-6 w-6 text-muted-foreground/30" /></div>;
}
