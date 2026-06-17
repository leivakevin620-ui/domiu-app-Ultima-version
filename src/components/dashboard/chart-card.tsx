'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';

interface ChartCardProps {
  title: string;
  tabs?: { id: string; label: string }[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({ title, tabs, activeTab, onTabChange, children, className }: ChartCardProps) {
  return (
    <Card className={cn('p-6', className)}>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {tabs && activeTab && onTabChange && (
          <Tabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
        )}
      </div>
      {children}
    </Card>
  );
}
