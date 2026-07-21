import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/server-auth';
import { getServiceClient } from '@/lib/db/supabase';
import { getDomiUserSettings } from '@/lib/domi/user-settings';
import { rejectUnsafeMutation } from '@/lib/http/request-security';

export const runtime = 'nodejs';

const voiceSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('start'),
    conversationId: z.string().uuid().nullable().optional(),
    language: z.string().trim().min(2).max(24).default('es-CO'),
  }).strict(),
  z.object({
    action: z.enum(['complete', 'interrupt', 'fail']),
    sessionId: z.string().uuid(),
    conversationId: z.string().uuid().nullable().optional(),
    lastTranscript: z.string().trim().max(500).nullable().optional(),
    transcriptCount: z.number().int().min(0).max(1000).optional(),
  }).strict(),
]);

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
  const parsed = voiceSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'La sesión de voz enviada no es válida.' }, { status: 400, headers });
  }

  const supabase = getServiceClient();
  const settings = await getDomiUserSettings(supabase, auth.session.user.id);
  if (!settings.voiceEnabled) {
    return NextResponse.json({ error: 'La función de voz está desactivada para tu cuenta.' }, { status: 403, headers });
  }

  if (parsed.data.action === 'start') {
    if (parsed.data.conversationId) {
      const { data: conversation } = await supabase
        .from('domi_conversations')
        .select('id')
        .eq('id', parsed.data.conversationId)
        .eq('user_id', auth.session.user.id)
        .maybeSingle();
      if (!conversation) {
        return NextResponse.json({ error: 'La conversación no pertenece a esta cuenta.' }, { status: 404, headers });
      }
    }

    const { data, error } = await supabase
      .from('domi_voice_sessions')
      .insert({
        user_id: auth.session.user.id,
        conversation_id: parsed.data.conversationId || null,
        status: 'active',
        language: parsed.data.language,
        metadata: {
          audioStored: false,
          browserSpeechRecognition: true,
        },
      })
      .select('id,started_at')
      .single();
    if (error || !data) {
      return NextResponse.json({ error: 'No se pudo iniciar la sesión de voz.' }, { status: 500, headers });
    }
    return NextResponse.json({
      sessionId: String(data.id),
      startedAt: String(data.started_at),
      audioStored: false,
    }, { headers });
  }

  const status = parsed.data.action === 'complete'
    ? 'completed'
    : parsed.data.action === 'interrupt'
      ? 'interrupted'
      : 'failed';
  const update: Record<string, unknown> = {
    status,
    last_transcript: parsed.data.lastTranscript || null,
    transcript_count: parsed.data.transcriptCount || 0,
    ended_at: new Date().toISOString(),
  };
  if (parsed.data.conversationId !== undefined) {
    update.conversation_id = parsed.data.conversationId;
  }

  const { data, error } = await supabase
    .from('domi_voice_sessions')
    .update(update)
    .eq('id', parsed.data.sessionId)
    .eq('user_id', auth.session.user.id)
    .eq('status', 'active')
    .select('id')
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: 'No se pudo cerrar la sesión de voz.' }, { status: 500, headers });
  }
  if (!data) {
    return NextResponse.json({ error: 'La sesión de voz ya no está activa.' }, { status: 409, headers });
  }
  return NextResponse.json({ ok: true, status }, { headers });
}
