'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Package, ChefHat, Truck, MapPin, CheckCircle } from 'lucide-react';

interface TrackingStep {
  label: string;
  time?: string;
  completed: boolean;
  active?: boolean;
}

interface TrackingCardProps {
  steps: TrackingStep[];
  currentStatus: string;
  estimatedTime?: string;
  className?: string;
}

const defaultSteps: TrackingStep[] = [
  { label: 'Pedido confirmado', completed: false },
  { label: 'Preparando', completed: false },
  { label: 'En camino', completed: false },
  { label: 'Entregado', completed: false },
];

const stepIcons = [Package, ChefHat, Truck, MapPin];

export function TrackingCard({
  steps = defaultSteps,
  currentStatus,
  estimatedTime,
  className,
}: TrackingCardProps) {
  return (
    <Card className={cn('p-6', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Estado del Pedido</h3>
        {estimatedTime && (
          <span className="text-xs text-muted-foreground">Llegada estimada: {estimatedTime}</span>
        )}
      </div>
      <div className="relative">
        {steps.map((step, i) => {
          const Icon = stepIcons[i] ?? CheckCircle;
          const isLast = i === steps.length - 1;
          return (
            <div key={step.label} className="flex gap-4 pb-8 last:pb-0">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
                    step.completed
                      ? 'border-success bg-success text-white'
                      : step.active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted-foreground/30 bg-muted text-muted-foreground/50',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      'mt-1 w-0.5 flex-1',
                      step.completed ? 'bg-success' : 'bg-border',
                    )}
                  />
                )}
              </div>
              <div className="flex-1 pb-4">
                <p
                  className={cn(
                    'text-sm font-medium',
                    step.completed
                      ? 'text-foreground'
                      : step.active
                        ? 'text-foreground'
                        : 'text-muted-foreground/60',
                  )}
                >
                  {step.label}
                </p>
                {step.time && <p className="text-xs text-muted-foreground">{step.time}</p>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 rounded-xl bg-muted p-3">
        <p className="text-sm font-medium text-foreground">{currentStatus}</p>
      </div>
    </Card>
  );
}
