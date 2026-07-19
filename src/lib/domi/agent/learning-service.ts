import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DomiAgentState } from '@/lib/domi/agent/types';
import { normalizeDomiText } from '@/lib/domi/agent/text-utils';

function candidateType(message: string) {
  const normalized = normalizeDomiText(message);
  if (/\b(no es correcto|esta mal|estas equivocado|corrige|en realidad)\b/.test(normalized)) {
    return 'correction' as const;
  }
  if (/\b(siempre|normalmente|prefiero|me gusta|no me gusta)\b/.test(normalized)) {
    return 'preference_pattern' as const;
  }
  if (/\b(no puedes|deberias poder|falta que|no encontraste)\b/.test(normalized)) {
    return 'tool_gap' as const;
  }
  return null;
}

export async function captureDomiLearningCandidate(args: {
  supabase: SupabaseClient;
  state: DomiAgentState;
  message: string;
}) {
  if (!args.state.settings.learningEnabled) return null;
  const type = candidateType(args.message);
  if (!type) return null;

  const normalized = normalizeDomiText(args.message).slice(0, 1000);
  if (!normalized || /\b(password|contrasena|pin|token|tarjeta|cvv|clave bancaria)\b/.test(normalized)) {
    return null;
  }

  const { data: existing } = await args.supabase
    .from('domi_learning_candidates')
    .select('id')
    .eq('user_id', args.state.context.userId)
    .eq('normalized_content', normalized)
    .in('status', ['pending', 'approved'])
    .limit(1)
    .maybeSingle();
  if (existing) return String(existing.id);

  const { data, error } = await args.supabase
    .from('domi_learning_candidates')
    .insert({
      user_id: args.state.context.userId,
      conversation_id: args.state.conversationId,
      candidate_type: type,
      title: type === 'correction'
        ? 'Corrección propuesta por un usuario'
        : type === 'tool_gap'
          ? 'Capacidad solicitada para Domi'
          : 'Patrón de preferencia observado',
      content: args.message.trim().slice(0, 1200),
      normalized_content: normalized,
      evidence: {
        role: args.state.context.role,
        tenantType: args.state.context.tenantType,
        source: 'conversation',
      },
      audience_role: args.state.context.role,
      private_scope: true,
      risk_level: type === 'correction' ? 'medium' : 'low',
      status: 'pending',
    })
    .select('id')
    .single();
  if (error || !data) throw new Error('domi_learning_candidate_write_failed');
  return String(data.id);
}

export async function createDomiFeedbackCandidate(args: {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string;
  messageId?: string | null;
  comment: string;
  role: 'admin' | 'merchant' | 'customer' | 'courier';
}) {
  const normalized = normalizeDomiText(args.comment).slice(0, 1000);
  if (!normalized) return null;
  const { data, error } = await args.supabase
    .from('domi_learning_candidates')
    .insert({
      user_id: args.userId,
      conversation_id: args.conversationId,
      source_message_id: args.messageId || null,
      candidate_type: 'response_quality',
      title: 'Retroalimentación negativa sobre una respuesta',
      content: args.comment.trim().slice(0, 1200),
      normalized_content: normalized,
      evidence: { source: 'explicit_feedback' },
      audience_role: args.role,
      private_scope: true,
      risk_level: 'low',
      status: 'pending',
    })
    .select('id')
    .single();
  if (error || !data) throw new Error('domi_feedback_candidate_write_failed');
  return String(data.id);
}
