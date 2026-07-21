import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DomiServerContext } from '@/lib/domi/server-context';
import type { DomiUserSettings } from '@/lib/domi/user-settings';
import { updateDomiUserSettings } from '@/lib/domi/user-settings';
import type { DomiAdvancedResult, DomiAgentState } from '@/lib/domi/agent/types';
import { classifyDomiAdvancedIntent } from '@/lib/domi/agent/intent-classifier';
import { loadDomiAgentState } from '@/lib/domi/agent/state-loader';
import {
  explainDomiRecommendations,
  recommendDomiProducts,
} from '@/lib/domi/agent/recommendation-engine';
import { getDomiPromotions } from '@/lib/domi/agent/promotion-service';
import {
  getDomiAddresses,
  getDomiPaymentMethods,
} from '@/lib/domi/agent/customer-profile-service';
import { prepareDomiOrderDraft } from '@/lib/domi/agent/order-draft-service';
import {
  correctSpecificDomiMemory,
  forgetSpecificDomiMemory,
} from '@/lib/domi/agent/memory-control-service';
import { captureDomiLearningCandidate } from '@/lib/domi/agent/learning-service';
import { normalizeDomiText } from '@/lib/domi/agent/text-utils';

function activeGoal(result: DomiAdvancedResult, query: string) {
  if (result.intent === 'budget_recommendation' || result.intent === 'product_recommendation') {
    return `Comparar opciones de ${query || 'productos'} y preparar la elegida.`;
  }
  if (result.intent === 'prepare_order_draft') {
    return 'Revisar el carrito, confirmar la dirección y completar el pago manualmente.';
  }
  if (result.intent === 'addresses') return 'Elegir una dirección antes de preparar el pedido.';
  if (result.intent === 'payment_methods') return 'Elegir manualmente el método de pago en checkout.';
  return null;
}

