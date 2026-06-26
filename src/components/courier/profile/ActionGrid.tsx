'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { Bike, MessageCircle, Wallet, History, Settings, LifeBuoy, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const actions = [
  { label: 'Pedidos activos', icon: Bike, href: '/repartidor/pedidos', color: 'from-blue-500/20 to-blue-600/10 text-blue-400' },
  { label: 'Chat', icon: MessageCircle, href: '/repartidor/chat', color: 'from-emerald-500/20 to-emerald-600/10 text-emerald-400' },
  { label: 'Ganancias', icon: Wallet, href: '/repartidor/ganancias', color: 'from-amber-500/20 to-amber-600/10 text-amber-400' },
  { label: 'Historial', icon: History, href: '/repartidor/pedidos', color: 'from-violet-500/20 to-violet-600/10 text-violet-400' },
  { label: 'Configuración', icon: Settings, href: '/repartidor/configuracion', color: 'from-sky-500/20 to-sky-600/10 text-sky-400' },
  { label: 'Soporte', icon: LifeBuoy, href: '/soporte', color: 'from-rose-500/20 to-rose-600/10 text-rose-400' },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemAnim = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export function ActionGrid() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.45 }}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#1E293B] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
    >
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-3 gap-2.5"
      >
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <motion.div key={action.label} variants={itemAnim}>
              <Link
                href={action.href}
                className="group relative flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-2 py-3.5 transition-all hover:border-white/20 hover:bg-white/[0.05]"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${action.color} ring-1 ring-white/5 transition group-hover:scale-110 group-hover:ring-white/10`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold text-white/70 text-center leading-tight">
                  {action.label}
                </span>
                <ArrowRight className="absolute right-2 top-2 h-3 w-3 text-white/20 opacity-0 transition group-hover:opacity-100" />
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      <Link
        href={'/repartidor/perfil'}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] py-2.5 text-[11px] font-bold text-white/60 transition hover:bg-white/[0.05] hover:text-white/80"
      >
        Ver perfil público
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </motion.section>
  );
}
