'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { clientService, ClientStats } from '@/services/client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { logger } from '@/lib/logger';
import {
  User, Mail, Phone, MapPin, Heart, CreditCard, Ticket, Settings,
  Gift, Wallet, Users, HelpCircle, Bell,
  Edit2, Save, Package, DollarSign, PiggyBank, Star, Award
} from 'lucide-react';

const QUICK_LINKS = [
  { label: 'Direcciones', href: '/cliente/direcciones', icon: MapPin, color: 'text-blue-500' },
  { label: 'Favoritos', href: '/cliente/favoritos', icon: Heart, color: 'text-red-500' },
  { label: 'Métodos de pago', href: '/cliente/metodos-pago', icon: CreditCard, color: 'text-emerald-500' },
  { label: 'Cupones', href: '/cliente/cupones', icon: Ticket, color: 'text-purple-500' },
  { label: 'Fidelización', href: '/cliente/fidelizacion', icon: Gift, color: 'text-amber-500' },
  { label: 'Wallet', href: '/cliente/wallet', icon: Wallet, color: 'text-cyan-500' },
  { label: 'Referidos', href: '/cliente/referidos', icon: Users, color: 'text-pink-500' },
  { label: 'Soporte', href: '/cliente/soporte', icon: HelpCircle, color: 'text-indigo-500' },
  { label: 'Notificaciones', href: '/cliente/notificaciones', icon: Bell, color: 'text-yellow-500' },
  { label: 'Configuración', href: '/cliente/configuracion', icon: Settings, color: 'text-slate-500' },
];

export default function ClientePerfilPage() {
  const { profile, user, updateProfile } = useAuth();
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    clientService.getStats(profile.id).then(s => {
      setStats(s);
      setLoading(false);
    });
  }, [profile?.id]);

  useEffect(() => {
    if (profile && !editing) {
      const f = { first_name: profile.first_name ?? '', last_name: profile.last_name ?? '', phone: profile.phone ?? '' };
      Promise.resolve().then(() => setForm(f));
    }
  }, [profile, editing]);

  const handleSave = useCallback(async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      await updateProfile({ first_name: form.first_name, last_name: form.last_name, phone: form.phone });
      setEditing(false);
    } catch (e) {
      logger.error('Error updating profile', e);
    } finally {
      setSaving(false);
    }
  }, [profile?.id, form, updateProfile]);

  const initials = [profile?.first_name?.charAt(0), profile?.last_name?.charAt(0)].filter(Boolean).join('') || 'U';

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      <div className="sticky top-0 z-30 bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <h1 className="text-base font-bold text-foreground">Mi Perfil</h1>
          <button
            onClick={() => editing ? handleSave() : setEditing(true)}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/20 disabled:opacity-50"
          >
            {editing ? (
              <>{saving ? 'Guardando...' : <><Save className="h-3.5 w-3.5" /> Guardar</>}</>
            ) : (
              <><Edit2 className="h-3.5 w-3.5" /> Editar</>
            )}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-border/30 bg-gradient-to-br from-card via-card/95 to-card/90 p-6 shadow-sm"
        >
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
            <div className="relative group">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 via-primary/20 to-primary/10 text-2xl font-bold text-primary shadow-lg shadow-primary/10 ring-4 ring-background">
                {initials}
              </div>
            </div>
            <div className="flex-1 text-center sm:text-left">
              {editing ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={form.first_name}
                      onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                      className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="Nombre"
                    />
                    <input
                      value={form.last_name}
                      onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                      className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="Apellido"
                    />
                  </div>
                  <input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    placeholder="Teléfono"
                  />
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-foreground">
                    {profile?.first_name} {profile?.last_name}
                  </h2>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  {stats && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Miembro desde {new Date(stats.memberSince).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </>
              )}
            </div>
            {!editing && (
              <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary">
                <Star className="h-3.5 w-3.5" /> {stats?.tier ?? 'Bronce'}
              </div>
            )}
          </div>
        </motion.div>

        {stats && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard icon={Package} label="Pedidos" value={stats.totalOrders.toString()} color="text-blue-500" />
              <StatCard icon={DollarSign} label="Gastado" value={`$${stats.totalSpent.toFixed(0)}`} color="text-emerald-500" />
              <StatCard icon={PiggyBank} label="Ahorrado" value={`$${stats.totalSavings.toFixed(0)}`} color="text-violet-500" />
              <StatCard icon={Award} label="Puntos" value={stats.loyaltyPoints.toString()} color="text-amber-500" />
              <StatCard icon={Ticket} label="Cupones" value={stats.activeCoupons.toString()} color="text-rose-500" />
            </div>

            <div className="mt-4 rounded-2xl border border-border/30 bg-card/50 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-semibold text-foreground">Nivel {stats.tier}</span>
                </div>
                <span className="text-xs text-muted-foreground">{stats.nextTier}</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.tierProgress}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600"
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>0 pts</span>
                <span>{stats.tier === 'Élite' ? 'Máximo' : `${stats.tier === 'Bronce' ? 200 : stats.tier === 'Plata' ? 500 : 1000} pts`}</span>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5"
        >
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-border/30 bg-card/50 p-4 text-center transition-all hover:border-primary/20 hover:bg-card hover:shadow-lg hover:shadow-primary/5"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 transition-transform group-hover:scale-110 ${link.color}`}>
                <link.icon className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">{link.label}</span>
            </Link>
          ))}
        </motion.div>

        <div className="space-y-3">
          <InfoRow icon={Mail} label="Email" value={user?.email ?? ''} />
          <InfoRow icon={Phone} label="Teléfono" value={profile?.phone ?? 'No especificado'} />
          <InfoRow icon={User} label="Rol" value="Cliente" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl border border-border/30 bg-card/50 p-4 text-center transition-all hover:border-primary/10">
      <Icon className={`mx-auto mb-1.5 h-5 w-5 ${color}`} />
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/30 bg-card/50 p-4">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
