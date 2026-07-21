import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/server-auth';
import { getServiceClient } from '@/lib/db/supabase';
import { normalizeDomiRole } from '@/lib/domi/security';
import { createDomiFeedbackCandidate } from '@/lib/domi/agent/learning-service';
import { rejectUnsafeMutation } from '@/lib/http/request-security';

export const runtime = 'nodejs';

const feedbackSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid().nullable().optional(),
  rating: z.union([z.literal(-1), z.literal(1)]),
  category: z.enum(['general', 'accuracy', 'helpfulness', 'tone', 'tool_result', 'safety']).default('general'),
  comment: z.string().trim().max(1000).nullable().optional(),
}).strict();

const headers = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

export async function POST(request: NextRequest) {
  const rejected = rejectUnsafeMutation(request);
  if (rejected) return rejected;

  const auth = await requireAuth();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status, headers });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400, headers });
  }
  const parsed = feedbackSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'La evaluación enviada no es válida.' }, { status: 400, headers });
  }

  const supabase = getServiceClient();
  const { data: conversation } = await supabase
    .from('domi_conversations')
    .select('id')
    .eq('id', parsed.data.conversationId)
    .eq('user_id', auth.session.user.id)
    .maybeSingle();
  if (!conversation) {
    return NextResponse.json({ error: 'La conversación no pertenece a esta cuenta.' }, { status: 404, headers });
  }

  if (parsed.data.messageId) {
    const { data: message } = await supabase
      .from('domi_messages')
      .select('id')
      .eq('id', parsed.data.messageId)
      .eq('conversation_id', parsed.data.conversationId)
      .eq('user_id', auth.session.user.id)
      .maybeSingle();
    if (!message) {
      return NextResponse.json({ error: 'La respuesta evaluada no está disponible.' }, { status: 404, headers });
    }
  }

  const { data: evaluation, error } = await supabase
    .from('domi_evaluations')
    .insert({
      user_id: auth.session.user.id,
      conversation_id: parsed.data.conversationId,
      message_id: parsed.data.messageId || null,
      rating: parsed.data.rating,
      category: parsed.data.category,
      comment: parsed.data.comment || null,
      metadata: { source: 'domi_interface' },
    })
    .select('id')
    .single();
  if (error || !evaluation) {
    return NextResponse.json({ error: 'No se pudo guardar la evaluación.' }, { status: 500, headers });
  }

  let learningCandidateId: string | null = null;
  if (parsed.data.rating === -1 && parsed.data.comment) {
    learningCandidateId = await createDomiFeedbackCandidate({
      supabase,
      userId: auth.session.user.id,
      conversationId: parsed.data.conversationId,
      messageId: parsed.data.messageId,
      comment: parsed.data.comment,
      role: normalizeDomiRole(auth.session.profile.role),
    }).catch(() => null);
  }

  return NextResponse.json({
    evaluationId: String(evaluation.id),
    learningCandidateId,
    supervised: true,
  }, { headers });
}
