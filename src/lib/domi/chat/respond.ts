import 'server-only';

import { NextResponse } from 'next/server';
import { writeDomiAudit } from '@/lib/domi/server-security';
import { executeDomiCustomerTool } from '@/lib/domi/tools/customer-read';
import { planDomiCustomerTool } from '@/lib/domi/tools/planner';
import type { DomiToolResult } from '@/lib/domi/tools/types';
import { getDomiUserSettings } from '@/lib/domi/user-settings';
import { processDomiMemory } from '@/lib/domi/chat/memory';
import type { PreparedDomiChat } from '@/lib/domi/chat/session';
import { runDomiConversationOrchestrator } from '@/lib/domi/agent/conversation-orchestrator';
import { generateGroundedDomiAnswer } from '@/lib/domi/model/grounded-generator';
import {
  buildDomiAssistantPayload,
  buildDomiKnowledgeAnswer,
  domiModelForAssistant,
  domiResponseHeaders,
  insertDomiAssistantMessage,
  touchDomiConversation,
  type DomiAssistantResponse,
} from '@/lib/domi/chat/protocol';

interface AuditToolResult {
  name: string;
  success: boolean;
  recordCount: number;
}

async function persist(args: {
  prepared: PreparedDomiChat;
  assistant: DomiAssistantResponse;
  mode: 'knowledge' | 'memory' | 'tool';
  memoryState?: 'pending' | 'saved' | 'cancelled';
  toolResult?: DomiToolResult | AuditToolResult;
}) {
  const { prepared } = args;
  await insertDomiAssistantMessage({
    supabase: prepared.supabase,
    context: prepared.context,
    conversationId: prepared.conversationId,
    assistant: args.assistant,
    mode: args.mode,
    memoryState: args.memoryState,
  });
  await touchDomiConversation(
    prepared.supabase,
    prepared.conversationId,
    prepared.context.userId,
  );
  await writeDomiAudit({
    supabase: prepared.supabase,
    context: prepared.context,
    result: args.toolResult
      ? args.toolResult.success ? 'success' : 'blocked'
      : 'success',
    intent: args.assistant.intent,
    messageLength: prepared.messageLength,
    conversationId: prepared.conversationId,
    reason: args.toolResult && !args.toolResult.success ? 'tool_denied' : null,
    durationMs: Date.now() - prepared.startedAt,
    toolName: args.toolResult?.name || null,
    toolRecordCount: args.toolResult?.recordCount ?? null,
    toolSuccess: args.toolResult?.success ?? null,
  });
}

function response(args: {
  prepared: PreparedDomiChat;
  assistant: DomiAssistantResponse;
  mode: 'knowledge' | 'memory' | 'tool';
  extra?: Record<string, unknown>;
  headers?: Record<string, string>;
}) {
  return NextResponse.json(
    {
      conversationId: args.prepared.conversationId,
      answer: args.assistant.message,
      assistant: args.assistant,
      mode: args.mode,
      model: domiModelForAssistant(args.assistant, args.mode),
      requestId: args.prepared.context.requestId,
      ...args.extra,
    },
    {
      headers: domiResponseHeaders(
        args.prepared.context.requestId,
        args.headers,
      ),
    },
  );
}

