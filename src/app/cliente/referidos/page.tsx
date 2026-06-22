'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { clientService } from '@/services/client';
import { motion } from 'framer-motion';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Users, Copy, Check, Share2, Gift, TrendingUp } from 'lucide-react';

export default function ReferidosPage() {
  const { profile } = useAuth();
  const [info, setInfo] = useState<{ code: string; totalReferrals: number; convertedReferrals: number; earnings: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    clientService.getReferralInfo(profile.id).then(data => {
      setInfo(data);
      setLoading(false);
    });
  }, [profile?.id]);

  const handleCopy = async () => {
    if (!info?.code) return;
    try {
      await navigator.clipboard.writeText(info.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const handleShare = async () => {
    const text = `¡Únete a DomiU con mi código ${info?.code} y obtén $5 de descuento en tu primer pedido! 🎉`;
    if (navigator.share) {
      try { await navigator.share({ title: 'DomiU - Invita a tus amigos', text }); } catch {}
    } else {
      handleCopy();
    }
  };

  if (loading) return <div className="min-h-screen bg-background pb-16 lg:pb-0"><SkeletonCard /></div>;

  const referralLink = info?.code ? `https://domiu.app/referido/${info.code}` : '';

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      <div className="sticky top-0 z-30 bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <h1 className="text-base font-bold text-foreground">Invitar Amigos</h1>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500/90 via-rose-500/80 to-red-500/70 p-6 text-white text-center"
        >
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 mb-4">
              <Gift className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-xl font-black">Invita y Gana</h2>
            <p className="mt-1 text-sm text-white/80">Comparte tu código y ambos reciben $5 de descuento</p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-white/15 px-5 py-3">
                <code className="text-lg font-bold tracking-widest">{info?.code ?? '------'}</code>
                <button onClick={handleCopy} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/30">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              onClick={handleShare}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-rose-600 transition-all hover:bg-white/90"
            >
              <Share2 className="h-4 w-4" /> Compartir
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-border/30 bg-card/50 p-4 text-center">
            <Users className="mx-auto h-5 w-5 text-blue-500 mb-1.5" />
            <p className="text-xl font-bold text-foreground">{info?.totalReferrals ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">Invitados</p>
          </div>
          <div className="rounded-2xl border border-border/30 bg-card/50 p-4 text-center">
            <TrendingUp className="mx-auto h-5 w-5 text-emerald-500 mb-1.5" />
            <p className="text-xl font-bold text-foreground">{info?.convertedReferrals ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">Convertidos</p>
          </div>
          <div className="rounded-2xl border border-border/30 bg-card/50 p-4 text-center">
            <Gift className="mx-auto h-5 w-5 text-amber-500 mb-1.5" />
            <p className="text-xl font-bold text-foreground">${info?.earnings ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">Ganado</p>
          </div>
        </div>

        {referralLink && (
          <div className="rounded-2xl border border-border/30 bg-card/50 p-4">
            <p className="text-xs text-muted-foreground mb-2">Tu enlace de invitación:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                {referralLink}
              </code>
              <button onClick={handleCopy} className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:text-primary">
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border/30 bg-card/50 p-5">
          <h3 className="text-sm font-bold text-foreground mb-3">Cómo funciona</h3>
          <div className="space-y-3">
            {[
              { step: '1', text: 'Comparte tu código único con tus amigos' },
              { step: '2', text: 'Ellos se registran con tu código y obtienen $5 de descuento' },
              { step: '3', text: 'Cuando hagan su primer pedido, tú también ganas $5' },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{s.step}</div>
                <p className="text-xs text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
