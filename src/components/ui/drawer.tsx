'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: 'left' | 'right';
  className?: string;
}

export function Drawer({ open, onClose, title, children, side = 'right', className }: DrawerProps) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={title ? 'drawer-title' : undefined}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-label="Cerrar" />
      <div
        className={cn(
          'fixed inset-y-0 z-10 flex w-full max-w-md flex-col border-border bg-card shadow-drawer animate-slide-up',
          side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 id="drawer-title" className="text-lg font-semibold text-foreground">{title}</h2>
            <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Cerrar panel">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
