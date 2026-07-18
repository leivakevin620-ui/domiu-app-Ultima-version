'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const ROLE_LABEL: Record<string, string> = {
  customer: 'Asistente de cliente',
  merchant: 'Asistente de comercio',
  courier: 'Asistente de repartidor',
  admin: 'Asistente administrativo',
};

export function DomiAssistant() {
  const { profile, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string>();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  if (loading || !profile) return null;

  const send = async () => {
    const text = message.trim();
    if (!text || sending) return;
    setMessage('');
    setError('');
    setMessages((current) => [...current, { role: 'user', content: text }]);
    setSending(true);
    try {
      const response = await fetch('/api/domi/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Domi no pudo responder');
      setConversationId(data.conversationId);
      setMessages((current) => [...current, { role: 'assistant', content: String(data.answer) }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo conectar con Domi');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir Domi"
        className={`fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-[70] flex h-14 items-center gap-2 rounded-full bg-[#17191F] px-4 text-white shadow-2xl transition hover:-translate-y-0.5 lg:bottom-5 ${open ? 'pointer-events-none scale-90 opacity-0' : ''}`}
      >
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#FFD400] text-[#17191F]">
          <Sparkles className="h-5 w-5" />
          <span className="absolute inset-0 animate-ping rounded-full bg-[#FFD400]/30" />
        </span>
        <span className="text-left">
          <strong className="block text-sm leading-none">Domi</strong>
          <span className="mt-1 block text-[10px] text-white/65">Tu asistente</span>
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-end bg-black/35 p-0 backdrop-blur-sm sm:p-5" onClick={() => setOpen(false)}>
          <section
            className="flex h-[82dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border bg-white shadow-2xl sm:h-[680px] sm:max-h-[88dvh] sm:w-[420px] sm:rounded-[2rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-center gap-3 border-b bg-[#17191F] px-5 py-4 text-white">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFD400] text-[#17191F]"><Bot className="h-6 w-6" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="font-black">Domi</h2>
                <p className="truncate text-[11px] text-white/65">{ROLE_LABEL[profile.role] || 'Asistente DomiU'} · conocimiento verificado</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 hover:bg-white/10" aria-label="Cerrar"><X className="h-5 w-5" /></button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto bg-[#F6F7F9] p-4">
              {messages.length === 0 && (
                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-[#B38C00]" /><strong className="text-sm">Hola, {profile.first_name || 'bienvenido'}</strong></div>
                  <p className="mt-2 text-sm leading-relaxed text-[#69717D]">Pregúntame cómo usar tu perfil, abrir una jornada, entender un pedido, revisar una ganancia o aprender una función de DomiU.</p>
                </div>
              )}
              {messages.map((item, index) => (
                <div key={`${item.role}-${index}`} className={item.role === 'user' ? 'ml-10 rounded-2xl rounded-br-md bg-[#FFD400] px-4 py-3 text-sm font-medium text-[#17191F]' : 'mr-8 rounded-2xl rounded-bl-md border bg-white px-4 py-3 text-sm leading-relaxed text-[#30353C] shadow-sm'}>
                  {item.content}
                </div>
              ))}
              {sending && <div className="mr-8 flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 text-sm text-[#69717D]"><Loader2 className="h-4 w-4 animate-spin" />Domi está revisando la información…</div>}
              {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
              <div ref={endRef} />
            </div>

            <footer className="border-t bg-white p-3 pb-[calc(.75rem+env(safe-area-inset-bottom))]">
              <div className="flex items-end gap-2 rounded-2xl border bg-[#F8F9FA] p-2 focus-within:border-[#FFD400] focus-within:ring-2 focus-within:ring-[#FFD400]/20">
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  placeholder="Escribe tu pregunta…"
                  className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
                />
                <button type="button" onClick={() => void send()} disabled={!message.trim() || sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#17191F] text-white disabled:opacity-40" aria-label="Enviar"><Send className="h-4 w-4" /></button>
              </div>
              <p className="mt-2 text-center text-[9px] text-[#8B929C]">Domi usa información registrada. Verifica siempre cifras y operaciones críticas.</p>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
