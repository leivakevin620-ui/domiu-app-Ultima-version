import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DomiMemoryCandidate } from '@/lib/domi/security';
import type { DomiServerContext } from '@/lib/domi/server-context';

const RATE_LIMIT_MAX = 12;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MEMORY_CONFIRMATION_TTL_MS = 30 * 60_000;

export async function enforceDomiRateLimit(supabase: SupabaseClient, userId: string) {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from('audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', 'domi.chat')
    .gte('created_at', since);

  if (error) return { allowed: true, remaining: RATE_LIMIT_MAX };
  const used = Number(count || 0);
  return {
    allowed: used < RATE_LIMIT_MAX,
    remaining: Math.max(0, RATE_LIMIT_MAX - used),
    retryAfterSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
  };
}

export async function findIdempotentDomiResponse(
  supabase: SupabaseClient,
  userId: string,
  requestId: string,
) {
  const { data } = await supabase
    .from('domi_messages')
    .select('conversation_id,content,metadata')
    .eq('user_id', userId)
    .eq('role', 'assistant')
    .contains('metadata', { requestId })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    conversationId: String(data.conversation_id),
    answer: String(data.content),
    metadata: (data.metadata || {}) as Record<string, unknown>,
  };
}

export async function getPendingMemoryCandidate(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
) {
  const { data } = await supabase
    .from('domi_messages')
    .select('id,metadata,created_at')
    .eq('user_id', userId)
    .eq('conversation_id', conversationId)
    .eq('role', 'assistant')
    .contains('metadata', { memoryState: 'pending' })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.created_at || Date.now() - Date.parse(String(data.created_at)) > MEMORY_CONFIRMATION_TTL_MS) return null;
  const metadata = (data.metadata || {}) as Record<string, unknown>;
  const rawCandidate = metadata.memoryCandidate;
  if (!data.id || !rawCandidate || typeof rawCandidate !== 'object') return null;
  const candidate = rawCandidate as Partial<DomiMemoryCandidate>;
  if (candidate.type !== 'preference' || typeof candidate.text !== 'string') return null;
  return {
    messageId: String(data.id),
    candidate: {
      text: candidate.text.slice(0, 180),
      type: 'preference' as const,
      explicitConsent: false,
    },
  };
}

export async function markMemoryCandidate(
  supabase: SupabaseClient,
  messageId: string,
  state: 'saved' | 'cancelled',
) {
  const { data } = await supabase.from('domi_messages').select('metadata').eq('id', messageId).maybeSingle();
  const metadata = (data?.metadata || {}) as Record<string, unknown>;
  await supabase
    .from('domi_messages')
    .update({ metadata: { ...metadata, memoryState: state, memoryResolvedAt: new Date().toISOString() } })
    .eq('id', messageId);
}

export async function writeDomiAudit(args: {
  supabase: SupabaseClient;
  context: DomiServerContext;
  result: 'success' | 'error' | 'blocked';
  intent: string;
  messageLength: number;
  conversationId?: string | null;
  reason?: string | null;
  durationMs?: number;
}) {
  const { context } = args;
  await args.supabase.from('audit_log').insert({
    user_id: context.userId,
    user_email: context.email || null,
    user_role: context.sourceRole,
    action: 'domi.chat',
    entity_type: 'domi_conversation',
    entity_id: args.conversationId || null,
    details: {
      requestId: context.requestId,
      sessionId: context.sessionId,
      tenantType: context.tenantType,
      intent: args.intent,
      path: context.client.path,
      messageLength: args.messageLength,
      reason: args.reason || null,
      durationMs: args.durationMs ?? null,
    },
    ip_address: context.ipAddress,
    user_agent: context.userAgent,
    result: args.result,
    error_message: args.result === 'error' ? args.reason || 'Domi request failed' : null,
    metadata: {
      locale: context.client.locale,
      timezone: context.client.timezone,
      module: context.client.module,
      screen: context.client.screen,
    },
  });
}
