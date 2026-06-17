'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

interface AlertProps {
  variant?: AlertVariant;
  title: string;
  description?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const config: Record<AlertVariant, { icon: React.ReactNode; styles: string }> = {
  success: {
    icon: <CheckCircle className="h-5 w-5 text-success" />,
    styles: 'bg-success/5 border-success/20',
  },
  error: {
    icon: <AlertCircle className="h-5 w-5 text-destructive" />,
    styles: 'bg-destructive/5 border-destructive/20',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-warning" />,
    styles: 'bg-warning/5 border-warning/20',
  },
  info: {
    icon: <Info className="h-5 w-5 text-info" />,
    styles: 'bg-info/5 border-info/20',
  },
};

export function Alert({ variant = 'info', title, description, dismissible, onDismiss, className }: AlertProps) {
  const [hidden, setHidden] = React.useState(false);
  if (hidden) return null;

  const { icon, styles } = config[variant];

  return (
    <div className={cn('flex items-start gap-3 rounded-xl border p-4', styles, className)}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {dismissible && (
        <button
          onClick={() => { setHidden(true); onDismiss?.(); }}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