export async function respondToDomiChat(prepared: PreparedDomiChat) {
  try {
    const settings = await getDomiUserSettings(
      prepared.supabase,
      prepared.context.userId,
    );
    const memory = await processDomiMemory({
      supabase: prepared.supabase,
      context: prepared.context,
      conversationId: prepared.conversationId,
      message: prepared.message,
      settings,
    });
    if (memory) {
      await persist({
        prepared,
        assistant: memory.assistant,
        mode: 'memory',
        memoryState: memory.memoryState,
      });
      return response({
        prepared,
        assistant: memory.assistant,
        mode: 'memory',
      });
    }

    const advanced = await runDomiConversationOrchestrator({
      supabase: prepared.supabase,
      context: prepared.context,
      settings,
      conversationId: prepared.conversationId,
      message: prepared.message,
    });
    if (advanced) {
      const assistant = buildDomiAssistantPayload({
        message: advanced.message,
        intent: advanced.intent,
        context: prepared.context,
        tool: advanced.tool,
        toolArguments: { message: prepared.message },
        toolData: {
          ...advanced.data,
          clientCommands: advanced.clientCommands || advanced.data.clientCommands || [],
        },
        clientCommands: advanced.clientCommands,
        suggestedActions: advanced.suggestedActions,
        navigation: advanced.navigation,
        requiresConfirmation: advanced.requiresConfirmation,
        riskLevel: advanced.riskLevel,
        escalateToHuman: advanced.escalateToHuman,
      });
      await persist({
        prepared,
        assistant,
        mode: 'tool',
        toolResult: {
          name: advanced.tool,
          success: true,
          recordCount: advanced.recordCount,
        },
      });
      return response({
        prepared,
        assistant,
        mode: 'tool',
        headers: { 'X-Domi-Tool': advanced.tool },
      });
    }

    const toolPlan = planDomiCustomerTool(prepared.context, prepared.message);
    if (toolPlan) {
      const toolResult = await executeDomiCustomerTool(
        prepared.supabase,
        prepared.context,
        toolPlan,
        { conversationId: prepared.conversationId },
      );
      const assistant = buildDomiAssistantPayload({
        message: toolResult.message,
        intent: toolPlan.intent,
        context: prepared.context,
        tool: toolResult.name,
        toolArguments: toolPlan.arguments,
        toolData: toolResult.data,
        suggestedActions: toolResult.suggestedActions,
        navigation: toolResult.navigation,
        requiresConfirmation: toolResult.requiresConfirmation,
        riskLevel: toolResult.riskLevel,
        escalateToHuman: toolResult.escalateToHuman,
      });
      await persist({
        prepared,
        assistant,
        mode: 'tool',
        toolResult,
      });
      return response({
        prepared,
        assistant,
        mode: 'tool',
        headers: { 'X-Domi-Tool': toolResult.name },
      });
    }

    const { data: knowledge, error } = await prepared.supabase
      .from('domi_knowledge_articles')
      .select('title,content')
      .eq('is_active', true)
      .or(`audience_role.is.null,audience_role.eq.${prepared.context.role}`)
      .limit(30);
    if (error) throw new Error('knowledge_read_failed');

    const approvedKnowledge = (knowledge ?? []).map((item) => ({
      title: String(item.title),
      content: String(item.content),
    }));
    const deterministicAnswer = buildDomiKnowledgeAnswer(
      prepared.context,
      prepared.message,
      approvedKnowledge,
    );
    const generated = await generateGroundedDomiAnswer({
      context: prepared.context,
      message: prepared.message,
      deterministicAnswer,
      knowledge: approvedKnowledge,
    });
    const suggestedActions = settings.proactiveEnabled
      ? prepared.context.role === 'admin'
        ? ['Revisar pedidos', 'Evaluar Domi']
        : prepared.context.role === 'merchant'
          ? ['Revisar pedidos', 'Consultar inventario']
          : prepared.context.role === 'courier'
            ? ['Revisar pedidos asignados', 'Consultar ganancias']
            : ['Recomiéndame algo con $30.000', 'Consultar mis pedidos', 'Ver promociones']
      : [];
    const assistant = buildDomiAssistantPayload({
      message: generated?.answer || deterministicAnswer,
      intent: prepared.intent,
      context: prepared.context,
      suggestedActions,
      generationModel: generated?.model || null,
      generationProvider: generated?.provider || null,
    });
    await persist({ prepared, assistant, mode: 'knowledge' });
    return response({
      prepared,
      assistant,
      mode: 'knowledge',
      headers: generated ? { 'X-Domi-Generation': 'grounded' } : { 'X-Domi-Generation': 'deterministic' },
      extra: {
        generation: generated ? {
          provider: generated.provider,
          model: generated.model,
          latencyMs: generated.latencyMs,
          usage: generated.usage,
        } : {
          provider: 'deterministic',
          model: 'domi-secure-knowledge-v2',
        },
        context: {
          role: prepared.context.role,
          permissions: prepared.context.permissions,
          path: prepared.context.client.path,
          locale: prepared.context.client.locale,
          timezone: prepared.context.client.timezone,
          tenantType: prepared.context.tenantType,
          memoryEnabled: settings.memoryEnabled,
          proactiveEnabled: settings.proactiveEnabled,
          voiceEnabled: settings.voiceEnabled,
          learningEnabled: settings.learningEnabled,
        },
      },
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : 'unknown_error';
    console.error('[Domi] Chat response failed:', reason);
    await writeDomiAudit({
      supabase: prepared.supabase,
      context: prepared.context,
      result: 'error',
      intent: prepared.intent,
      messageLength: prepared.messageLength,
      conversationId: prepared.conversationId,
      reason,
      durationMs: Date.now() - prepared.startedAt,
    });
    return NextResponse.json(
      { error: 'Domi no pudo completar la solicitud. Inténtalo nuevamente.' },
      {
        status: 500,
        headers: domiResponseHeaders(prepared.context.requestId),
      },
    );
  }
}
