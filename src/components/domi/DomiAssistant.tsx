'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  suggestedActions?: string[];
}

interface MobileViewport {
  height: number;
  offsetTop: number;
  isMobile: boolean;
  keyboardOpen: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  customer: 'Asistente de cliente',
  merchant: 'Asistente de comercio',
  business: 'Asistente de comercio',
  courier: 'Asistente de repartidor',
  admin: 'Asistente administrativo',
  super_admin: 'Asistente administrativo',
  admin_general: 'Asistente administrativo',
  admin_financiero: 'Asistente financiero',
  admin_operativo: 'Asistente operativo',
  admin_comercial: 'Asistente comercial',
  admin_soporte: 'Asistente de soporte',
};

function browserContext() {
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);
  return {
    path,
    module: parts[0] || 'inicio',
    screen: parts.slice(1).join('/') || 'principal',
    locale: navigator.language || 'es-CO',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota',
  };
}

export function DomiAssistant() {
  const { profile, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [interfaceBlocked, setInterfaceBlocked] = useState(false);
  const [conversationId, setConversationId] = useState<string>();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [viewport, setViewport] = useState<MobileViewport>({
    height: 0,
    offsetTop: 0,
    isMobile: false,
    keyboardOpen: false,
  });
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const updateViewport = () => {
      const visualViewport = window.visualViewport;
      const height = Math.round(visualViewport?.height ?? window.innerHeight);
      const offsetTop = Math.round(visualViewport?.offsetTop ?? 0);
      const isMobile = window.matchMedia('(max-width: 639px)').matches;
      const keyboardOpen = isMobile && window.innerHeight - height > 120;
      setViewport({ height, offsetTop, isMobile, keyboardOpen });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('scroll', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
    };
  }, []);

  useEffect(() => {
    const handleAdminMenuState = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>;
      const blocked = Boolean(customEvent.detail?.open);
      setInterfaceBlocked(blocked);
      if (blocked) setOpen(false);
    };

    window.addEventListener('domiu:admin-menu-state', handleAdminMenuState);
    return () => window.removeEventListener('domiu:admin-menu-state', handleAdminMenuState);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => endRef.current?.scrollIntoView({ block: 'end' }), 60);
  }, [messages, open, viewport.height]);

  if (!mounted || isLoading || !profile) return null;

  const openAssistant = () => {
    window.dispatchEvent(new Event('domiu:close-admin-menu'));
    setOpen(true);
  };

  const focusComposer = () => {
    window.setTimeout(() => {
      endRef.current?.scrollIntoView({ block: 'end' });
      textareaRef.current?.scrollIntoView({ block: 'nearest' });
    }, 120);
  };

  const send = async (override?: string) => {
    const text = (override ?? message).trim();
    if (!text || sending) return;
    setMessage('');
    setError('');
    setMessages((current) => [...current, { role: 'user', content: text }]);
    setSending(true);
    try {
      const requestId = window.crypto?.randomUUID?.();
      const response = await fetch('/api/domi/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationId,
          ...(requestId ? { requestId } : {}),
          context: browserContext(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Domi no pudo responder');
      setConversationId(data.conversationId);
      const assistant = data.assistant as { message?: string; suggestedActions?: string[] } | undefined;
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: String(assistant?.message || data.answer),
          suggestedActions: Array.isArray(assistant?.suggestedActions)
            ? assistant.suggestedActions.slice(0, 3).map(String)
            : [],
        },
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo conectar con Domi');
    } finally {
      setSending(false);
    }
  };

  const mobileSheetHeight = viewport.keyboardOpen
    ? Math.max(320, viewport.height)
    : Math.max(420, Math.min(viewport.height * 0.82, viewport.height));

  const assistant = (
    <>
      <button
        type="button"
        onClick={openAssistant}
        aria-label="Abrir Domi"
        aria-hidden={interfaceBlocked}
        className={`fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-[1400] flex h-14 items-center gap-2 rounded-full bg-[#17191F] px-4 text-white shadow-2xl transition hover:-translate-y-0.5 lg:bottom-5 ${open || interfaceBlocked ? 'pointer-events-none scale-90 opacity-0' : ''}`}
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
        <div
          className="fixed inset-0 z-[1600] flex items-end justify-end overflow-hidden bg-black/45 p-0 backdrop-blur-sm sm:p-5"
          style={viewport.isMobile ? {
            top: viewport.offsetTop,
            bottom: 'auto',
            height: viewport.height,
          } : undefined}
          onClick={() => setOpen(false)}
        >
          <section
            className="flex min-h-0 w-full flex-col overflow-hidden rounded-t-[2rem] border bg-white shadow-2xl overscroll-contain sm:h-[680px] sm:max-h-[88dvh] sm:w-[420px] sm:rounded-[2rem]"
            style={viewport.isMobile ? {
              height: mobileSheetHeight,
              maxHeight: viewport.height,
            } : undefined}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex shrink-0 items-center gap-3 border-b bg-[#17191F] px-5 py-4 text-white">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFD400] text-[#17191F]"><Bot className="h-6 w-6" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="font-black">Domi</h2>
                <p className="truncate text-[11px] text-white/65">{ROLE_LABEL[profile.role] || 'Asistente DomiU'} · contexto protegido</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-white/10" aria-label="Cerrar"><X className="h-5 w-5" /></button>
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[#F6F7F9] p-4">
              {messages.length === 0 && (
                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-[#B38C00]" /><strong className="text-sm">Hola, {profile.first_name || 'bienvenido'}</strong></div>
                  <p className="mt-2 text-sm leading-relaxed text-[#69717D]">Puedo orientarte según tu perfil y la pantalla donde estás. Las acciones sensibles siempre requieren autorización.</p>
                </div>
              )}
              {messages.map((item, index) => (
                <div key={`${item.role}-${index}`} className={item.role === 'user' ? 'ml-8 rounded-2xl rounded-br-md bg-[#FFD400] px-4 py-3 text-sm font-medium text-[#17191F]' : 'mr-6 rounded-2xl rounded-bl-md border bg-white px-4 py-3 text-sm leading-relaxed text-[#30353C] shadow-sm'}>
                  <p>{item.content}</p>
                  {item.role === 'assistant' && item.suggestedActions && item.suggestedActions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.suggestedActions.map((action) => (
                        <button
                          key={action}
                          type="button"
                          disabled={sending}
                          onClick={() => void send(action)}
                          className="rounded-full border border-[#D7B500]/40 bg-[#FFF9D6] px-3 py-1.5 text-[11px] font-bold text-[#5B4900] transition hover:bg-[#FFD400] disabled:opacity-50"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {sending && <div className="mr-6 flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 text-sm text-[#69717D]"><Loader2 className="h-4 w-4 animate-spin" />Domi está validando tu contexto…</div>}
              {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
              <div ref={endRef} className="h-px" />
            </div>

            <footer className="shrink-0 border-t bg-white p-3 pb-[calc(.75rem+env(safe-area-inset-bottom))]">
              <div className="flex items-end gap-2 rounded-2xl border bg-[#F8F9FA] p-2 focus-within:border-[#FFD400] focus-within:ring-2 focus-within:ring-[#FFD400]/20">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onFocus={focusComposer}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  inputMode="text"
                  placeholder="Escribe tu pregunta…"
                  className="max-h-24 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-base outline-none"
                />
                <button type="button" onClick={() => void send()} disabled={!message.trim() || sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#17191F] text-white disabled:opacity-40" aria-label="Enviar"><Send className="h-4 w-4" /></button>
              </div>
              {!viewport.keyboardOpen && <p className="mt-2 text-center text-[9px] text-[#8B929C]">Domi valida sesión, rol y contexto. No comparte información entre cuentas.</p>}
            </footer>
          </section>
        </div>
      )}
    </>
  );

  return createPortal(assistant, document.body);
}
