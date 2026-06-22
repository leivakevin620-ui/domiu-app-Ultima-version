'use client';

import { AlertTriangle } from 'lucide-react';

interface PageErrorProps {
  error?: Error | null;
  resetErrorBoundary?: () => void;
}

export function PageError({ error, resetErrorBoundary }: PageErrorProps) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-lg backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="mt-6 text-xl font-semibold text-foreground">Algo sali贸 mal</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {error?.message || 'Ocurri贸 un error inesperado. Por favor, intenta de nuevo.'}
        </p>
        {resetErrorBoundary && (
          <button
            onClick={resetErrorBoundary}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
          >
            Intentar de nuevo
          </button>
        )}
      </div>
    </div>
  );
}
