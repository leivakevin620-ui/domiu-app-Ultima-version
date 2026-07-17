'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Banknote, CreditCard, Landmark, LockKeyhole, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getBrowserClient } from '@/lib/db/supabase';
import { SkeletonCard } from '@/components/ui/skeleton';

type Config = {
  cash: boolean;
  transfer: boolean;
  provider: string;
  holder: string;
  identifier: string;
  instructions: string;
};

const INITIAL: Config = {
  cash: true,
  transfer: false,
  provider: 'Nequi',
  holder: '',
  identifier: '',
  instructions: 'Adjunta la referencia y el comprobante al confirmar el pedido.',
};

export default function BusinessPaymentSettingsPage() {
  const { profile } = useAuth();
  const [businessId, setBusinessId] = useState('');
  const [config, setConfig] = useState<Config>(INITIAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const supabase = getBrowserClient();
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', profile.id)
        .is('deleted_at', null)
        .maybeSingle();
      if (businessError) throw businessError;
      if (!business) throw new Error('No se encontró el negocio asociado');
      setBusinessId(String(business.id));

      const { data, error } = await supabase
        .from('business_payment_methods')
        .select('method,is_enabled,provider,account_holder,account_identifier,instructions')
        .eq('business_id', business.id);
      if (error) throw error;
      const cash = data?.find((row) => row.method === 'cash');
      const transfer = data?.find((row) => row.method === 'transfer');
      setConfig({
        cash: cash ? Boolean(cash.is_enabled) : true,
        transfer: Boolean(transfer?.is_enabled),
        provider: String(transfer?.provider || 'Nequi'),
        holder: String(transfer?.account_holder || ''),
        identifier: String(transfer?.account_identifier || ''),
        instructions: String(transfer?.instructions || INITIAL.instructions),
      });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudieron cargar los pagos');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!businessId || saving) return;
    if (!config.cash && !config.transfer) return toast.error('Activa al menos un método');
    if (config.transfer && (!config.provider.trim() || !config.holder.trim() || !config.identifier.trim())) {
      return toast.error('Completa los datos de la transferencia');
    }
    setSaving(true);
    try {
      const supabase = getBrowserClient();
      const { error } = await supabase.from('business_payment_methods').upsert([
        {
          business_id: businessId,
          method: 'cash',
          display_name: 'Efectivo contra entrega',
          is_enabled: config.cash,
          instructions: 'El cliente paga al recibir el pedido.',
          updated_at: new Date().toISOString(),
        },
        {
          business_id: businessId,
          method: 'transfer',
          display_name: `Transferencia por ${config.provider}`,
          is_enabled: config.transfer,
          provider: config.provider.trim() || null,
          account_holder: config.holder.trim() || null,
          account_identifier: config.identifier.trim() || null,
          instructions: config.instructions.trim() || null,
          updated_at: new Date().toISOString(),
        },
      ], { onConflict: 'business_id,method' });
      if (error) throw error;
      toast.success('Métodos de pago guardados');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudieron guardar los pagos');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SkeletonCard />;

  return (
    <main className="mx-auto max-w-4xl space-y-5 pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header><p className="text-xs font-bold uppercase tracking-wider text-primary">Configuración comercial</p><h1 className="mt-1 text-2xl font-black">Métodos de pago</h1><p className="mt-1 text-sm text-muted-foreground">El cliente solo verá opciones activas y completas.</p></header>

      <section className={`rounded-3xl border bg-card p-5 ${config.cash ? 'border-primary/40' : ''}`}>
        <div className="flex gap-4"><span className="rounded-2xl bg-success/10 p-3 text-success"><Banknote className="h-6 w-6" /></span><div className="flex-1"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-black">Efectivo contra entrega</h2><p className="mt-1 text-sm text-muted-foreground">El repartidor recibe el dinero al entregar.</p></div><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={config.cash} onChange={(e) => setConfig((c) => ({ ...c, cash: e.target.checked }))} />Activo</label></div></div></div>
      </section>

      <section className={`rounded-3xl border bg-card p-5 ${config.transfer ? 'border-primary/40' : ''}`}>
        <div className="flex gap-4"><span className="rounded-2xl bg-primary/10 p-3 text-primary"><Landmark className="h-6 w-6" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-black">Transferencia manual</h2><p className="mt-1 text-sm text-muted-foreground">Requiere referencia y comprobante del cliente.</p></div><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={config.transfer} onChange={(e) => setConfig((c) => ({ ...c, transfer: e.target.checked }))} />Activo</label></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted-foreground">Proveedor<select value={config.provider} onChange={(e) => setConfig((c) => ({ ...c, provider: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm text-foreground"><option>Nequi</option><option>Daviplata</option><option>Bancolombia</option><option>Davivienda</option><option>Otro</option></select></label>
            <label className="text-xs font-semibold text-muted-foreground">Titular<input value={config.holder} onChange={(e) => setConfig((c) => ({ ...c, holder: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm text-foreground" /></label>
            <label className="text-xs font-semibold text-muted-foreground sm:col-span-2">Identificador de pago<input value={config.identifier} onChange={(e) => setConfig((c) => ({ ...c, identifier: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm text-foreground" /></label>
            <label className="text-xs font-semibold text-muted-foreground sm:col-span-2">Instrucciones<textarea value={config.instructions} onChange={(e) => setConfig((c) => ({ ...c, instructions: e.target.value }))} rows={3} className="mt-1 w-full rounded-xl border bg-background px-3 py-3 text-sm text-foreground" /></label>
          </div>
        </div></div>
      </section>

      <section className="rounded-3xl border border-dashed bg-muted/30 p-5"><div className="flex gap-3"><CreditCard className="h-5 w-5 text-muted-foreground" /><div><h2 className="font-black">Pago electrónico</h2><p className="mt-1 text-sm text-muted-foreground">Permanecerá desactivado hasta conectar una pasarela y su webhook real.</p></div></div></section>
      <div className="flex gap-2 rounded-2xl bg-muted/60 p-4 text-xs text-muted-foreground"><LockKeyhole className="h-4 w-4 shrink-0" /><span>Los comprobantes son privados para cliente, negocio y administrador.</span></div>
      <button type="button" onClick={() => void save()} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-sm font-black text-primary-foreground disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Guardando…' : 'Guardar métodos de pago'}</button>
    </main>
  );
}
