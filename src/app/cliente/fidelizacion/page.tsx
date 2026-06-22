'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { clientService, LoyaltySummary, Reward, RewardRedemption } from '@/services/client';
import { motion } from 'framer-motion';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Gift, Award, Star, TrendingUp, Check, AlertCircle } from 'lucide-react';

const TIER_CONFIG: Record<string, { color: string; gradient: string; icon: React.ComponentType<{ className?: string }> }> = {
  Bronce: { color: 'text-amber-700', gradient: 'from-amber-400 to-amber-600', icon: Award },
  Plata: { color: 'text-slate-300', gradient: 'from-slate-300 to-slate-400', icon: Award },
  Oro: { color: 'text-yellow-500', gradient: 'from-yellow-400 to-yellow-600', icon: Star },
  Élite: { color: 'text-purple-400', gradient: 'from-purple-400 to-purple-600', icon: TrendingUp },
};

export default function FidelizacionPage() {
  const { profile } = useAuth();
  const [summary, setSummary] = useState<LoyaltySummary | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState('');

  const load = () => {
    if (!profile?.id) return;
    Promise.all([
      clientService.getLoyaltySummary(profile.id),
      clientService.getRewards(),
      clientService.getRedemptions(profile.id),
    ]).then(([s, r, rd]) => {
      setSummary(s);
      setRewards(r);
      setRedemptions(rd);
      setLoading(false);
    });
  };

  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });
  useEffect(() => { loadRef.current(); }, [profile?.id]);

  const handleRedeem = async (rewardId: string) => {
    if (!profile?.id || redeeming) return;
    setRedeeming(rewardId);
    setRedeemError('');
    setRedeemSuccess('');
    try {
      await clientService.redeemReward(profile.id, rewardId);
      setRedeemSuccess('Recompensa canjeada exitosamente');
      load();
    } catch (e: unknown) {
      setRedeemError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setRedeeming(null);
    }
  };

  if (loading) return <div className="min-h-screen bg-background pb-16 lg:pb-0"><SkeletonCard /></div>;
  if (!summary) return null;

  const tierConfig = TIER_CONFIG[summary.tier] ?? TIER_CONFIG.Bronce;

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      <div className="sticky top-0 z-30 bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <h1 className="text-base font-bold text-foreground">Fidelización</h1>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card/95 to-card/90 p-6 border border-border/30"
        >
          <div className={`absolute right-0 top-0 h-32 w-32 rounded-full bg-gradient-to-br ${tierConfig.gradient} opacity-10 blur-3xl`} />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Tu nivel</p>
                <h2 className="mt-1 text-2xl font-black text-foreground">{summary.tier}</h2>
              </div>
              <div className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${tierConfig.gradient} shadow-lg`}>
                <tierConfig.icon className="h-8 w-8 text-white" />
              </div>
            </div>
            <p className="mt-4 text-4xl font-black text-foreground">{summary.totalPoints.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Puntos disponibles</p>
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">{summary.tier}</span>
                <span className="text-xs font-semibold text-foreground">{summary.nextTier}</span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${summary.tierProgress}%` }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                  className={`h-full rounded-full bg-gradient-to-r ${tierConfig.gradient}`}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {summary.tier === 'Élite' ? 'Nivel máximo alcanzado' : `Te faltan ${summary.pointsToNextTier} puntos para ${summary.nextTier}`}
              </p>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              {summary.lifetimePoints.toLocaleString()} puntos ganados en total
            </p>
          </div>
        </motion.div>

        <div>
          <h2 className="text-base font-bold text-foreground mb-3">Canjear Puntos</h2>
          {redeemSuccess && (
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">
              <Check className="h-4 w-4" /> {redeemSuccess}
            </div>
          )}
          {redeemError && (
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4" /> {redeemError}
            </div>
          )}
          {rewards.length === 0 ? (
            <EmptyState icon={<Gift className="h-6 w-6" />} title="Sin recompensas disponibles" description="El administrador agregará recompensas pronto." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {rewards.map((r, i) => {
                const canAfford = summary.totalPoints >= r.points_required;
                const outOfStock = r.stock !== null && r.stock <= 0;
                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`rounded-2xl border p-5 transition-all ${
                      canAfford && !outOfStock
                        ? 'border-primary/20 bg-gradient-to-br from-card/90 to-card/60 hover:border-primary/40'
                        : 'border-border/20 bg-card/30 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${canAfford ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        <Gift className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{r.title}</p>
                        {r.description && <p className="text-xs text-muted-foreground truncate">{r.description}</p>}
                      </div>
                      {outOfStock && <span className="text-[10px] font-semibold text-red-500">Agotado</span>}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/20">
                      <span className="text-sm font-bold text-foreground">{r.points_required} pts</span>
                      <button
                        onClick={() => handleRedeem(r.id)}
                        disabled={!canAfford || outOfStock || redeeming === r.id}
                        className={`rounded-xl px-4 py-1.5 text-xs font-semibold transition-all ${
                          canAfford && !outOfStock
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50'
                            : 'bg-muted text-muted-foreground cursor-not-allowed'
                        }`}
                      >
                        {redeeming === r.id ? 'Canjeando...' : 'Canjear'}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {redemptions.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-foreground mb-3">Historial de Canjes</h2>
            <div className="space-y-2">
              {redemptions.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between rounded-xl border border-border/20 bg-card/30 p-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{r.reward_title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('es-MX')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-rose-500">-{r.points_spent} pts</p>
                    <span className={`text-[10px] font-semibold ${
                      r.status === 'completed' ? 'text-emerald-500' : r.status === 'cancelled' ? 'text-red-500' : 'text-amber-500'
                    }`}>
                      {r.status === 'completed' ? 'Completado' : r.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {summary.recentTransactions.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-foreground mb-3">Transacciones Recientes</h2>
            <div className="space-y-2">
              {summary.recentTransactions.slice(0, 10).map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-center justify-between rounded-xl border border-border/20 bg-card/30 p-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      t.points > 0 ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'
                    }`}>
                      {t.points > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <Gift className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{t.reason}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleDateString('es-MX')}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${t.points > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {t.points > 0 ? '+' : ''}{t.points} pts
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
