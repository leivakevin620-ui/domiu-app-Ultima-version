'use client';

import { useEffect, useState } from 'react';
import { MessageSquareWarning, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isDomiUuid } from '@/lib/domi/client-ui';

interface FeedbackTarget {
  conversationId: string;
  message: string;
}

function targetFromPayload(value: unknown): FeedbackTarget | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Record<string, unknown>;
  const assistant = payload.assistant && typeof payload.assistant === 'object'
    ? payload.assistant as Record<string, unknown>
    : {};
  if (!isDomiUuid(payload.conversationId) || typeof assistant.message !== 'string') return null;
  return {
    conversationId: payload.conversationId,
    message: assistant.message.slice(0, 500),
  };
}

export function DomiFeedbackDock() {
  const { profile } = useAuth();
  const [target, setTarget] = useState<FeedbackTarget | null>(null);
  const [negativeOpen, setNegativeOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const handleResponse = (event: Event) => {
      const next = targetFromPayload((event as CustomEvent<unknown>).detail);
      if (!next) return;
      setTarget(next);
      setNegativeOpen(false);
      setComment('');
      setSubmitted(false);
    };
    window.addEventListener('domiu:domi-agent-response', handleResponse);
    return () => window.removeEventListener('domiu:domi-agent-response', handleResponse);
  }, []);

  const submit = async (rating: -1 | 1) => {
    if (!target) return;
    const response = await fetch('/api/domi/feedback', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: target.conversationId,
        rating,
        category: rating === 1 ? 'helpfulness' : 'accuracy',
        comment: rating === -1 ? comment.trim() || 'La respuesta no resolvió correctamente la solicitud.' : null,
      }),
    });
    if (response.ok) {
      setSubmitted(true);
      setNegativeOpen(false);
      window.setTimeout(() => setTarget(null), 2200);
    }
  };

  if (!profile || !target) return null;
  return (
    <aside className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 z-[1370] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[#3A4048] bg-[#2C3138] p-3 text-white shadow-xl lg:bottom-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-[#1A1D21]">
          <MessageSquareWarning className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          {submitted ? (
            <p className="py-2 text-xs font-bold text-[#FFC400]">Evaluación guardada para revisión supervisada.</p>
          ) : (
            <>
              <p className="text-xs font-bold text-white">¿La respuesta de Domi fue útil y correcta?</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void submit(1)}
                  className="flex min-h-9 items-center gap-1 rounded-xl bg-[#FFC400] px-3 text-xs font-black text-[#1A1D21]"
                >
                  <ThumbsUp className="h-3.5 w-3.5" /> Sí
                </button>
                <button
                  type="button"
                  onClick={() => setNegativeOpen(true)}
                  className="flex min-h-9 items-center gap-1 rounded-xl border border-[#8A9099] px-3 text-xs font-bold text-white"
                >
                  <ThumbsDown className="h-3.5 w-3.5" /> Corregir
                </button>
              </div>
              {negativeOpen && (
                <div className="mt-3">
                  <textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value.slice(0, 1000))}
                    rows={3}
                    placeholder="Explica qué estuvo mal. Un administrador revisará la corrección."
                    className="w-full resize-none rounded-xl border border-[#3A4048] bg-[#1A1D21] p-2 text-xs text-white outline-none placeholder:text-[#B7BCC3] focus:border-[#FFC400]"
                  />
                  <button
                    type="button"
                    onClick={() => void submit(-1)}
                    className="mt-2 min-h-9 rounded-xl bg-[#FFC400] px-3 text-xs font-black text-[#1A1D21]"
                  >
                    Enviar corrección
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        <button type="button" onClick={() => setTarget(null)} className="rounded-lg p-1 text-white hover:bg-white/10" aria-label="Cerrar evaluación">
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
