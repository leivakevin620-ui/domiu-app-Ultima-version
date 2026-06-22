'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { clientService, PaymentMethod } from '@/services/client';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard } from '@/components/ui/skeleton';
import { logger } from '@/lib/logger';
import { CreditCard, Plus, Trash2, Star, Shield } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  credit_card: 'Tarjeta de Crédito',
  debit_card: 'Tarjeta de Débito',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  pse: 'PSE',
  cash: 'Efectivo',
};

const TYPE_COLORS: Record<string, string> = {
  credit_card: 'from-blue-500/20 to-blue-600/10 text-blue-500',
  debit_card: 'from-emerald-500/20 to-emerald-600/10 text-emerald-500',
  nequi: 'from-pink-500/20 to-pink-600/10 text-pink-500',
  daviplata: 'from-purple-500/20 to-purple-600/10 text-purple-500',
  pse: 'from-cyan-500/20 to-cyan-600/10 text-cyan-500',
  cash: 'from-amber-500/20 to-amber-600/10 text-amber-500',
};

export default function MetodosPagoPage() {
  const { profile } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'credit_card', brand: '', last_four: '', holder_name: '', expires_at: '', is_default: false });

  const load = () => {
    if (!profile?.id) return;
    clientService.getPaymentMethods(profile.id).then(data => {
      setMethods(data);
      setLoading(false);
    });
  };

  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });
  useEffect(() => { loadRef.current(); }, [profile?.id]);

  const handleSave = async () => {
    if (!profile?.id || saving) return;
    setSaving(true);
    try {
      await clientService.createPaymentMethod(profile.id, {
        type: form.type, brand: form.brand, last_four: form.last_four,
        holder_name: form.holder_name, expires_at: form.expires_at, is_default: form.is_default,
      });
      setForm({ type: 'credit_card', brand: '', last_four: '', holder_name: '', expires_at: '', is_default: false });
      setShowForm(false);
      load();
    } catch (e) {
      logger.error('Error al guardar método de pago', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await clientService.deletePaymentMethod(id);
    load();
  };

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      <div className="sticky top-0 z-30 bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <h1 className="text-base font-bold text-foreground">Métodos de Pago</h1>
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground">
              <Plus className="h-3.5 w-3.5" /> Agregar
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="overflow-hidden rounded-2xl border border-border/30 bg-card p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-foreground">Nuevo método de pago</h2>
              <button onClick={() => setShowForm(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {['credit_card', 'debit_card', 'nequi', 'daviplata', 'pse', 'cash'].map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, type: t }))}
                    className={`rounded-lg py-2 text-[11px] font-semibold transition-all ${
                      form.type === t ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
              <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="Marca (Visa, Mastercard...)" className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.last_four} maxLength={4} onChange={e => setForm(f => ({ ...f, last_four: e.target.value }))} placeholder="Últimos 4 dígitos" className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                <input value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} placeholder="Vence (MM/AA)" className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
              </div>
              <input value={form.holder_name} onChange={e => setForm(f => ({ ...f, holder_name: e.target.value }))} placeholder="Titular" className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} className="rounded border-border" />
                Establecer como método principal
              </label>
              <button onClick={handleSave} disabled={saving} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {saving ? 'Guardando...' : 'Agregar método de pago'}
              </button>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Shield className="h-3 w-3" /> Tus datos están seguros y encriptados
              </p>
            </div>
          </motion.div>
        )}

        {loading ? (
          <SkeletonCard />
        ) : methods.length === 0 && !showForm ? (
          <EmptyState
            icon={<CreditCard className="h-6 w-6" />}
            title="Sin métodos de pago"
            description="Agrega una tarjeta o método de pago para agilizar tus compras."
            action={
              <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
                <Plus className="h-4 w-4" /> Agregar método
              </button>
            }
          />
        ) : (
          <AnimatePresence>
            {methods.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.05 }}
                className="relative rounded-2xl border border-border/30 bg-card/50 p-5 transition-all hover:border-primary/20"
              >
                {m.is_default && (
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                    <Star className="h-3 w-3 fill-current" /> Principal
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${TYPE_COLORS[m.type] ?? 'from-muted to-muted/50 text-muted-foreground'}`}>
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{TYPE_LABELS[m.type] ?? m.type}</p>
                    {m.brand && <p className="text-xs text-muted-foreground">{m.brand}</p>}
                    {m.last_four && <p className="text-xs text-muted-foreground">**** {m.last_four}</p>}
                    {m.holder_name && <p className="text-xs text-muted-foreground">{m.holder_name}</p>}
                    {m.expires_at && <p className="text-xs text-muted-foreground">Vence {m.expires_at}</p>}
                  </div>
                </div>
                <div className="mt-3 flex items-center border-t border-border/20 pt-3">
                  <button onClick={() => handleDelete(m.id)} className="flex items-center gap-1 rounded-lg bg-muted/50 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50">
                    <Trash2 className="h-3 w-3" /> Eliminar
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
