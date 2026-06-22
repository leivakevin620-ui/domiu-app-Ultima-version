'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, ChevronRight, Send, User, Store } from 'lucide-react';

export function CourierChatPreview() {
  const [message, setMessage] = React.useState('');

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      className="rounded-xl border border-white/70 bg-white/80 p-4 shadow-[0_8px_25px_rgba(15,23,42,0.06)] backdrop-blur"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
            <MessageCircle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Chat</p>
            <h3 className="text-base font-black text-slate-900">Mensajes recientes</h3>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-violet-600 text-white shadow">
            <User className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-900">Pedido activo</p>
              <span className="text-[9px] text-slate-400">Hace 5 min</span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-600 truncate">Por favor llegar por la puerta principal</p>
            <div className="mt-2 flex items-center gap-1">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100">
                <Store className="h-3 w-3 text-amber-600" />
              </div>
              <span className="text-[10px] text-slate-500">Restaurante La Esquina</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Escribe un mensaje rápido..."
          className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none transition focus:border-violet-500 focus:ring-3 focus:ring-violet-500/10"
          aria-label="Escribir mensaje"
        />
        <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow transition hover:bg-violet-700" aria-label="Enviar mensaje">
          <Send className="h-4 w-4" />
        </button>
      </div>

      <a href="/repartidor/pedidos" className="mt-3 flex items-center justify-center gap-1 rounded-xl bg-slate-50 py-2 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100">
        Ir al chat completo <ChevronRight className="h-3 w-3" />
      </a>
    </motion.section>
  );
}
