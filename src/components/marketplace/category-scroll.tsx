'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import type { MarketplaceCategory } from '@/services/marketplace';

interface CategoryScrollProps {
  categories: MarketplaceCategory[];
}

export function CategoryScroll({ categories }: CategoryScrollProps) {
  const router = useRouter();

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
      <button
        onClick={() => router.push('/cliente/categories')}
        className="flex shrink-0 flex-col items-center gap-1.5"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-xl transition-colors hover:bg-muted/80">
          🎯
        </div>
        <span className="text-xs text-muted-foreground">Todas</span>
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => router.push(`/cliente/search?cat=${cat.id}`)}
          className="flex shrink-0 flex-col items-center gap-1.5"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-xl transition-colors hover:bg-muted/80">
            {cat.icon}
          </div>
          <span className="text-xs text-muted-foreground">{cat.name}</span>
        </button>
      ))}
    </div>
  );
}
