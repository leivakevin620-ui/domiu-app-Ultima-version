'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MessageCircle, LifeBuoy, ClipboardList } from 'lucide-react';

export default function RepartidorChatPage() {

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10">
          <MessageCircle className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Chat</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tus conversaciones</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-12 text-center shadow-card"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <MessageCircle className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="text-lg font-semibold text-foreground">No tienes conversaciones activas</p>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
          Las conversaciones aparecerán aquí cuando tengas pedidos activos o contactes a soporte.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/repartidor/pedidos"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-warning to-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 active:scale-95"
          >
            <ClipboardList className="h-4 w-4" />
            Ir a pedidos
          </Link>
          <Link href="/soporte"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:bg-muted"
          >
            <LifeBuoy className="h-4 w-4" />
            Contactar soporte
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
