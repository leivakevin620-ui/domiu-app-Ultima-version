'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Volume2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { requestDomiJson, sanitizeDomiCart } from '@/lib/domi/client-ui';

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionErrorLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface DomiVoiceSettings {
  voiceEnabled: boolean;
  speechOutputEnabled: boolean;
  preferredLanguage: string;
}

interface VoiceSessionResponse {
  sessionId?: string;
}

interface ChatResponse {
  conversationId?: string;
  answer?: string;
  assistant?: { message?: string };
}

function recognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const browser = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return browser.SpeechRecognition || browser.webkitSpeechRecognition || null;
}

function speechContext(cart: ReturnType<typeof useCart>) {
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);
  return {
    path,
    module: parts[0] || 'inicio',
    screen: parts.slice(1).join('/') || 'principal',
    locale: navigator.language || 'es-CO',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota',
    cart: sanitizeDomiCart({
      businessId: cart.businessId,
      items: cart.items.map((item) => ({
        product: { id: item.product.id },
        quantity: item.quantity,
      })),
    }),
  };
}

export function DomiVoiceDock() {
  const { profile } = useAuth();
  const cart = useCart();
  const [settings, setSettings] = useState<DomiVoiceSettings | null>(null);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    void requestDomiJson<{ settings?: DomiVoiceSettings }>('/api/domi/settings')
      .then((data) => setSettings(data.settings || null))
      .catch(() => setSettings(null));
  }, [profile]);

  const stopSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const closeVoiceSession = useCallback(async (
    action: 'complete' | 'interrupt' | 'fail',
    lastTranscript: string,
  ) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    sessionIdRef.current = null;
    await fetch('/api/domi/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        action,
        sessionId,
        conversationId: conversationIdRef.current,
        lastTranscript: lastTranscript.slice(0, 500) || null,
        transcriptCount: lastTranscript ? 1 : 0,
      }),
    }).catch(() => undefined);
  }, []);

  const speak = useCallback((text: string) => {
    if (!settings?.speechOutputEnabled || !('speechSynthesis' in window)) return;
    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 2500));
    utterance.lang = settings.preferredLanguage || 'es-CO';
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }, [settings, stopSpeech]);

  const sendTranscript = useCallback(async (text: string) => {
    const clean = text.trim().slice(0, 2000);
    if (!clean || processing) return;
    setProcessing(true);
    setError('');
    try {
      const data = await requestDomiJson<ChatResponse>('/api/domi/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: clean,
          conversationId: conversationIdRef.current || undefined,
          requestId: crypto.randomUUID?.(),
          context: speechContext(cart),
        }),
      });
      if (data.conversationId) conversationIdRef.current = data.conversationId;
      const responseText = data.assistant?.message || data.answer || 'Domi completó la consulta.';
      setAnswer(responseText);
      speak(responseText);
      await closeVoiceSession('complete', clean);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo procesar la voz.');
      await closeVoiceSession('fail', clean);
    } finally {
      setProcessing(false);
      setListening(false);
    }
  }, [cart, closeVoiceSession, processing, speak]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
    void closeVoiceSession('interrupt', transcript);
  }, [closeVoiceSession, transcript]);

  const startListening = useCallback(async () => {
    const Constructor = recognitionConstructor();
    if (!Constructor) {
      setOpen(true);
      setError('Este navegador no ofrece reconocimiento de voz. Domi sigue disponible por texto.');
      return;
    }
    if (!settings?.voiceEnabled) {
      setOpen(true);
      setError('La voz está desactivada en tus preferencias de Domi.');
      return;
    }

    stopSpeech();
    setOpen(true);
    setTranscript('');
    setAnswer('');
    setError('');
    const session = await requestDomiJson<VoiceSessionResponse>('/api/domi/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start',
        conversationId: conversationIdRef.current,
        language: settings.preferredLanguage || 'es-CO',
      }),
    }).catch((cause) => {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar la voz.');
      return null;
    });
    if (!session?.sessionId) return;
    sessionIdRef.current = session.sessionId;

    const recognition = new Constructor();
    recognition.lang = settings.preferredLanguage || 'es-CO';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript || '';
      setTranscript(text);
      void sendTranscript(text);
    };
    recognition.onerror = (event) => {
      setListening(false);
      setError(event.error === 'not-allowed'
        ? 'El navegador no autorizó el micrófono.'
        : 'No pude entender el audio. Intenta hablar nuevamente.');
      void closeVoiceSession('fail', '');
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [closeVoiceSession, sendTranscript, settings, stopSpeech]);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    stopSpeech();
  }, [stopSpeech]);

  if (!profile || settings?.voiceEnabled === false) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => listening ? stopListening() : void startListening()}
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-[8.25rem] z-[1390] flex h-12 w-12 items-center justify-center rounded-full border border-[#FFC400]/55 bg-[#1A1D21] text-[#FFC400] shadow-xl transition hover:-translate-y-0.5 lg:bottom-6 lg:right-[9rem]"
        aria-label={listening ? 'Detener voz de Domi' : 'Hablar con Domi'}
      >
        {processing
          ? <Loader2 className="h-5 w-5 animate-spin" />
          : listening
            ? <MicOff className="h-5 w-5" />
            : <Mic className="h-5 w-5" />}
      </button>

      {open && (transcript || answer || error || listening || processing) && (
        <aside className="fixed bottom-[calc(9.25rem+env(safe-area-inset-bottom))] right-4 z-[1490] w-[min(23rem,calc(100vw-2rem))] rounded-2xl border border-[#3A4048] bg-[#1A1D21] p-4 text-white shadow-2xl lg:bottom-24">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-[#1A1D21]">
              {listening ? <Mic className="h-5 w-5 animate-pulse" /> : <Volume2 className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <strong className="text-sm text-[#FFC400]">
                {listening ? 'Domi está escuchando' : processing ? 'Domi está analizando' : 'Conversación por voz'}
              </strong>
              {transcript && <p className="mt-2 text-xs leading-relaxed text-white"><span className="font-bold">Tú:</span> {transcript}</p>}
              {answer && <p className="mt-2 text-xs leading-relaxed text-white"><span className="font-bold text-[#FFC400]">Domi:</span> {answer}</p>}
              {error && <p className="mt-2 text-xs font-semibold text-red-300">{error}</p>}
              <p className="mt-2 text-[10px] leading-relaxed text-[#D4D7DC]">El navegador procesa el micrófono. Domi no guarda grabaciones de audio.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                stopListening();
                stopSpeech();
                setOpen(false);
              }}
              className="rounded-lg p-1 text-white hover:bg-white/10"
              aria-label="Cerrar voz"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
