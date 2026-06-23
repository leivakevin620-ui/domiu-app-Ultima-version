'use client';

import { AlertTriangle } from 'lucide-react';

interface PageErrorProps {
  error?: { message: string; name: string; stack?: string } | Error | null;
  resetErrorBoundary?: () => void;
}

export function PageError({ error, resetErrorBoundary }: PageErrorProps) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-lg backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="mt-6 text-xl font-semibold text-foreground">Algo sali&oacute; mal</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {(error && typeof error === 'object' && 'message' in error ? error.message : null) || 'Ocurri\u00f3 un error inesperado. Por favor, intenta de nuevo.'}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
          >
            Recargar p&aacute;gina
          </button>
          {resetErrorBoundary && (
            <button
              onClick={resetErrorBoundary}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Reintentar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
