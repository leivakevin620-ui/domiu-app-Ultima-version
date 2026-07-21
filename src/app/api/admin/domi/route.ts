import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/server-auth';
import { getServiceClient } from '@/lib/db/supabase';
import { normalizeDomiRole } from '@/lib/domi/security';
import { rejectUnsafeMutation } from '@/lib/http/request-security';

export const runtime = 'nodejs';

const reviewSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.enum(['approve', 'reject']),
    candidateId: z.string().uuid(),
    notes: z.string().trim().max(1000).nullable().optional(),
  }).strict(),
  z.object({
    action: z.literal('deploy'),
    candidateId: z.string().uuid(),
    articleTitle: z.string().trim().min(5).max(180),
    articleContent: z.string().trim().min(20).max(6000),
    tags: z.array(z.string().trim().min(2).max(40)).max(12).default([]),
  }).strict(),
]);

const headers = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

async function requireAdmin() {
  const auth = await requireAuth();
  if (auth.error) return { error: auth.error, session: null };
  if (normalizeDomiRole(auth.session.profile.role) !== 'admin') {
    return { error: { message: 'Acceso exclusivo para administradores.', status: 403 }, session: null };
  }
  return { error: null, session: auth.session };
}

export async function GET() {
  const admin = await requireAdmin();
  if (admin.error || !admin.session) {
    return NextResponse.json({ error: admin.error?.message }, { status: admin.error?.status || 403, headers });
  }

  const supabase = getServiceClient();
  const [conversations, messages, evaluations, positive, negative, pending, candidates, recentEvaluations] = await Promise.all([
    supabase.from('domi_conversations').select('*', { count: 'exact', head: true }),
    supabase.from('domi_messages').select('*', { count: 'exact', head: true }),
    supabase.from('domi_evaluations').select('*', { count: 'exact', head: true }),
    supabase.from('domi_evaluations').select('*', { count: 'exact', head: true }).eq('rating', 1),
    supabase.from('domi_evaluations').select('*', { count: 'exact', head: true }).eq('rating', -1),
    supabase.from('domi_learning_candidates').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase
      .from('domi_learning_candidates')
      .select('id,candidate_type,title,content,audience_role,private_scope,risk_level,status,review_notes,created_at,reviewed_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('domi_evaluations')
      .select('id,rating,category,comment,conversation_id,message_id,created_at')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  const totalEvaluations = evaluations.count || 0;
  const satisfaction = totalEvaluations
    ? Math.round(((positive.count || 0) / totalEvaluations) * 1000) / 10
    : null;
  return NextResponse.json({
    metrics: {
      conversations: conversations.count || 0,
      messages: messages.count || 0,
      evaluations: totalEvaluations,
      positive: positive.count || 0,
      negative: negative.count || 0,
      satisfaction,
      pendingCandidates: pending.count || 0,
    },
    candidates: candidates.data || [],
    evaluations: recentEvaluations.data || [],
  }, { headers });
}

function unsafeKnowledge(content: string) {
  const normalized = content.toLocaleLowerCase('es');
  return /\b(password|contrasena|contraseña|pin|token|cvv|numero de tarjeta|número de tarjeta|clave bancaria|service role|sb_secret|api key)\b/.test(normalized);
}

export async function POST(request: NextRequest) {
  const rejected = rejectUnsafeMutation(request);
  if (rejected) return rejected;

  const admin = await requireAdmin();
  if (admin.error || !admin.session) {
    return NextResponse.json({ error: admin.error?.message }, { status: admin.error?.status || 403, headers });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400, headers });
  }
  const parsed = reviewSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'La revisión enviada no es válida.' }, { status: 400, headers });
  }

  const supabase = getServiceClient();
  const { data: candidate } = await supabase
    .from('domi_learning_candidates')
    .select('id,status,candidate_type,audience_role')
    .eq('id', parsed.data.candidateId)
    .maybeSingle();
  if (!candidate) {
    return NextResponse.json({ error: 'El candidato no existe.' }, { status: 404, headers });
  }

  const now = new Date().toISOString();
  if (parsed.data.action === 'approve' || parsed.data.action === 'reject') {
    const reviewRequest = parsed.data;
    const status = reviewRequest.action === 'approve' ? 'approved' : 'rejected';
    const { data, error } = await supabase
      .from('domi_learning_candidates')
      .update({
        status,
        reviewer_id: admin.session.user.id,
        reviewed_at: now,
        review_notes: reviewRequest.notes || null,
        updated_at: now,
      })
      .eq('id', reviewRequest.candidateId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: 'No se pudo guardar la revisión.' }, { status: 500, headers });
    }
    if (!data) {
      return NextResponse.json({ error: 'El candidato ya fue revisado.' }, { status: 409, headers });
    }
    return NextResponse.json({ ok: true, status }, { headers });
  }

  if (!('articleTitle' in parsed.data)) {
    return NextResponse.json({ error: 'La operación de publicación no es válida.' }, { status: 400, headers });
  }
  const deployRequest = parsed.data;
  if (candidate.status !== 'approved') {
    return NextResponse.json({ error: 'El candidato debe aprobarse antes de publicarlo.' }, { status: 409, headers });
  }
  if (candidate.candidate_type === 'preference_pattern') {
    return NextResponse.json({ error: 'Las preferencias privadas nunca se publican como conocimiento global.' }, { status: 403, headers });
  }
  if (unsafeKnowledge(`${deployRequest.articleTitle} ${deployRequest.articleContent}`)) {
    return NextResponse.json({ error: 'El artículo contiene información sensible no permitida.' }, { status: 400, headers });
  }

  const { data: article, error: articleError } = await supabase
    .from('domi_knowledge_articles')
    .insert({
      audience_role: candidate.audience_role || null,
      title: deployRequest.articleTitle,
      content: deployRequest.articleContent,
      tags: deployRequest.tags,
      is_active: true,
      version: 'supervised-1.0',
      created_by: admin.session.user.id,
    })
    .select('id')
    .single();
  if (articleError || !article) {
    return NextResponse.json({ error: 'No se pudo publicar el conocimiento aprobado.' }, { status: 500, headers });
  }

  const { data: deployed, error: deployError } = await supabase
    .from('domi_learning_candidates')
    .update({
      status: 'deployed',
      deployed_article_id: article.id,
      reviewer_id: admin.session.user.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq('id', deployRequest.candidateId)
    .eq('status', 'approved')
    .select('id')
    .maybeSingle();
  if (deployError || !deployed) {
    await supabase.from('domi_knowledge_articles').delete().eq('id', article.id);
    return NextResponse.json({ error: 'No se pudo finalizar el despliegue supervisado.' }, { status: 409, headers });
  }

  return NextResponse.json({ ok: true, status: 'deployed', articleId: String(article.id) }, { headers });
}
