'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

interface DashboardCardProps {
  title: string;
  action?: {
    label: string;
    onClick?: () => void;
  };
  children: React.ReactNode;
  className?: string;
}

export function DashboardCard({ title, action, children, className }: DashboardCardProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-card', className)}>
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {action && (
          <button
            onClick={action.onClick}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {action.label}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}
