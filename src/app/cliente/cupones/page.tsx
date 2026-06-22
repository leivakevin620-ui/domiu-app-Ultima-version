'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { clientService, CouponAvailable, CouponUsageRecord } from '@/services/client';
import { motion } from 'framer-motion';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Ticket, Percent, DollarSign, Truck, Clock, Copy, Check } from 'lucide-react';

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  percentage: Percent,
  fixed: DollarSign,
  free_shipping: Truck,
};

export default function CuponesPage() {
  const { profile } = useAuth();
  const [coupons, setCoupons] = useState<CouponAvailable[]>([]);
  const [usageHistory, setUsageHistory] = useState<CouponUsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'available' | 'used'>('available');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    Promise.all([
      clientService.getAvailableCoupons(),
      clientService.getCouponUsage(profile.id),
    ]).then(([c, u]) => {
      setCoupons(c);
      setUsageHistory(u);
      setLoading(false);
    });
  }, [profile?.id]);

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };

  if (loading) return <div className="min-h-screen bg-background pb-16 lg:pb-0"><div className="mx-auto max-w-7xl px-4 py-8"><SkeletonCard /></div></div>;

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      <div className="sticky top-0 z-30 bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <h1 className="text-base font-bold text-foreground">Cupones</h1>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex gap-1 rounded-xl bg-muted/50 p-1">
          {(['available', 'used'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {t === 'available' ? 'Disponibles' : 'Usados'} ({t === 'available' ? coupons.length : usageHistory.length})
            </button>
          ))}
        </div>

        {tab === 'available' ? (
          coupons.length === 0 ? (
            <EmptyState icon={<Ticket className="h-6 w-6" />} title="Sin cupones disponibles" description="No hay cupones activos por el momento. Vuelve pronto." />
          ) : (
            <motion.div className="space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {coupons.map((c, i) => {
                const Icon = TYPE_ICONS[c.type] ?? Ticket;
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="group relative overflow-hidden rounded-2xl border border-dashed border-border/50 bg-gradient-to-r from-card/80 to-card/40 p-5 transition-all hover:border-primary/30"
                  >
                    <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-primary/5 to-transparent" />
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-foreground tracking-wider">{c.code}</span>
                          <button
                            onClick={() => handleCopy(c.code)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:text-primary"
                          >
                            {copied === c.code ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          {c.min_amount > 0 && <span>Mín: ${c.min_amount.toFixed(2)}</span>}
                          {c.max_discount && <span>Máx desc: ${c.max_discount.toFixed(2)}</span>}
                          {c.expires_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {new Date(c.expires_at).toLocaleDateString('es-MX')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xl font-black text-foreground">
                          {c.type === 'percentage' ? `${c.value}%` : c.type === 'free_shipping' ? 'Gratis' : `$${c.value.toFixed(0)}`}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase">
                          {c.type === 'percentage' ? 'DESCUENTO' : c.type === 'free_shipping' ? 'ENVÍO' : 'DESCUENTO'}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )
        ) : (
          usageHistory.length === 0 ? (
            <EmptyState icon={<Ticket className="h-6 w-6" />} title="Sin historial" description="Aún no has usado ningún cupón." />
          ) : (
            <motion.div className="space-y-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {usageHistory.map((u, i) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between rounded-xl border border-border/20 bg-card/30 p-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{u.coupon?.code ?? 'Cupón'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString('es-MX')}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-500">-${u.discount_amount.toFixed(2)}</span>
                </motion.div>
              ))}
            </motion.div>
          )
        )}
      </div>
    </div>
  );
}
