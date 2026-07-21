import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DomiAdvancedResult, DomiAgentState } from '@/lib/domi/agent/types';
import { memoryKey } from '@/lib/domi/security';
import { normalizeDomiText } from '@/lib/domi/agent/text-utils';

function memoryText(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const text = (value as Record<string, unknown>).text;
  return typeof text === 'string' ? text : '';
}

function targetWords(reference: string | null) {
  return normalizeDomiText(reference || '')
    .split(/\s+/)
    .filter((word) => word.length >= 3)
    .slice(0, 12);
}

async function matchingMemories(
  supabase: SupabaseClient,
  userId: string,
  reference: string | null,
) {
  const { data, error } = await supabase
    .from('domi_user_memory')
    .select('id,memory_key,memory_value,memory_type')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw new Error('domi_memory_control_read_failed');
  const words = targetWords(reference);
  return (data ?? []).filter((item) => {
    if (!words.length) return false;
    const haystack = normalizeDomiText(`${item.memory_key} ${memoryText(item.memory_value)}`);
    return words.some((word) => haystack.includes(word));
  });
}

export async function forgetSpecificDomiMemory(args: {
  supabase: SupabaseClient;
  state: DomiAgentState;
  reference: string | null;
}): Promise<DomiAdvancedResult> {
  const matches = await matchingMemories(
    args.supabase,
    args.state.context.userId,
    args.reference,
  );
  if (!matches.length) {
    return {
      intent: 'memory_forget_specific',
      tool: 'agent.memory_control_service',
      message: 'No encontré un recuerdo personal que coincida con esa descripción. No eliminé nada.',
      data: { deleted: [] },
      recordCount: 0,
      suggestedActions: ['¿Qué recuerdas de mí?'],
      navigation: [],
    };
  }

  const ids = matches.map((item) => String(item.id));
  const { error } = await args.supabase
    .from('domi_user_memory')
    .delete()
    .eq('user_id', args.state.context.userId)
    .in('id', ids);
  if (error) throw new Error('domi_memory_control_delete_failed');

  const labels = matches.map((item) => memoryText(item.memory_value) || String(item.memory_key));
  return {
    intent: 'memory_forget_specific',
    tool: 'agent.memory_control_service',
    message: `Eliminé ${matches.length === 1 ? 'el recuerdo' : `${matches.length} recuerdos`} que coincidían con tu solicitud: ${labels.join('; ')}.`,
    data: { deleted: ids, labels },
    recordCount: matches.length,
    suggestedActions: ['¿Qué recuerdas de mí?'],
    navigation: [],
    riskLevel: 'medium',
  };
}

function correctionValue(message: string) {
  const patterns = [
    /(?:ahora|correcto|correcta|debe ser|cambialo por|cámbialo por|por)\s+[“"']?(.{3,220}?)[”"']?$/i,
    /recuerda que\s+(.{3,220})$/i,
  ];
  for (const pattern of patterns) {
    const value = message.match(pattern)?.[1]?.trim();
    if (value) return value.slice(0, 220);
  }
  return '';
}

export async function correctSpecificDomiMemory(args: {
  supabase: SupabaseClient;
  state: DomiAgentState;
  reference: string | null;
  rawMessage: string;
}): Promise<DomiAdvancedResult> {
  const correctedText = correctionValue(args.rawMessage);
  if (!correctedText) {
    return {
      intent: 'memory_correct',
      tool: 'agent.memory_control_service',
      message: 'Indícame el dato corregido de forma explícita. Por ejemplo: “Corrige mi preferencia: ahora prefiero pedidos sin salsa”.',
      data: { updated: null },
      recordCount: 0,
      suggestedActions: [],
      navigation: [],
    };
  }

  const matches = await matchingMemories(
    args.supabase,
    args.state.context.userId,
    args.reference,
  );
  if (!matches.length) {
    return {
      intent: 'memory_correct',
      tool: 'agent.memory_control_service',
      message: 'No encontré el recuerdo anterior para corregirlo. Puedes decir “Recuerda que…” para guardar el dato nuevo con tu autorización.',
      data: { updated: null },
      recordCount: 0,
      suggestedActions: [`Recuerda que ${correctedText}`],
      navigation: [],
    };
  }

  const selected = matches[0];
  const { error } = await args.supabase
    .from('domi_user_memory')
    .update({
      memory_key: memoryKey(correctedText),
      memory_value: { text: correctedText },
      source: 'explicit_correction',
      confidence: 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', selected.id)
    .eq('user_id', args.state.context.userId);
  if (error) throw new Error('domi_memory_control_update_failed');

  return {
    intent: 'memory_correct',
    tool: 'agent.memory_control_service',
    message: `Corregí ese recuerdo. Ahora recordaré: ${correctedText}.`,
    data: { updated: String(selected.id), text: correctedText },
    recordCount: 1,
    suggestedActions: ['¿Qué recuerdas de mí?'],
    navigation: [],
    riskLevel: 'medium',
  };
}
