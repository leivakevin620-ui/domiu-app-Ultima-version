'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-muted',
        className
      )}
    />
  );
}

export function BusinessCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex items-center gap-3 pt-1">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-5 w-12 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function CategoryScrollSkeleton() {
  return (
    <div className="flex gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex shrink-0 flex-col items-center gap-2">
          <Skeleton className="h-20 w-20 rounded-2xl" />
          <Skeleton className="h-3 w-14" />
        </div>
      ))}
    </div>
  );
}

export function PromoBannerSkeleton() {
  return (
    <Skeleton className="h-44 w-[280px] shrink-0 rounded-2xl sm:h-52 sm:w-[320px]" />
  );
}

export function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex items-center gap-3 pt-1">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-5 w-12 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border/50 bg-muted/20 px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-border/30">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3">
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonMap({ className }: SkeletonProps) {
  return (
    <div className={cn("flex h-[300px] w-full items-center justify-center rounded-xl border border-border bg-muted/30 lg:h-[400px]", className)}>
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-3 w-40" />
      </div>
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="mb-2 h-3 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="mt-1 h-2 w-12" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <Skeleton className="mb-4 h-4 w-32" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    </div>
  );
}
