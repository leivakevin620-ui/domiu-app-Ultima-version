'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Bell, Circle, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

export function BusinessHeader() {
  const { profile } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-xl px-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-success/10 to-success/5 border border-success/20 px-3 py-1.5">
          <Circle className="h-2.5 w-2.5 fill-success text-success" />
          <span className="text-xs font-medium text-success">Abierto</span>
        </div>
        <span className="text-xs text-muted-foreground">Hoy: 8:00 AM - 10:00 PM</span>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => toast.info('Función en preparación: notificaciones')} className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">3</span>
        </button>
        <button onClick={() => router.push('/negocio/configuracion')} className="flex items-center gap-2 rounded-xl border border-border/50 px-3 py-1.5 transition-colors hover:bg-muted">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-warning/10 to-warning/5 text-xs font-bold text-warning">
            {profile?.first_name?.[0] || 'N'}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-xs font-medium text-foreground leading-tight">{profile?.first_name || 'Negocio'}</p>
            <p className="text-[10px] text-muted-foreground">Vendedor</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
