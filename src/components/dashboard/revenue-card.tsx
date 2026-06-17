'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface RevenueCardProps {
  title: string;
  amount: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

export function RevenueCard({ title, amount, subtitle, children, className }: RevenueCardProps) {
  return (
    <Card className={cn('p-6', className)}>
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{amount}</p>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="border-t border-border pt-4">{children}</div>}
    </Card>
  );
}
