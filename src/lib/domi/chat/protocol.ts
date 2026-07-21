import 'server-only';

import { z } from 'zod';
import { getServiceClient } from '@/lib/db/supabase';
import { memoryKey, type DomiMemoryCandidate, type DomiRiskLevel } from '@/lib/domi/security';
import type { DomiServerContext } from '@/lib/domi/server-context';
import type { DomiNavigationLink } from '@/lib/domi/tools/types';
import type { DomiClientCommand } from '@/lib/domi/agent/types';

const cartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
}).strict();

const clientContextSchema = z.object({
  path: z.string().max(240).optional(),
  module: z.string().max(60).optional(),
  screen: z.string().max(80).optional(),
  locale: z.string().max(24).optional(),
  timezone: z.string().max(64).optional(),
  cart: z.object({
    businessId: z.string().uuid().nullable().optional(),
    items: z.array(cartItemSchema).max(25).optional(),
  }).strict().nullable().optional(),
}).strict();

export const domiChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
  requestId: z.string().uuid().optional(),
  context: clientContextSchema.optional(),
}).strict();

export interface DomiAssistantResponse {
  message: string;
  intent: string;
  role: string;
  requiresTool: boolean;
  tool: string | null;
  toolArguments: Record<string, unknown> | null;
  toolData: Record<string, unknown> | null;
  clientCommands: DomiClientCommand[];
  requiresConfirmation: boolean;
  riskLevel: DomiRiskLevel;
  memoryCandidate: DomiMemoryCandidate | null;
  suggestedActions: string[];
  navigation: DomiNavigationLink[];
  escalateToHuman: boolean;
  generationModel: string | null;
  generationProvider: string | null;
}

const ROLE_INTRO: Record<string, string> = {
  customer: 'Puedo ayudarte a buscar productos, verificar tu carrito y consultar exclusivamente tus pedidos.',
  merchant: 'Puedo ayudarte con jornadas, pedidos, catálogo, inventario y métricas de tu comercio.',
  courier: 'Puedo ayudarte con jornadas, pedidos asignados, rutas, ganancias y liquidaciones.',
  admin: 'Puedo ayudarte con la operación, pedidos, comercios, repartidores, reportes, finanzas y auditoría.',
};

export function domiResponseHeaders(requestId: string, extra?: Record<string, string>) {
  return {
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'X-Domi-Request-Id': requestId,
    ...extra,
  };
}

export function buildDomiAssistantPayload(args: {
  message: string;
  intent: string;
  context: DomiServerContext;
  riskLevel?: DomiRiskLevel;
  requiresConfirmation?: boolean;
  memoryCandidate?: DomiMemoryCandidate | null;
  suggestedActions?: string[];
  navigation?: DomiNavigationLink[];
  tool?: string | null;
  toolArguments?: Record<string, unknown> | null;
  toolData?: Record<string, unknown> | null;
  clientCommands?: DomiClientCommand[];
  escalateToHuman?: boolean;
  generationModel?: string | null;
  generationProvider?: string | null;
}): DomiAssistantResponse {
  return {
    message: args.message,
    intent: args.intent,
    role: args.context.role,
    requiresTool: Boolean(args.tool),
    tool: args.tool || null,
    toolArguments: args.toolArguments || null,
    toolData: args.toolData || null,
    clientCommands: args.clientCommands || [],
    requiresConfirmation: Boolean(args.requiresConfirmation),
    riskLevel: args.riskLevel || 'low',
    memoryCandidate: args.memoryCandidate || null,
    suggestedActions: args.suggestedActions || [],
    navigation: args.navigation || [],
    escalateToHuman: Boolean(args.escalateToHuman),
    generationModel: args.generationModel || null,
    generationProvider: args.generationProvider || null,
  };
}

