import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/server-auth';
import { getServiceClient } from '@/lib/db/supabase';
import {
  normalizeConversationStatus,
  sanitizeConversationTitle,
  statusTimestampPatch,
} from '@/lib/domi/conversations';

export const runtime = 'nodejs';
export const maxDuration = 10;

const patchSchema = z.object({
  title: z.string().trim().max(80).optional(),
  status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
}).strict().refine((value) => value.title !== undefined || value.status !== undefined, {
  message: 'No hay cambios para aplicar',
});

function headers() {
  return {
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
  };
}

function serializeConversation(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    title: String(row.title || 'Conversación con Domi'),
    status: String(row.status || 'active'),
    summary: String(row.summary || ''),
    activeGoal: row.active_goal ? String(row.active_goal) : null,
    currentContext: row.current_context && typeof row.current_context === 'object' ? row.current_context : {},
    lastMessageAt: String(row.last_message_at || row.updated_at || row.created_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    archivedAt: row.archived_at ? String(row.archived_at) : null,
  };
}

function serializeMessage(row: Record<string, unknown>) {
  const metadata = row.metadata && typeof row.metadata === 'object'
    ? row.metadata as Record<string, unknown>
    : {};
  const response = metadata.response && typeof metadata.response === 'object'
    ? metadata.response as Record<string, unknown>
    : {};
  return {
    id: String(row.id),
    role: String(row.role),
    content: String(row.content || ''),
    createdAt: String(row.created_at),
    suggestedActions: Array.isArray(response.suggestedActions)
      ? response.suggestedActions.slice(0, 3).map(String)
      : [],
    navigation: Array.isArray(response.navigation) ? response.navigation.slice(0, 4) : [],
  };
}

async function ownedConversation(id: string, userId: string) {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('domi_conversations')
    .select('id,title,status,summary,active_goal,current_context,last_message_at,created_at,updated_at,archived_at,user_id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { supabase, data };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status, headers: headers() });
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Conversación no válida.' }, { status: 400, headers: headers() });
  }

  try {
    const { supabase, data } = await ownedConversation(id, auth.session.user.id);
    if (!data) {
      return NextResponse.json({ error: 'La conversación no está disponible para esta cuenta.' }, { status: 404, headers: headers() });
    }

    const { data: messages, error } = await supabase
      .from('domi_messages')
      .select('id,role,content,metadata,created_at')
      .eq('conversation_id', id)
      .eq('user_id', auth.session.user.id)
      .order('created_at', { ascending: true })
      .limit(250);
    if (error) throw new Error(error.message);

    return NextResponse.json({
      conversation: serializeConversation(data as Record<string, unknown>),
      messages: (messages || []).map((row) => serializeMessage(row as Record<string, unknown>)),
    }, { headers: headers() });
  } catch (cause) {
    console.error('[Domi] Conversation read failed:', cause instanceof Error ? cause.message : cause);
    return NextResponse.json({ error: 'No se pudo cargar la conversación.' }, { status: 500, headers: headers() });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status, headers: headers() });
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Conversación no válida.' }, { status: 400, headers: headers() });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400, headers: headers() });
  }
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Los cambios enviados no son válidos.' }, { status: 400, headers: headers() });
  }

  try {
    const { supabase, data } = await ownedConversation(id, auth.session.user.id);
    if (!data) {
      return NextResponse.json({ error: 'La conversación no está disponible para esta cuenta.' }, { status: 404, headers: headers() });
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.title !== undefined) update.title = sanitizeConversationTitle(parsed.data.title);
    if (parsed.data.status !== undefined) {
      const normalized = normalizeConversationStatus(parsed.data.status);
      if (!normalized) {
        return NextResponse.json({ error: 'Estado de conversación no válido.' }, { status: 400, headers: headers() });
      }
      Object.assign(update, statusTimestampPatch(normalized));
    }

    const { data: updated, error } = await supabase
      .from('domi_conversations')
      .update(update)
      .eq('id', id)
      .eq('user_id', auth.session.user.id)
      .select('id,title,status,summary,active_goal,current_context,last_message_at,created_at,updated_at,archived_at')
      .single();
    if (error || !updated) throw new Error(error?.message || 'conversation_update_failed');

    return NextResponse.json({ conversation: serializeConversation(updated as Record<string, unknown>) }, { headers: headers() });
  } catch (cause) {
    console.error('[Domi] Conversation update failed:', cause instanceof Error ? cause.message : cause);
    return NextResponse.json({ error: 'No se pudo actualizar la conversación.' }, { status: 500, headers: headers() });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status, headers: headers() });
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Conversación no válida.' }, { status: 400, headers: headers() });
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('domi_conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.session.user.id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[Domi] Conversation delete failed:', error.message);
    return NextResponse.json({ error: 'No se pudo eliminar la conversación.' }, { status: 500, headers: headers() });
  }
  if (!data) {
    return NextResponse.json({ error: 'La conversación no está disponible para esta cuenta.' }, { status: 404, headers: headers() });
  }

  return NextResponse.json({ success: true, id }, { headers: headers() });
}
