'use client';

import { ArrowLeft, FileQuestion } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <FileQuestion className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="mt-6 text-2xl font-semibold text-foreground">P谩gina no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La p谩gina que buscas no existe o ha sido movida.
        </p>
        <button
          onClick={() => router.back()}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
      </div>
    </div>
  );
}
