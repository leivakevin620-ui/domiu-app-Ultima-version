'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

interface OfflineProps {
  onRetry?: () => void;
}

export function Offline({ onRetry }: OfflineProps) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-warning/10">
          <WifiOff className="h-10 w-10 text-warning" />
        </div>
        <h2 className="mt-6 text-xl font-semibold text-foreground">Sin conexi贸n</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {isOnline
            ? 'La conexi贸n se ha restablecido.'
            : 'No tienes conexi贸n a internet. Verifica tu red e intenta de nuevo.'}
        </p>
        {isOnline ? (
          <button
            onClick={onRetry}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
          >
            Continuar
          </button>
        ) : (
          <button
            onClick={onRetry}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors disabled:opacity-50"
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}
