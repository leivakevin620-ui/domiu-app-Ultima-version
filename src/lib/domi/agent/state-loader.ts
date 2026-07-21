import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DomiServerContext } from '@/lib/domi/server-context';
import type { DomiAgentState, DomiMemoryView, DomiRecentMessage } from '@/lib/domi/agent/types';
import type { DomiUserSettings } from '@/lib/domi/user-settings';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function loadDomiAgentState(args: {
  supabase: SupabaseClient;
  context: DomiServerContext;
  settings: DomiUserSettings;
  conversationId: string;
}): Promise<DomiAgentState> {
  const [messagesResult, memoriesResult] = await Promise.all([
    args.supabase
      .from('domi_messages')
      .select('id,role,content,metadata,created_at')
      .eq('conversation_id', args.conversationId)
      .eq('user_id', args.context.userId)
      .order('created_at', { ascending: false })
      .limit(16),
    args.settings.memoryEnabled
      ? args.supabase
          .from('domi_user_memory')
          .select('id,memory_key,memory_value,memory_type,confidence,expires_at')
          .eq('user_id', args.context.userId)
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
          .order('updated_at', { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (messagesResult.error) throw new Error('domi_agent_messages_read_failed');
  if (memoriesResult.error) throw new Error('domi_agent_memory_read_failed');

  const messages: DomiRecentMessage[] = (messagesResult.data ?? [])
    .map((item) => ({
      id: String(item.id),
      role: item.role === 'assistant' || item.role === 'system' ? item.role : 'user',
      content: String(item.content || ''),
      metadata: record(item.metadata),
      createdAt: String(item.created_at),
    }))
    .reverse();

  const memories: DomiMemoryView[] = (memoriesResult.data ?? []).map((item) => {
    const value = record(item.memory_value);
    return {
      id: String(item.id),
      key: String(item.memory_key),
      text: typeof value.text === 'string' ? value.text : JSON.stringify(value),
      type: String(item.memory_type),
      confidence: Number(item.confidence || 0),
      expiresAt: item.expires_at ? String(item.expires_at) : null,
    };
  });

  return {
    context: args.context,
    settings: args.settings,
    conversationId: args.conversationId,
    messages,
    memories,
  };
}

export function lastDomiToolData(state: DomiAgentState): Record<string, unknown> | null {
  for (let index = state.messages.length - 1; index >= 0; index -= 1) {
    const message = state.messages[index];
    if (message.role !== 'assistant') continue;
    const response = record(message.metadata.response);
    const toolData = record(response.toolData);
    if (Object.keys(toolData).length) return toolData;
  }
  return null;
}