async function updateConversation(args: {
  supabase: SupabaseClient;
  state: DomiAgentState;
  result: DomiAdvancedResult;
  query: string;
}) {
  const goal = activeGoal(args.result, args.query);
  const summary = args.result.message.replace(/\s+/g, ' ').slice(0, 700);
  await args.supabase
    .from('domi_conversations')
    .update({
      summary,
      active_goal: goal,
      current_context: {
        intent: args.result.intent,
        tool: args.result.tool,
        recordCount: args.result.recordCount,
        query: args.query,
        path: args.state.context.client.path,
        updatedBy: 'domi_agent',
      },
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.state.conversationId)
    .eq('user_id', args.state.context.userId);
}

function settingsResult(args: {
  intent: 'voice_settings' | 'proactive_settings';
  settings: DomiUserSettings;
  message: string;
}): DomiAdvancedResult {
  return {
    intent: args.intent,
    tool: 'agent.settings_service',
    message: args.message,
    data: { settings: args.settings },
    recordCount: 1,
    suggestedActions: [],
    navigation: [],
  };
}

async function handleVoiceSettings(args: {
  supabase: SupabaseClient;
  state: DomiAgentState;
  message: string;
}) {
  const normalized = normalizeDomiText(args.message);
  const disable = /\b(desactiva|desactivar|apaga|apagar|sin voz|no hables|no escuchar)\b/.test(normalized);
  const speechOnly = /\b(leer|respuesta hablada|habla|voz alta)\b/.test(normalized);
  const settings = await updateDomiUserSettings(args.supabase, args.state.context.userId, speechOnly
    ? { speechOutputEnabled: !disable }
    : { voiceEnabled: !disable, speechOutputEnabled: !disable });
  return settingsResult({
    intent: 'voice_settings',
    settings,
    message: disable
      ? 'Desactivé la función de voz solicitada. Puedes seguir conversando por texto y reactivarla desde Domi cuando la necesites.'
      : 'Activé la conversación por voz. El navegador pedirá permiso para el micrófono; Domi no almacena grabaciones de audio.',
  });
}

async function handleProactiveSettings(args: {
  supabase: SupabaseClient;
  state: DomiAgentState;
  message: string;
}) {
  const normalized = normalizeDomiText(args.message);
  const disable = /\b(desactiva|desactivar|apaga|apagar|silencia|silenciar|no avisar)\b/.test(normalized);
  const realtime = /\b(tiempo real|inmediatamente|cada cambio)\b/.test(normalized);
  const daily = /\b(diario|una vez al dia|cada dia)\b/.test(normalized);
  const settings = await updateDomiUserSettings(args.supabase, args.state.context.userId, {
    proactiveEnabled: !disable,
    proactiveFrequency: disable ? 'off' : realtime ? 'realtime' : daily ? 'daily' : 'important_only',
  });
  return settingsResult({
    intent: 'proactive_settings',
    settings,
    message: disable
      ? 'Desactivé los avisos proactivos de Domi. No iniciaré alertas hasta que los vuelvas a activar.'
      : `Activé los avisos proactivos con frecuencia ${settings.proactiveFrequency === 'realtime' ? 'en tiempo real' : settings.proactiveFrequency === 'daily' ? 'diaria' : 'solo para asuntos importantes'}.`,
  });
}

function resumeResult(state: DomiAgentState): DomiAdvancedResult {
  const latestAssistant = [...state.messages].reverse().find((message) => message.role === 'assistant');
  const previous = latestAssistant?.content || 'No hay una tarea anterior suficientemente clara en este hilo.';
  return {
    intent: 'resume_goal',
    tool: 'agent.conversation_repository',
    message: `Retomamos desde aquí: ${previous.slice(0, 700)}`,
    data: { previousMessage: previous.slice(0, 1200) },
    recordCount: latestAssistant ? 1 : 0,
    suggestedActions: latestAssistant ? ['Continuar con la tarea pendiente', 'Empezar una búsqueda nueva'] : [],
    navigation: [],
  };
}

export async function runDomiConversationOrchestrator(args: {
  supabase: SupabaseClient;
  context: DomiServerContext;
  settings: DomiUserSettings;
  conversationId: string;
  message: string;
}): Promise<DomiAdvancedResult | null> {
  const plan = classifyDomiAdvancedIntent(args.context, args.message);
  if (!plan) return null;

  const state = await loadDomiAgentState({
    supabase: args.supabase,
    context: args.context,
    settings: args.settings,
    conversationId: args.conversationId,
  });

  await captureDomiLearningCandidate({
    supabase: args.supabase,
    state,
    message: args.message,
  }).catch(() => null);

  let result: DomiAdvancedResult;
  switch (plan.intent) {
    case 'budget_recommendation':
    case 'product_recommendation': {
      const recommendations = await recommendDomiProducts({
        supabase: args.supabase,
        state,
        request: { query: plan.query, budget: plan.budget, limit: 3 },
      });
      result = {
        intent: plan.intent,
        tool: 'agent.recommendation_engine',
        message: explainDomiRecommendations(recommendations, plan.budget),
        data: { recommendations, budget: plan.budget, query: plan.query },
        recordCount: recommendations.length,
        suggestedActions: recommendations.length
          ? ['Agrega la primera opción al carrito', 'Muéstrame otra alternativa']
          : ['Buscar productos disponibles'],
        navigation: recommendations[0]?.businessSlug
          ? [{ label: `Ver ${recommendations[0].businessName}`, href: `/cliente/business/${recommendations[0].businessSlug}` }]
          : [{ label: 'Abrir catálogo', href: '/cliente' }],
      };
      break;
    }
    case 'promotions':
      result = await getDomiPromotions({ supabase: args.supabase, userId: args.context.userId });
      break;
    case 'addresses':
      result = await getDomiAddresses(args.supabase, args.context.userId);
      break;
    case 'payment_methods':
      result = await getDomiPaymentMethods(args.supabase, args.context.userId);
      break;
    case 'prepare_order_draft':
      result = await prepareDomiOrderDraft({
        supabase: args.supabase,
        state,
        quantity: plan.requestedQuantity,
      });
      break;
    case 'resume_goal':
      result = resumeResult(state);
      break;
    case 'memory_forget_specific':
      result = await forgetSpecificDomiMemory({
        supabase: args.supabase,
        state,
        reference: plan.reference,
      });
      break;
    case 'memory_correct':
      result = await correctSpecificDomiMemory({
        supabase: args.supabase,
        state,
        reference: plan.reference,
        rawMessage: plan.rawMessage,
      });
      break;
    case 'voice_settings':
      result = await handleVoiceSettings({ supabase: args.supabase, state, message: args.message });
      break;
    case 'proactive_settings':
      result = await handleProactiveSettings({ supabase: args.supabase, state, message: args.message });
      break;
    case 'admin_evaluation':
      result = {
        intent: 'admin_evaluation',
        tool: 'agent.evaluation_service',
        message: 'El panel de evaluación de Domi muestra calidad, retroalimentación y candidatos de aprendizaje pendientes de revisión humana. Ningún candidato se convierte en conocimiento global automáticamente.',
        data: {},
        recordCount: 0,
        suggestedActions: [],
        navigation: [{ label: 'Abrir evaluación de Domi', href: '/admin/domi' }],
      };
      break;
    default:
      return null;
  }

  await updateConversation({ supabase: args.supabase, state, result, query: plan.query });
  return result;
}
