import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/server-auth';
import { getServiceClient } from '@/lib/db/supabase';
import { buildDomiServerContext } from '@/lib/domi/server-context';
import { rejectUnsafeMutation } from '@/lib/http/request-security';
import {
  deriveConversationTitle,
  normalizeConversationStatus,
  sanitizeConversationTitle,
  type DomiConversationStatus,
} from '@/lib/domi/conversations';

export const runtime = 'nodejs';
export const maxDuration = 10;

const createSchema = z.object({
  title: z.string().trim().max(80).optional(),
  context: z.object({
    path: z.string().max(240).optional(),
    module: z.string().max(60).optional(),
    screen: z.string().max(80).optional(),
    locale: z.string().max(24).optional(),
    timezone: z.string().max(64).optional(),
  }).strict().optional(),
}).strict();

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

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status, headers: headers() });
  }

  const supabase = getServiceClient();
  const searchParams = request.nextUrl.searchParams;
  const search = (searchParams.get('q') || '').trim().slice(0, 80);
  const requestedLimit = Number(searchParams.get('limit') || 30);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(50, Math.max(1, Math.trunc(requestedLimit)))
    : 30;
  const rawStatuses = (searchParams.get('status') || '')
    .split(',')
    .map((value) => normalizeConversationStatus(value))
    .filter((value): value is DomiConversationStatus => Boolean(value));

  let query = supabase
    .from('domi_conversations')
    .select('id,title,status,summary,active_goal,current_context,last_message_at,created_at,updated_at,archived_at')
    .eq('user_id', auth.session.user.id)
    .order('last_message_at', { ascending: false })
    .limit(limit);

  if (rawStatuses.length === 1) query = query.eq('status', rawStatuses[0]);
  if (rawStatuses.length > 1) query = query.in('status', rawStatuses);
  if (search) {
    const safeSearch = search
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (safeSearch) query = query.or(`title.ilike.%${safeSearch}%,summary.ilike.%${safeSearch}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Domi] Conversation list failed:', error.message);
    return NextResponse.json({ error: 'No se pudo cargar el historial de Domi.' }, { status: 500, headers: headers() });
  }

  return NextResponse.json({ conversations: (data || []).map((row) => serializeConversation(row as Record<string, unknown>)) }, { headers: headers() });
}

export async function POST(request: NextRequest) {
  const rejected = rejectUnsafeMutation(request);
  if (rejected) return rejected;

  const auth = await requireAuth();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status, headers: headers() });
  }

  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Los datos de la conversación no son válidos.' }, { status: 400, headers: headers() });
  }

  const supabase = getServiceClient();
  const context = await buildDomiServerContext({
    request,
    supabase,
    profile: auth.session.profile,
    user: auth.session.user,
    clientContext: parsed.data.context,
  });

  if (context.accountStatus !== 'active') {
    return NextResponse.json({ error: 'Tu cuenta no está activa.' }, { status: 403, headers: headers() });
  }

  const title = parsed.data.title
    ? sanitizeConversationTitle(parsed.data.title)
    : deriveConversationTitle('Nueva conversación');
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('domi_conversations')
    .insert({
      user_id: context.userId,
      tenant_id: context.tenantId,
      role: context.role,
      title,
      status: 'active',
      summary: '',
      active_goal: null,
      current_context: {
        path: context.client.path,
        module: context.client.module,
        screen: context.client.screen,
        locale: context.client.locale,
        timezone: context.client.timezone,
      },
      last_message_at: now,
      metadata: {
        tenantId: context.tenantId,
        tenantType: context.tenantType,
        path: context.client.path,
        locale: context.client.locale,
        source: 'manual_new_conversation',
      },
    })
    .select('id,title,status,summary,active_goal,current_context,last_message_at,created_at,updated_at,archived_at')
    .single();

  if (error || !data) {
    console.error('[Domi] Conversation create failed:', error?.message);
    return NextResponse.json({ error: 'No se pudo iniciar la nueva conversación.' }, { status: 500, headers: headers() });
  }

  return NextResponse.json({ conversation: serializeConversation(data as Record<string, unknown>), messages: [] }, { status: 201, headers: headers() });
}