export function buildDomiKnowledgeAnswer(
  context: DomiServerContext,
  message: string,
  knowledge: Array<{ title: string; content: string }>,
) {
  const normalized = message.toLocaleLowerCase('es');
  const words = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter((word) => word.length >= 5)
    .slice(0, 16);
  const relevant = knowledge.find((article) => {
    const haystack = `${article.title} ${article.content}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es');
    return words.some((word) => haystack.includes(word));
  });
  if (relevant) return `${relevant.title}: ${relevant.content}`;

  if (normalized.includes('ganancia') || normalized.includes('liquid')) {
    return context.role === 'courier'
      ? 'Tu ganancia neta corresponde a tu parte del domicilio. En Liquidaciones puedes revisar por separado cuánto debe pagarte DomiU y cuánto debes entregar cuando recibiste pagos en efectivo.'
      : 'Una liquidación compara quién recibió el dinero con los valores que pertenecen al comercio, al repartidor y a DomiU. Cada movimiento debe conservar relación con su pedido.';
  }

  if (normalized.includes('abrir') || normalized.includes('jornada') || normalized.includes('turno')) {
    return context.role === 'merchant'
      ? 'Abre la jornada desde el panel principal de tu comercio. Mientras esté cerrada, el sistema debe impedir pedidos nuevos.'
      : context.role === 'courier'
        ? 'Inicia tu jornada desde el panel principal. Debes tener la jornada abierta y aparecer disponible para aceptar pedidos.'
        : 'Las jornadas permiten organizar horas, pedidos y movimientos financieros de cada día de trabajo.';
  }

  const firstName = context.name.split(' ')[0] || 'Hola';
  const screen = context.client.path ? ` Estás en ${context.client.path}.` : '';
  return `${firstName}, soy Domi. ${ROLE_INTRO[context.role]}${screen} No inventaré datos que no estén registrados o verificados.`;
}

export async function saveDomiMemory(
  supabase: ReturnType<typeof getServiceClient>,
  context: DomiServerContext,
  candidate: DomiMemoryCandidate,
) {
  const { error } = await supabase.from('domi_user_memory').upsert(
    {
      user_id: context.userId,
      memory_key: memoryKey(candidate.text),
      memory_value: { text: candidate.text },
      memory_type: candidate.type,
      confidence: 1,
      source: 'explicit',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,memory_key' },
  );
  if (error) throw new Error('memory_write_failed');
}

export function domiModelForAssistant(assistant: DomiAssistantResponse, mode: string) {
  if (assistant.generationModel && assistant.generationProvider) {
    return `${assistant.generationProvider}:${assistant.generationModel}`;
  }
  if (assistant.requiresConfirmation || assistant.tool?.startsWith('action.')) return 'domi-secure-actions-v1';
  if (assistant.tool?.startsWith('agent.')) return 'domi-complete-agent-v1';
  if (mode === 'tool') return 'domi-secure-tools-v2';
  return 'domi-secure-knowledge-v2';
}

export async function insertDomiAssistantMessage(args: {
  supabase: ReturnType<typeof getServiceClient>;
  context: DomiServerContext;
  conversationId: string;
  assistant: DomiAssistantResponse;
  memoryState?: 'pending' | 'saved' | 'cancelled';
  mode?: 'knowledge' | 'memory' | 'security' | 'tool';
}) {
  const mode = args.mode || (args.assistant.tool ? 'tool' : 'knowledge');
  const { error } = await args.supabase.from('domi_messages').insert({
    conversation_id: args.conversationId,
    user_id: args.context.userId,
    role: 'assistant',
    content: args.assistant.message,
    model: domiModelForAssistant(args.assistant, mode),
    metadata: {
      mode,
      requestId: args.context.requestId,
      sessionId: args.context.sessionId,
      response: args.assistant,
      memoryCandidate: args.assistant.memoryCandidate,
      memoryState: args.memoryState || null,
      generationProvider: args.assistant.generationProvider,
      generationModel: args.assistant.generationModel,
    },
  });
  if (error) throw new Error('assistant_message_write_failed');
}

export async function touchDomiConversation(
  supabase: ReturnType<typeof getServiceClient>,
  conversationId: string,
  userId: string,
) {
  await supabase
    .from('domi_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('user_id', userId);
}
