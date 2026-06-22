'use client';

import { AlertCircle } from 'lucide-react';

interface AsyncErrorFallbackProps {
  error?: Error | null;
  onRetry?: () => void;
}

export function AsyncErrorFallback({ error, onRetry }: AsyncErrorFallbackProps) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">Error al cargar datos</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {error?.message || 'No se pudieron obtener los datos solicitados.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
