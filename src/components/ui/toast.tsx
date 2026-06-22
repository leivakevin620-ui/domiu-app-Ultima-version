'use client';

import React from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-success" />,
  error: <AlertCircle className="h-5 w-5 text-destructive" />,
  warning: <AlertTriangle className="h-5 w-5 text-warning" />,
  info: <Info className="h-5 w-5 text-info" />,
};

export function Toast({ open, onClose, title, description, variant = 'info', duration = 4000 }: ToastProps) {
  React.useEffect(() => {
    if (open && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [open, duration, onClose]);

  if (!open) return null;

  return (
    <div className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 animate-slide-up lg:bottom-6">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-dropdown">
        <span className="mt-0.5 shrink-0">{icons[variant]}</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        <button onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors" aria-label="Cerrar notificación">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
