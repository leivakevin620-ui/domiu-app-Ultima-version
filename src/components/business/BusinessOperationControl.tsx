'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Clock3, LockKeyhole, Power, RefreshCw, Store } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getBrowserClient } from '@/lib/db/supabase';
import { businessService } from '@/services/business';

interface BusinessOperationState {
  businessId: string;
  businessName: string;
  isOpen: boolean;
  openedAt: string | null;
  activeOrders: number;
}

function elapsedLabel(openedAt: string | null) {
  if (!openedAt) return 'Sin jornada activa';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(openedAt).getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours} h ${rest} min abierta` : `${rest} min abierta`;
}

export function BusinessOperationControl() {
  const { profile } = useAuth();
  const [state, setState] = useState<BusinessOperationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const businessId = await businessService.getBusinessId(profile.id);
      if (!businessId) throw new Error('No se encontró el comercio asociado');
      const supabase = getBrowserClient();
      const [businessResult, activeOrdersResult] = await Promise.all([
        supabase
          .from('businesses')
          .select('id,name,is_open,opened_at')
          .eq('id', businessId)
          .is('deleted_at', null)
          .maybeSingle(),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .in('status', [
            'pending',
            'confirmed',
            'preparing',
            'ready',
            'assigned',
            'accepted',
            'picked_up',
            'in_transit',
          ])
          .is('deleted_at', null),
      ]);
      if (businessResult.error || !businessResult.data) {
        throw new Error(businessResult.error?.message || 'No se pudo cargar el comercio');
      }
      setState({
        businessId,
        businessName: businessResult.data.name,
        isOpen: Boolean(businessResult.data.is_open),
        openedAt: businessResult.data.opened_at ? String(businessResult.data.opened_at) : null,
        activeOrders: activeOrdersResult.count ?? 0,
      });
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la jornada');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const toggle = async () => {
    if (!state || changing) return;
    setChanging(true);
    setError('');
    try {
      const supabase = getBrowserClient();
      const functionName = state.isOpen ? 'close_business_operation' : 'open_business_operation';
      const { error: rpcError } = await supabase.rpc(functionName, {
        p_business_id: state.businessId,
        p_note: state.isOpen ? 'Cierre desde el panel del comercio' : 'Apertura desde el panel del comercio',
      });
      if (rpcError) throw new Error(rpcError.message);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el estado');
    } finally {
      setChanging(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-3xl border bg-card p-5">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> Cargando jornada…
        </div>
      </section>
    );
  }

  return (
    <section
      className={`overflow-hidden rounded-3xl border p-5 shadow-sm ${
        state?.isOpen
          ? 'border-emerald-300/60 bg-gradient-to-br from-emerald-500/10 to-card'
          : 'border-slate-300/60 bg-gradient-to-br from-slate-500/10 to-card'
      }`}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
              state?.isOpen ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-white'
            }`}
          >
            {state?.isOpen ? <Store className="h-6 w-6" /> : <LockKeyhole className="h-6 w-6" />}
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Estado operativo
            </p>
            <h2 className="mt-1 text-xl font-black">
              {state?.isOpen ? 'Comercio abierto' : 'Comercio cerrado'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {state?.isOpen
                ? 'Los clientes pueden crear pedidos.'
                : 'La app bloqueará pedidos nuevos hasta abrir la jornada.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggle}
          disabled={changing || (state?.isOpen && (state.activeOrders ?? 0) > 0)}
          className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
            state?.isOpen
              ? 'bg-slate-900 text-white hover:bg-slate-800'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {changing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
          {state?.isOpen ? 'Cerrar operación' : 'Abrir operación'}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border bg-background/70 p-4">
          <Clock3 className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Jornada actual</p>
            <p className="text-sm font-bold">{elapsedLabel(state?.openedAt ?? null)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border bg-background/70 p-4">
          <Store className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Pedidos activos</p>
            <p className="text-sm font-bold">{state?.activeOrders ?? 0}</p>
          </div>
        </div>
      </div>

      {state?.isOpen && state.activeOrders > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Debes terminar o resolver los pedidos activos antes de cerrar la jornada.
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
