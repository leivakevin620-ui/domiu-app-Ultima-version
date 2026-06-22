'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SkeletonStats } from '@/components/ui/skeleton';
import { couponService } from '@/services/coupons';
import { referralService, loyaltyService } from '@/services/referrals';
import type { Coupon, CouponUsage } from '@/services/coupons';
import type { Reward, RewardRedemption } from '@/services/referrals';
import { Percent, Gift, Trophy, Plus, CheckCircle, XCircle, DollarSign, Users } from 'lucide-react';

type TabId = 'cupones' | 'referidos' | 'puntos' | 'recompensas';

function CouponRow({ coupon, onToggle }: { coupon: Coupon; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/50 p-3 hover:bg-muted/30 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <code className="rounded-lg bg-muted px-2 py-0.5 text-sm font-bold text-foreground">{coupon.code}</code>
          <Badge variant={coupon.type === 'percentage' ? 'default' : coupon.type === 'fixed' ? 'secondary' : 'info'}>
            {coupon.type === 'percentage' ? `${coupon.value}%` : coupon.type === 'fixed' ? `$${coupon.value}` : 'Envío gratis'}
          </Badge>
        </div>
        {coupon.description && <p className="mt-1 text-xs text-muted-foreground">{coupon.description}</p>}
        <p className="mt-0.5 text-[10px] text-muted-foreground/60">
          Mín: ${coupon.min_amount} · Máx desc: ${coupon.max_discount ?? '∞'} · Límite: {coupon.per_user_limit}/usuario
          {coupon.expires_at && ` · Exp: ${new Date(coupon.expires_at).toLocaleDateString()}`}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={coupon.is_active ? 'default' : 'secondary'}>{coupon.is_active ? 'Activo' : 'Inactivo'}</Badge>
        <button onClick={onToggle} className={`text-xs font-medium ${coupon.is_active ? 'text-destructive' : 'text-success'}`}>
          {coupon.is_active ? 'Desactivar' : 'Activar'}
        </button>
      </div>
    </div>
  );
}

