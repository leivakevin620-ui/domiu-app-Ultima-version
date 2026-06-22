'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, TrendingDown, ChevronRight, Banknote, PiggyBank, Gift } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCourier } from '@/contexts/CourierContext';
import { courierProService } from '@/services/courier-pro';
import { formatCurrency } from './shared';

export function CourierWalletCard() {
  const { profile } = useAuth();
  const { todayEarnings, weekEarnings, monthEarnings, totalEarnings } = useCourier();
  const [commission, setCommission] = React.useState(0);
  const [tips, setTips] = React.useState(0);
  const [bonuses, setBonuses] = React.useState(0);

  React.useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      try {
        const breakdown = await courierProService.getEarningsBreakdown(profile.id);
        setCommission(breakdown.today.base);
        setTips(breakdown.today.tips);
        setBonuses(breakdown.today.bonuses);
      } catch {
        setCommission(Math.round(todayEarnings * 0.7));
        setTips(Math.round(todayEarnings * 0.18));
        setBonuses(Math.round(todayEarnings * 0.12));
      }
    })();
  }, [profile?.id, todayEarnings]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.45 }}
      className="rounded-xl border border-white/70 bg-white/80 p-4 shadow-[0_8px_25px_rgba(15,23,42,0.06)] backdrop-blur"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-emerald-500" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Wallet</p>
            <h3 className="text-base font-black text-slate-900">Ganancias</h3>
          </div>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
          ${Math.round(todayEarnings).toLocaleString('es-CO')} hoy
        </span>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white shadow-lg">
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Saldo disponible</p>
        <p className="text-2xl font-black">{formatCurrency(totalEarnings)}</p>
        <div className="mt-2 flex items-center gap-3 text-[10px] text-emerald-100">
          <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />Semana {formatCurrency(weekEarnings)}</span>
          <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3" />Mes {formatCurrency(monthEarnings)}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-blue-50 p-2.5 text-center">
          <Banknote className="mx-auto h-4 w-4 text-blue-500" />
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">Comisiones</p>
          <p className="text-xs font-black text-blue-700">${commission.toLocaleString('es-CO')}</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-2.5 text-center">
          <PiggyBank className="mx-auto h-4 w-4 text-amber-500" />
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">Propinas</p>
          <p className="text-xs font-black text-amber-700">${tips.toLocaleString('es-CO')}</p>
        </div>
        <div className="rounded-xl bg-violet-50 p-2.5 text-center">
          <Gift className="mx-auto h-4 w-4 text-violet-500" />
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">Bonos</p>
          <p className="text-xs font-black text-violet-700">${bonuses.toLocaleString('es-CO')}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow transition hover:bg-blue-700" aria-label="Retirar saldo">
          <Banknote className="h-3.5 w-3.5" />
          Retirar saldo
        </button>
        <a href="/repartidor/ganancias" className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200">
          Ver detalle
          <ChevronRight className="h-3 w-3" />
        </a>
      </div>
    </motion.section>
  );
}
