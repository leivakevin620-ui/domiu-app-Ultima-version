'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  Loader2,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import { requestDomiJson } from '@/lib/domi/client-ui';

interface Metrics {
  conversations: number;
  messages: number;
  evaluations: number;
  positive: number;
  negative: number;
  satisfaction: number | null;
  pendingCandidates: number;
}

interface Candidate {
  id: string;
  candidate_type: string;
  title: string;
  content: string;
  audience_role: string | null;
  private_scope: boolean;
  risk_level: string;
  status: string;
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface Evaluation {
  id: string;
  rating: -1 | 1;
  category: string;
  comment: string | null;
  conversation_id: string;
  message_id: string | null;
  created_at: string;
}

interface PanelResponse {
  metrics: Metrics;
  candidates: Candidate[];
  evaluations: Evaluation[];
}

const EMPTY_METRICS: Metrics = {
  conversations: 0,
  messages: 0,
  evaluations: 0,
  positive: 0,
  negative: 0,
  satisfaction: null,
  pendingCandidates: 0,
};

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function MetricCard({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <article className="rounded-2xl border border-[#3A4048] bg-[#2C3138] p-4 shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-[#D4D7DC]">{label}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFC400] text-[#1A1D21]">{icon}</span>
      </div>
      <strong className="mt-3 block text-2xl font-black text-white">{value}</strong>
    </article>
  );
}

export default function DomiEvaluationPage() {
  const [data, setData] = useState<PanelResponse>({ metrics: EMPTY_METRICS, candidates: [], evaluations: [] });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [articleTitle, setArticleTitle] = useState('');
  const [articleContent, setArticleContent] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await requestDomiJson<PanelResponse>('/api/admin/domi'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el panel de Domi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const pending = useMemo(() => data.candidates.filter((candidate) => candidate.status === 'pending'), [data.candidates]);
  const approved = useMemo(() => data.candidates.filter((candidate) => candidate.status === 'approved'), [data.candidates]);

  const review = async (candidateId: string, action: 'approve' | 'reject') => {
    setBusyId(candidateId);
    setError('');
    try {
      await requestDomiJson('/api/admin/domi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, candidateId }),
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo completar la revisión.');
    } finally {
      setBusyId(null);
    }
  };

  const deploy = async () => {
    if (!selected) return;
    setBusyId(selected.id);
    setError('');
    try {
      await requestDomiJson('/api/admin/domi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deploy',
          candidateId: selected.id,
          articleTitle,
          articleContent,
          tags: ['supervisado', 'domi'],
        }),
      });
      setSelected(null);
      setArticleTitle('');
      setArticleContent('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo publicar el conocimiento.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mobile-page min-h-full text-white">
      <header className="flex flex-col gap-4 border-b border-[#3A4048] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#FFC400]">
            <ShieldCheck className="h-4 w-4" /> Supervisión humana
          </div>
          <h1 className="mt-2 text-3xl font-black text-white">Evaluación y aprendizaje de Domi</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#D4D7DC]">
            Revisa calidad, comentarios y candidatos. Ningún aprendizaje se publica globalmente sin aprobación y redacción administrativa.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#FFC400] px-4 text-sm font-black text-[#1A1D21] disabled:opacity-60">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Actualizar
        </button>
      </header>

      {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/45 bg-red-950/40 p-3 text-sm font-semibold text-red-200">{error}</p>}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Conversaciones" value={data.metrics.conversations} icon={<MessageSquareText className="h-4 w-4" />} />
        <MetricCard label="Mensajes" value={data.metrics.messages} icon={<Sparkles className="h-4 w-4" />} />
        <MetricCard label="Satisfacción" value={data.metrics.satisfaction === null ? 'Sin datos' : `${data.metrics.satisfaction}%`} icon={<ThumbsUp className="h-4 w-4" />} />
        <MetricCard label="Pendientes" value={data.metrics.pendingCandidates} icon={<BrainCircuit className="h-4 w-4" />} />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">Candidatos pendientes</h2>
            <span className="rounded-full bg-[#FFC400] px-3 py-1 text-xs font-black text-[#1A1D21]">{pending.length}</span>
          </div>
          <div className="mt-3 space-y-3">
            {!loading && pending.length === 0 && <div className="rounded-2xl border border-[#3A4048] bg-[#2C3138] p-6 text-center text-sm text-[#D4D7DC]">No hay candidatos pendientes.</div>}
            {pending.map((candidate) => (
              <article key={candidate.id} className="rounded-2xl border border-[#3A4048] bg-[#2C3138] p-5">
                <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase">
                  <span className="rounded-full bg-[#1A1D21] px-2 py-1 text-[#FFC400]">{candidate.candidate_type}</span>
                  <span className="rounded-full bg-[#1A1D21] px-2 py-1 text-white">{candidate.audience_role || 'global'}</span>
                  <span className="rounded-full bg-[#1A1D21] px-2 py-1 text-[#D4D7DC]">riesgo {candidate.risk_level}</span>
                </div>
                <h3 className="mt-3 font-black">{candidate.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#F2F3F5]">{candidate.content}</p>
                <p className="mt-3 text-[10px] text-[#B7BCC3]">Creado {dateLabel(candidate.created_at)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" disabled={busyId === candidate.id} onClick={() => void review(candidate.id, 'approve')} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#FFC400] px-3 text-xs font-black text-[#1A1D21] disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Aprobar</button>
                  <button type="button" disabled={busyId === candidate.id} onClick={() => void review(candidate.id, 'reject')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-400/50 px-3 text-xs font-bold text-red-200 disabled:opacity-50"><XCircle className="h-4 w-4" /> Rechazar</button>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">Aprobados para redacción</h2>
            <span className="rounded-full border border-[#FFC400]/50 px-3 py-1 text-xs font-black text-[#FFC400]">{approved.length}</span>
          </div>
          <div className="mt-3 space-y-3">
            {approved.map((candidate) => (
              <article key={candidate.id} className="rounded-2xl border border-[#FFC400]/25 bg-[#2C3138] p-5">
                <h3 className="font-black">{candidate.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[#D4D7DC]">{candidate.content}</p>
                {candidate.candidate_type === 'preference_pattern'
                  ? <p className="mt-3 text-xs font-bold text-[#FFC400]">Las preferencias privadas no pueden publicarse globalmente.</p>
                  : <button type="button" onClick={() => { setSelected(candidate); setArticleTitle(candidate.title); setArticleContent(''); }} className="mt-4 min-h-10 rounded-xl bg-[#FFC400] px-3 text-xs font-black text-[#1A1D21]">Redactar y publicar</button>}
              </article>
            ))}
          </div>
        </div>

        <aside>
          <h2 className="text-xl font-black">Evaluaciones recientes</h2>
          <div className="mt-3 space-y-3">
            {data.evaluations.map((evaluation) => (
              <article key={evaluation.id} className="rounded-2xl border border-[#3A4048] bg-[#2C3138] p-4">
                <div className="flex items-center gap-2">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${evaluation.rating === 1 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                    {evaluation.rating === 1 ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
                  </span>
                  <div><p className="text-xs font-black">{evaluation.category}</p><p className="text-[10px] text-[#B7BCC3]">{dateLabel(evaluation.created_at)}</p></div>
                </div>
                {evaluation.comment && <p className="mt-3 text-sm leading-relaxed text-[#F2F3F5]">{evaluation.comment}</p>}
              </article>
            ))}
            {!loading && data.evaluations.length === 0 && <div className="rounded-2xl border border-[#3A4048] bg-[#2C3138] p-5 text-sm text-[#D4D7DC]">Todavía no hay evaluaciones.</div>}
          </div>
        </aside>
      </section>

      {selected && (
        <div className="fixed inset-0 z-[1800] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <section className="w-full max-w-2xl rounded-t-3xl border border-[#3A4048] bg-[#2C3138] p-5 shadow-2xl sm:rounded-3xl">
            <h2 className="text-xl font-black">Redacción administrativa final</h2>
            <p className="mt-2 text-sm text-[#D4D7DC]">Escribe una regla general verificada. No copies datos privados del usuario.</p>
            <label className="mt-4 block text-xs font-black text-[#FFC400]">Título</label>
            <input value={articleTitle} onChange={(event) => setArticleTitle(event.target.value.slice(0, 180))} className="mt-2 min-h-11 w-full rounded-xl border border-[#3A4048] bg-[#1A1D21] px-3 text-sm text-white outline-none focus:border-[#FFC400]" />
            <label className="mt-4 block text-xs font-black text-[#FFC400]">Contenido verificado</label>
            <textarea value={articleContent} onChange={(event) => setArticleContent(event.target.value.slice(0, 6000))} rows={8} className="mt-2 w-full resize-y rounded-xl border border-[#3A4048] bg-[#1A1D21] p-3 text-sm text-white outline-none focus:border-[#FFC400]" placeholder="Describe el procedimiento o corrección confirmada." />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setSelected(null)} className="min-h-11 rounded-xl border border-[#8A9099] px-4 text-sm font-bold">Cancelar</button>
              <button type="button" onClick={() => void deploy()} disabled={articleTitle.trim().length < 5 || articleContent.trim().length < 20 || busyId === selected.id} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FFC400] px-4 text-sm font-black text-[#1A1D21] disabled:opacity-50">{busyId === selected.id && <Loader2 className="h-4 w-4 animate-spin" />} Publicar</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
