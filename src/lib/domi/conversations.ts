export type DomiConversationStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface DomiSummaryMessage {
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
}

const STATUS_VALUES = new Set<DomiConversationStatus>([
  'active',
  'paused',
  'completed',
  'archived',
]);

function compact(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function sanitizeConversationTitle(value: string, fallback = 'Conversación con Domi') {
  const cleaned = compact(value)
    .replace(/[<>\u0000-\u001F\u007F]/g, '')
    .slice(0, 80)
    .trim();
  return cleaned || fallback;
}

export function deriveConversationTitle(message: string) {
  const cleaned = compact(message)
    .replace(/^(hola|buenas|buenos días|buenas tardes|buenas noches)[,!.\s-]*/i, '')
    .replace(/[<>\u0000-\u001F\u007F]/g, '')
    .slice(0, 72)
    .trim();
  return sanitizeConversationTitle(cleaned || message);
}

export function normalizeConversationStatus(value: unknown): DomiConversationStatus | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase() as DomiConversationStatus;
  return STATUS_VALUES.has(normalized) ? normalized : null;
}

export function buildConversationSummary(messages: DomiSummaryMessage[], maxLength = 520) {
  const visible = messages
    .filter((item) => item.role === 'user' || item.role === 'assistant')
    .map((item) => ({
      role: item.role,
      content: compact(item.content)
        .replace(/^\[Mensaje bloqueado por seguridad:.*?\]$/i, 'Solicitud bloqueada por seguridad')
        .slice(0, 220),
    }))
    .filter((item) => item.content.length > 0)
    .slice(-10);

  if (visible.length === 0) return '';

  const firstUser = visible.find((item) => item.role === 'user')?.content;
  const lastUser = [...visible].reverse().find((item) => item.role === 'user')?.content;
  const lastAssistant = [...visible].reverse().find((item) => item.role === 'assistant')?.content;
  const parts: string[] = [];

  if (firstUser) parts.push(`Tema: ${firstUser}`);
  if (lastUser && lastUser !== firstUser) parts.push(`Última solicitud: ${lastUser}`);
  if (lastAssistant) parts.push(`Última respuesta: ${lastAssistant}`);

  return compact(parts.join(' · ')).slice(0, Math.max(120, maxLength));
}

export function deriveActiveGoal(intent: string, message: string) {
  const normalizedIntent = compact(intent).slice(0, 80);
  const normalizedMessage = compact(message).slice(0, 180);

  if (/^(general_question|memory_saved|memory_cancelled|security_refusal)$/.test(normalizedIntent)) {
    return normalizedMessage || null;
  }

  const labels: Record<string, string> = {
    customer_search_catalog: 'Encontrar una opción de compra adecuada',
    customer_cart_summary: 'Revisar y preparar el carrito',
    customer_list_orders: 'Consultar el historial de pedidos',
    customer_track_order: 'Dar seguimiento a un pedido',
    memory_confirmation: 'Confirmar una preferencia personal',
  };

  return labels[normalizedIntent] || normalizedMessage || null;
}

export function statusTimestampPatch(status: DomiConversationStatus) {
  return {
    status,
    archived_at: status === 'archived' ? new Date().toISOString() : null,
    ...(status === 'completed' ? { active_goal: null } : {}),
  };
}
