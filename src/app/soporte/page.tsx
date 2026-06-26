'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { LifeBuoy, Bike, MessageCircle, ChevronRight, Send, ArrowLeft } from 'lucide-react';

export default function SoportePage() {
  const { profile } = useAuth();
  const router = useRouter();
  const isCourier = profile?.role === 'courier';

  const [form, setForm] = useState({ type: '', description: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.type || !form.description.trim()) {
      setError('Completa todos los campos');
      return;
    }
    setSending(true);
    setError('');
    try {
      if (isCourier) {
        const { reportCourierIncidentAction } = await import('@/app/actions/courier-profile');
        const result = await reportCourierIncidentAction({
          incident_type: form.type as 'accident' | 'traffic_violation' | 'customer_complaint' | 'order_issue' | 'vehicle_issue' | 'other',
          description: form.description,
          severity: 'minor',
        });
        if (result.error) { setError(result.error); setSending(false); return; }
      } else {
        await new Promise(r => setTimeout(r, 500));
      }
      setSent(true);
    } catch {
      setError('Error al enviar. Intenta de nuevo.');
    }
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-5 animate-fade-in">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/20 to-rose-600/10">
            <LifeBuoy className="h-6 w-6 text-rose-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Centro de Soporte</h1>
            <p className="text-sm text-muted-foreground">Estamos aquí para ayudarte</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: 'WhatsApp', desc: 'Respuesta en minutos', href: 'https://wa.me/573001234567', color: 'from-emerald-500/20 to-emerald-600/10 text-emerald-400' },
            { label: 'FAQ', desc: 'Preguntas frecuentes', href: '/terminos', color: 'from-blue-500/20 to-blue-600/10 text-blue-400' },
            ...(isCourier ? [
              { label: 'Reportar incidente', desc: 'Reporta un problema', href: '/repartidor/perfil', color: 'from-amber-500/20 to-amber-600/10 text-amber-400' },
              { label: 'Configuración', desc: 'Ajusta tu cuenta', href: '/repartidor/configuracion', color: 'from-sky-500/20 to-sky-600/10 text-sky-400' },
            ] : []),
          ].map((item) => (
            <a key={item.label} href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="group flex items-center justify-between rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </a>
          ))}
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Enviar mensaje</h2>
          </div>
          {sent ? (
            <div className="text-center py-6">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <Send className="h-5 w-5 text-success" />
              </div>
              <p className="font-semibold text-foreground">Mensaje enviado</p>
              <p className="mt-1 text-sm text-muted-foreground">Te responderemos pronto.</p>
              <button onClick={() => { setSent(false); setForm({ type: '', description: '' }); }}
                className="mt-4 text-sm font-medium text-info hover:underline"
              >Enviar otro mensaje</button>
            </div>
          ) : (
            <div className="space-y-3">
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground"
              >
                <option value="">Selecciona un tipo</option>
                <option value="order_issue">Problema con pedido</option>
                <option value="vehicle_issue">Problema con vehículo</option>
                <option value="customer_complaint">Problema con cliente</option>
                <option value="other">Otro</option>
              </select>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Describe tu problema..."
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground min-h-[100px] resize-y"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button onClick={handleSubmit} disabled={sending}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {sending ? 'Enviando...' : 'Enviar mensaje'}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Bike className="h-3 w-3" />
          DomiU Soporte · responde en 24h
        </div>
      </div>
    </div>
  );
}