export default function AdminPromociones() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<TabId>('cupones');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [usage, setUsage] = useState<CouponUsage[]>([]);
  const [usageStats, setUsageStats] = useState({ used: 0, users: 0, totalDiscount: 0 });
  const [refStats, setRefStats] = useState({ total: 0, converted: 0, pending: 0 });
  const [pointsStats, setPointsStats] = useState({ totalIssued: 0, totalRedeemed: 0, activeUsers: 0 });
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState('');
  const [newType, setNewType] = useState<'percentage' | 'fixed' | 'free_shipping'>('percentage');
  const [newValue, setNewValue] = useState('');
  const [showForm, setShowForm] = useState(false);

  const loadAll = () => {
    if (!profile?.id) return;
    Promise.all([
      couponService.getAll(),
      couponService.getUsage(),
      couponService.getUsageStats(),
      referralService.getStats(),
      loyaltyService.getPointsStats(),
      loyaltyService.getRewards(),
      loyaltyService.getRedemptions(),
    ])
      .then(([c, u, us, rs, ps, rw, rd]) => {
        setCoupons(c); setUsage(u); setUsageStats(us);
        setRefStats(rs); setPointsStats(ps); setRewards(rw); setRedemptions(rd);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (!newCode || !newValue) return;
    await couponService.create({
      code: newCode.toUpperCase(),
      type: newType,
      value: parseFloat(newValue),
      description: `Cupón de ${newType === 'percentage' ? newValue + '%' : '$' + newValue}`,
    });
    setNewCode(''); setNewValue(''); setShowForm(false); loadAll();
  };

  if (loading) return <SkeletonStats />;

  const tabs = [
    { id: 'cupones' as TabId, label: 'Cupones' },
    { id: 'referidos' as TabId, label: 'Referidos' },
    { id: 'puntos' as TabId, label: 'Puntos' },
    { id: 'recompensas' as TabId, label: 'Recompensas' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Promociones</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cupones, referidos, puntos y fidelización</p>
      </div>

      <Tabs tabs={tabs} activeTab={tab} onTabChange={(id) => setTab(id as TabId)} />

      {tab === 'cupones' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <StatCard icon={<Percent className="h-5 w-5" />} label="Cupones Creados" value={String(coupons.length)} gradient="primary" />
            <StatCard icon={<Gift className="h-5 w-5" />} label="Veces Usados" value={String(usageStats.used)} gradient="success" />
            <StatCard icon={<DollarSign className="h-5 w-5" />} label="Descuento Total" value={`$${usageStats.totalDiscount.toFixed(2)}`} gradient="warning" />
          </div>
          <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5">
              <h3 className="text-sm font-semibold text-foreground">Cupones</h3>
              <button onClick={() => setShowForm(!showForm)} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                {showForm ? 'Cancelar' : '+ Nuevo Cupón'}
              </button>
            </div>
            <div className="p-5 space-y-3">
              {showForm && (
                <div className="flex flex-wrap gap-3 rounded-xl border border-border/50 p-4 bg-muted/20 mb-3">
                  <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Código" className="w-40" />
                  <select value={newType} onChange={(e) => setNewType(e.target.value as 'percentage' | 'fixed' | 'free_shipping')} className="rounded-xl border border-border bg-background/50 px-3 py-2 text-sm">
                    <option value="percentage">% Descuento</option>
                    <option value="fixed">$ Fijo</option>
                    <option value="free_shipping">Envío Gratis</option>
                  </select>
                  <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Valor" type="number" className="w-24" />
                  <button onClick={handleCreate} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                    <Plus className="mr-1 inline h-4 w-4" /> Crear
                  </button>
                </div>
              )}
              {coupons.map((c) => (
                <CouponRow key={c.id} coupon={c} onToggle={() => couponService.toggleActive(c.id, !c.is_active).then(loadAll)} />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
            <div className="border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5">
              <h3 className="text-sm font-semibold text-foreground">Uso de Cupones</h3>
            </div>
            <div className="p-5 space-y-1">
              {usage.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Sin uso aún</p>
              ) : (
                usage.slice(0, 20).map((u: { id: string; user_id: string; discount_amount: number; profiles?: { first_name: string; last_name: string } | null }) => (
                  <div key={u.id} className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3 text-sm hover:bg-muted/30 transition-colors">
                    <span className="text-muted-foreground">{u.profiles ? `${u.profiles.first_name} ${u.profiles.last_name}` : u.user_id.slice(0, 8)}</span>
                    <span className="font-medium text-foreground">-${Number(u.discount_amount).toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'referidos' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <StatCard icon={<Gift className="h-5 w-5" />} label="Total Referidos" value={String(refStats.total)} gradient="primary" />
            <StatCard icon={<CheckCircle className="h-5 w-5" />} label="Convertidos" value={String(refStats.converted)} gradient="success" />
            <StatCard icon={<XCircle className="h-5 w-5" />} label="Pendientes" value={String(refStats.pending)} gradient="warning" />
          </div>
          <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
            <div className="border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5">
              <h3 className="text-sm font-semibold text-foreground">Estadísticas de Referidos</h3>
            </div>
            <div className="p-5 grid grid-cols-3 gap-4 text-center">
              <div className="rounded-xl border border-border/50 p-5">
                <p className="text-2xl font-bold text-primary">{refStats.total}</p>
                <p className="mt-1 text-xs text-muted-foreground">Total</p>
              </div>
              <div className="rounded-xl border border-border/50 p-5">
                <p className="text-2xl font-bold text-success">{refStats.converted}</p>
                <p className="mt-1 text-xs text-muted-foreground">Convertidos</p>
              </div>
              <div className="rounded-xl border border-border/50 p-5">
                <p className="text-2xl font-bold text-muted-foreground">{refStats.pending}</p>
                <p className="mt-1 text-xs text-muted-foreground">Pendientes</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'puntos' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <StatCard icon={<Trophy className="h-5 w-5" />} label="Puntos Emitidos" value={String(pointsStats.totalIssued)} gradient="primary" />
            <StatCard icon={<Gift className="h-5 w-5" />} label="Puntos Canjeados" value={String(pointsStats.totalRedeemed)} gradient="warning" />
            <StatCard icon={<Users className="h-5 w-5" />} label="Usuarios Activos" value={String(pointsStats.activeUsers)} gradient="success" />
          </div>
          <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
            <div className="border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5">
              <h3 className="text-sm font-semibold text-foreground">Estadísticas de Puntos</h3>
            </div>
            <div className="p-5 grid grid-cols-3 gap-4 text-center">
              <div className="rounded-xl border border-border/50 p-5">
                <p className="text-2xl font-bold text-primary">{pointsStats.totalIssued}</p>
                <p className="mt-1 text-xs text-muted-foreground">Emitidos</p>
              </div>
              <div className="rounded-xl border border-border/50 p-5">
                <p className="text-2xl font-bold text-destructive">{pointsStats.totalRedeemed}</p>
                <p className="mt-1 text-xs text-muted-foreground">Canjeados</p>
              </div>
              <div className="rounded-xl border border-border/50 p-5">
                <p className="text-2xl font-bold text-success">{pointsStats.totalIssued - pointsStats.totalRedeemed}</p>
                <p className="mt-1 text-xs text-muted-foreground">En Circulación</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'recompensas' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
            <div className="border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5">
              <h3 className="text-sm font-semibold text-foreground">Catálogo de Recompensas</h3>
            </div>
            <div className="p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {rewards.map((r) => (
                <div key={r.id} className="rounded-xl border border-border/50 p-5 text-center hover:bg-muted/20 transition-colors">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-primary/5">
                    <Trophy className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{r.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                  <p className="mt-2 text-lg font-bold text-primary">{r.points_required} pts</p>
                  <Badge variant={r.is_active ? 'default' : 'secondary'} className="mt-1">{r.is_active ? 'Activo' : 'Inactivo'}</Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
            <div className="border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5">
              <h3 className="text-sm font-semibold text-foreground">Canjes Recientes</h3>
            </div>
            <div className="p-5 space-y-1">
              {redemptions.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Sin canjes aún</p>
              ) : (
                redemptions.slice(0, 20).map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3 text-sm hover:bg-muted/30 transition-colors">
                    <span className="text-muted-foreground">{r.user_id.slice(0, 8)}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-foreground">{r.points_spent} pts</span>
                      <Badge variant={r.status === 'completed' ? 'default' : r.status === 'pending' ? 'secondary' : 'destructive'}>
                        {r.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
