'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Archive,
  Bot,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';

interface DomiNavigationLink {
  label: string;
  href: string;
}

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  suggestedActions?: string[];
  navigation?: DomiNavigationLink[];
}

interface DomiConversation {
  id: string;
  title: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  summary: string;
  activeGoal: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
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

const STATUS_LABEL: Record<DomiConversation['status'], string> = {
  active: 'Activa',
  paused: 'Pausada',
  completed: 'Completada',
  archived: 'Archivada',
};

function conversationContext() {
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

function browserContext(cart: {
  businessId: string | null;
  items: Array<{ product: { id: string }; quantity: number }>;
}) {
  return {
    ...conversationContext(),
    cart: {
      businessId: cart.businessId,
      items: cart.items.slice(0, 25).map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      })),
    },
  };
}

function safeNavigation(value: unknown): DomiNavigationLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as { label?: unknown; href?: unknown };
      if (typeof candidate.label !== 'string' || typeof candidate.href !== 'string') return null;
      const isCustomerRoute = candidate.href === '/cliente' || candidate.href.startsWith('/cliente/');
      if (!isCustomerRoute) return null;
      return { label: candidate.label.slice(0, 60), href: candidate.href.slice(0, 240) };
    })
    .filter((item): item is DomiNavigationLink => Boolean(item))
    .slice(0, 4);
}

function safeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Record<string, unknown>;
      if (candidate.role !== 'user' && candidate.role !== 'assistant') return null;
      return {
        id: typeof candidate.id === 'string' ? candidate.id : undefined,
        role: candidate.role,
        content: String(candidate.content || ''),
        createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : undefined,
        suggestedActions: Array.isArray(candidate.suggestedActions)
          ? candidate.suggestedActions.slice(0, 3).map(String)
          : [],
        navigation: safeNavigation(candidate.navigation),
      } satisfies ChatMessage;
    })
    .filter((item): item is ChatMessage => Boolean(item));
}

function relativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days} d`;
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' }).format(date);
}

export function DomiAssistant() {
  const { profile, isLoading } = useAuth();
  const cart = useCart();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [interfaceBlocked, setInterfaceBlocked] = useState(false);
  const [conversationId, setConversationId] = useState<string>();
  const [currentConversation, setCurrentConversation] = useState<DomiConversation>();
  const [conversations, setConversations] = useState<DomiConversation[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
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
    if (!open || historyOpen) return;
    window.setTimeout(() => endRef.current?.scrollIntoView({ block: 'end' }), 60);
  }, [messages, open, historyOpen, viewport.height]);

  const fetchConversations = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch('/api/domi/conversations?limit=50', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo cargar el historial');
      const rows = Array.isArray(data.conversations) ? data.conversations as DomiConversation[] : [];
      setConversations(rows);
      return rows;
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    setHistoryLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/domi/conversations/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo cargar la conversación');
      setConversationId(data.conversation.id);
      setCurrentConversation(data.conversation as DomiConversation);
      setMessages(safeMessages(data.messages));
      setHistoryOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la conversación');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || initialized || !profile) return;
    let cancelled = false;
    const initialize = async () => {
      try {
        const rows = await fetchConversations();
        if (cancelled) return;
        const latest = rows.find((item) => item.status === 'active')
          || rows.find((item) => item.status === 'paused')
          || rows.find((item) => item.status === 'completed');
        if (latest) await loadConversation(latest.id);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudo recuperar el historial');
      } finally {
        if (!cancelled) setInitialized(true);
      }
    };
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [fetchConversations, initialized, loadConversation, open, profile]);

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

  const createConversation = async () => {
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/domi/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: conversationContext() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo iniciar la conversación');
      setConversationId(data.conversation.id);
      setCurrentConversation(data.conversation as DomiConversation);
      setMessages([]);
      setMessage('');
      setHistoryOpen(false);
      await fetchConversations();
      window.setTimeout(() => textareaRef.current?.focus(), 100);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar la conversación');
    } finally {
      setSending(false);
    }
  };

  const patchConversation = async (id: string, patch: Record<string, string>) => {
    const response = await fetch(`/api/domi/conversations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo actualizar la conversación');
    const updated = data.conversation as DomiConversation;
    setCurrentConversation((current) => current?.id === updated.id ? updated : current);
    await fetchConversations();
    return updated;
  };

  const renameCurrent = async () => {
    if (!currentConversation) return;
    const title = window.prompt('Nuevo nombre de la conversación', currentConversation.title)?.trim();
    if (!title || title === currentConversation.title) return;
    try {
      await patchConversation(currentConversation.id, { title });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo renombrar');
    }
  };

  const archiveCurrent = async () => {
    if (!currentConversation || !window.confirm('¿Archivar esta conversación? Podrás restaurarla desde el historial.')) return;
    try {
      await patchConversation(currentConversation.id, { status: 'archived' });
      setHistoryOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo archivar');
    }
  };

  const deleteCurrent = async () => {
    if (!currentConversation || !window.confirm('¿Eliminar esta conversación y todos sus mensajes? Esta acción no se puede deshacer.')) return;
    try {
      const response = await fetch(`/api/domi/conversations/${encodeURIComponent(currentConversation.id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo eliminar la conversación');
      setConversationId(undefined);
      setCurrentConversation(undefined);
      setMessages([]);
      setHistoryOpen(true);
      await fetchConversations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar');
    }
  };

  const resumeCurrent = async () => {
    if (!currentConversation) return;
    setSending(true);
    try {
      await patchConversation(currentConversation.id, { status: 'active' });
      window.setTimeout(() => textareaRef.current?.focus(), 80);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo continuar la conversación');
    } finally {
      setSending(false);
    }
  };

  const send = async (override?: string) => {
    const text = (override ?? message).trim();
    if (!text || sending || (currentConversation && currentConversation.status !== 'active')) return;
    setMessage('');
    setError('');
    setMessages((current) => [...current, { id: `local-${Date.now()}`, role: 'user', content: text }]);
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
          context: browserContext(cart),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Domi no pudo responder');
      setConversationId(data.conversationId);
      const assistant = data.assistant as {
        message?: string;
        suggestedActions?: string[];
        navigation?: unknown;
      } | undefined;
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: String(assistant?.message || data.answer),
          suggestedActions: Array.isArray(assistant?.suggestedActions)
            ? assistant.suggestedActions.slice(0, 3).map(String)
            : [],
          navigation: safeNavigation(assistant?.navigation),
        },
      ]);
      const rows = await fetchConversations();
      const updated = rows.find((item) => item.id === data.conversationId);
      if (updated) setCurrentConversation(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo conectar con Domi');
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = useMemo(() => {
    const query = historyQuery.trim().toLocaleLowerCase('es');
    if (!query) return conversations;
    return conversations.filter((item) => `${item.title} ${item.summary}`.toLocaleLowerCase('es').includes(query));
  }, [conversations, historyQuery]);

  const mobileSheetHeight = viewport.keyboardOpen
    ? Math.max(320, viewport.height)
    : Math.max(420, Math.min(viewport.height * 0.86, viewport.height));

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
            className="flex min-h-0 w-full flex-col overflow-hidden rounded-t-[2rem] border bg-white shadow-2xl overscroll-contain sm:h-[720px] sm:max-h-[90dvh] sm:w-[440px] sm:rounded-[2rem]"
            style={viewport.isMobile ? {
              height: mobileSheetHeight,
              maxHeight: viewport.height,
            } : undefined}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex shrink-0 items-center gap-3 border-b bg-[#17191F] px-4 py-3 text-white">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFD400] text-[#17191F]"><Bot className="h-6 w-6" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="font-black">Domi</h2>
                <p className="truncate text-[11px] text-white/65">{ROLE_LABEL[profile.role] || 'Asistente DomiU'} · memoria separada por cuenta</p>
              </div>
              <button type="button" onClick={() => setHistoryOpen((value) => !value)} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${historyOpen ? 'bg-[#FFD400] text-[#17191F]' : 'hover:bg-white/10'}`} aria-label="Historial"><History className="h-5 w-5" /></button>
              <button type="button" onClick={() => void createConversation()} disabled={sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-white/10 disabled:opacity-40" aria-label="Nueva conversación"><Plus className="h-5 w-5" /></button>
              <button type="button" onClick={() => setOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-white/10" aria-label="Cerrar"><X className="h-5 w-5" /></button>
            </header>

            {historyOpen ? (
              <div className="flex min-h-0 flex-1 flex-col bg-[#F6F7F9]">
                <div className="shrink-0 border-b bg-white p-4">
                  <div className="flex items-center gap-2 rounded-2xl border bg-[#F8F9FA] px-3">
                    <Search className="h-4 w-4 text-[#8B929C]" />
                    <input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Buscar en el historial" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-[#17191F]">Tus conversaciones</h3>
                      <p className="text-[11px] text-[#7A828D]">Se conservan al cerrar la aplicación o cambiar de dispositivo.</p>
                    </div>
                    <button type="button" onClick={() => void createConversation()} disabled={sending} className="rounded-xl bg-[#FFD400] px-3 py-2 text-xs font-black text-[#17191F] disabled:opacity-50">Nueva</button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                  {historyLoading && <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#69717D]"><Loader2 className="h-4 w-4 animate-spin" />Cargando historial…</div>}
                  {!historyLoading && filteredConversations.length === 0 && (
                    <div className="rounded-2xl border bg-white p-5 text-center text-sm text-[#69717D]">No hay conversaciones que coincidan con la búsqueda.</div>
                  )}
                  {!historyLoading && filteredConversations.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => void loadConversation(item.id)}
                      className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-[#FFD400] ${conversationId === item.id ? 'border-[#FFD400] ring-2 ring-[#FFD400]/20' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF5B8] text-[#755D00]">
                          {item.status === 'active' ? <MessageCircle className="h-4 w-4" /> : item.status === 'archived' ? <Archive className="h-4 w-4" /> : item.status === 'completed' ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <strong className="truncate text-sm text-[#20242A]">{item.title}</strong>
                            <span className="shrink-0 text-[10px] text-[#8B929C]">{relativeDate(item.lastMessageAt)}</span>
                          </span>
                          <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-[#69717D]">{item.summary || 'Conversación nueva, todavía sin mensajes.'}</span>
                          <span className="mt-2 inline-flex rounded-full bg-[#F0F1F3] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[#606873]">{STATUS_LABEL[item.status]}</span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="flex shrink-0 items-center gap-2 border-b bg-white px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-[#30353C]">{currentConversation?.title || 'Nueva conversación'}</p>
                    <p className="truncate text-[10px] text-[#8B929C]">{currentConversation ? `${STATUS_LABEL[currentConversation.status]} · ${relativeDate(currentConversation.lastMessageAt)}` : 'Escribe para comenzar un hilo nuevo'}</p>
                  </div>
                  {currentConversation && <button type="button" onClick={() => void renameCurrent()} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#69717D] hover:bg-[#F0F1F3]" aria-label="Renombrar"><Pencil className="h-3.5 w-3.5" /></button>}
                  {currentConversation && currentConversation.status !== 'archived' && <button type="button" onClick={() => void archiveCurrent()} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#69717D] hover:bg-[#F0F1F3]" aria-label="Archivar"><Archive className="h-3.5 w-3.5" /></button>}
                  {currentConversation && <button type="button" onClick={() => void deleteCurrent()} className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50" aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[#F6F7F9] p-4">
                  {historyLoading && messages.length === 0 && <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#69717D]"><Loader2 className="h-4 w-4 animate-spin" />Recuperando conversación…</div>}
                  {!historyLoading && messages.length === 0 && (
                    <div className="rounded-2xl border bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-[#B38C00]" /><strong className="text-sm">Hola, {profile.first_name || 'bienvenido'}</strong></div>
                      <p className="mt-2 text-sm leading-relaxed text-[#69717D]">
                        {currentConversation?.summary
                          ? `Retomamos desde aquí: ${currentConversation.summary}`
                          : profile.role === 'customer'
                            ? 'Puedo buscar productos y negocios, verificar tu carrito y consultar únicamente tus pedidos. Esta conversación quedará guardada.'
                            : 'Puedo orientarte según tu perfil y la pantalla donde estás. Esta conversación quedará guardada y separada de tu memoria personal.'}
                      </p>
                    </div>
                  )}
                  {messages.map((item, index) => (
                    <div key={item.id || `${item.role}-${index}`} className={item.role === 'user' ? 'ml-8 rounded-2xl rounded-br-md bg-[#FFD400] px-4 py-3 text-sm font-medium text-[#17191F]' : 'mr-6 rounded-2xl rounded-bl-md border bg-white px-4 py-3 text-sm leading-relaxed text-[#30353C] shadow-sm'}>
                      <p>{item.content}</p>
                      {item.role === 'assistant' && item.navigation && item.navigation.length > 0 && (
                        <div className="mt-3 grid gap-2">
                          {item.navigation.map((link) => (
                            <a key={`${link.href}-${link.label}`} href={link.href} className="flex min-h-10 items-center justify-between rounded-xl bg-[#17191F] px-3 py-2 text-xs font-bold text-white transition hover:bg-black">
                              <span>{link.label}</span><span aria-hidden>→</span>
                            </a>
                          ))}
                        </div>
                      )}
                      {item.role === 'assistant' && item.suggestedActions && item.suggestedActions.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.suggestedActions.map((action) => (
                            <button key={action} type="button" disabled={sending || currentConversation?.status !== 'active'} onClick={() => void send(action)} className="rounded-full border border-[#D7B500]/40 bg-[#FFF9D6] px-3 py-1.5 text-[11px] font-bold text-[#5B4900] transition hover:bg-[#FFD400] disabled:opacity-50">{action}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {sending && <div className="mr-6 flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 text-sm text-[#69717D]"><Loader2 className="h-4 w-4 animate-spin" />Domi está consultando información autorizada…</div>}
                  {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
                  <div ref={endRef} className="h-px" />
                </div>

                <footer className="shrink-0 border-t bg-white p-3 pb-[calc(.75rem+env(safe-area-inset-bottom))]">
                  {currentConversation && currentConversation.status !== 'active' ? (
                    <button type="button" onClick={() => void resumeCurrent()} disabled={sending} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FFD400] px-4 text-sm font-black text-[#17191F] disabled:opacity-50"><RotateCcw className="h-4 w-4" />Restaurar y continuar esta conversación</button>
                  ) : (
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
                  )}
                  {!viewport.keyboardOpen && <p className="mt-2 text-center text-[9px] text-[#8B929C]">El historial del hilo y la memoria personal se guardan por separado y solo para tu cuenta.</p>}
                </footer>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );

  return createPortal(assistant, document.body);
}
