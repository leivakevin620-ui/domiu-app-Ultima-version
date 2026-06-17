'use client';

import React from 'react';

interface DriverStatsCardProps {
  label: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function DriverStatsCard({ label, value, subtitle, trend }: DriverStatsCardProps) {
  const trendColors: Record<string, string> = {
    up: 'text-success',
    down: 'text-destructive',
    neutral: 'text-muted-foreground',
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      {subtitle && (
        <p className={`mt-1 text-xs ${trend ? trendColors[trend] : 'text-muted-foreground'}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
