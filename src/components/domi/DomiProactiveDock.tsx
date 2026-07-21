'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellRing, ChevronRight, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { requestDomiJson } from '@/lib/domi/client-ui';

interface DomiProactiveEvent {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  priority: string;
  createdAt: string;
}

interface ProactiveResponse {
  events?: DomiProactiveEvent[];
  settings?: { proactiveEnabled?: boolean };
}

export function DomiProactiveDock() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<DomiProactiveEvent[]>([]);
  const [visible, setVisible] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!profile) return;
    try {
      const data = await requestDomiJson<ProactiveResponse>('/api/domi/proactive');
      if (data.settings?.proactiveEnabled === false) {
        setEvents([]);
        setVisible(false);
        return;
      }
      const next = Array.isArray(data.events) ? data.events.slice(0, 5) : [];
      setEvents(next);
      setVisible(next.length > 0);
    } catch {
      // Los avisos proactivos nunca deben bloquear la aplicación.
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    void loadEvents();
    const interval = window.setInterval(() => void loadEvents(), 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [loadEvents, profile]);

  const updateEvent = async (eventId: string, status: 'read' | 'dismissed') => {
    setEvents((current) => current.filter((item) => item.id !== eventId));
    await fetch('/api/domi/proactive', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, status }),
    }).catch(() => undefined);
  };

  const event = events[0];
  if (!profile || !visible || !event) return null;
  return (
    <aside className="fixed bottom-[calc(13.5rem+env(safe-area-inset-bottom))] right-4 z-[1380] w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#FFC400]/35 bg-[#2C3138] text-white shadow-2xl lg:bottom-40">
      <div className="h-1 bg-[#FFC400]" />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-[#1A1D21]">
            <BellRing className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#FFC400]">Aviso de Domi</p>
            <h3 className="mt-1 text-sm font-black text-white">{event.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#F2F3F5]">{event.message}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {event.actionUrl && (
                <a
                  href={event.actionUrl}
                  onClick={() => void updateEvent(event.id, 'read')}
                  className="inline-flex min-h-9 items-center gap-1 rounded-xl bg-[#FFC400] px-3 text-xs font-black text-[#1A1D21]"
                >
                  Revisar <ChevronRight className="h-3.5 w-3.5" />
                </a>
              )}
              {events.length > 1 && (
                <span className="text-[10px] font-semibold text-[#D4D7DC]">+{events.length - 1} avisos pendientes</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void updateEvent(event.id, 'dismissed')}
            className="rounded-lg p-1 text-white hover:bg-white/10"
            aria-label="Descartar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
