import { describe, expect, it } from 'vitest';
import {
  buildConversationSummary,
  deriveActiveGoal,
  deriveConversationTitle,
  normalizeConversationStatus,
  sanitizeConversationTitle,
  statusTimestampPatch,
} from '@/lib/domi/conversations';

describe('Domi persistent conversations', () => {
  it('sanitizes and limits conversation titles', () => {
    expect(sanitizeConversationTitle('  Mi   pedido <script>  ')).toBe('Mi pedido script');
    expect(sanitizeConversationTitle('   ')).toBe('Conversación con Domi');
    expect(sanitizeConversationTitle('a'.repeat(120))).toHaveLength(80);
  });

  it('derives a useful title from the first message', () => {
    expect(deriveConversationTitle('Hola, quiero buscar una salchipapa económica')).toBe('quiero buscar una salchipapa económica');
  });

  it('builds a compact summary from the thread without copying every message', () => {
    const summary = buildConversationSummary([
      { role: 'user', content: 'Quiero una hamburguesa por menos de treinta mil pesos.' },
      { role: 'assistant', content: 'Encontré tres opciones disponibles.' },
      { role: 'user', content: 'Muéstrame la más rápida.' },
      { role: 'assistant', content: 'La opción más rápida llega en treinta minutos.' },
    ]);
    expect(summary).toContain('Tema: Quiero una hamburguesa');
    expect(summary).toContain('Última solicitud: Muéstrame la más rápida');
    expect(summary).toContain('Última respuesta: La opción más rápida');
    expect(summary.length).toBeLessThanOrEqual(520);
  });

  it('accepts only supported conversation states', () => {
    expect(normalizeConversationStatus('paused')).toBe('paused');
    expect(normalizeConversationStatus('ARCHIVED')).toBe('archived');
    expect(normalizeConversationStatus('deleted')).toBeNull();
  });

  it('clears archived timestamp when restoring and active goal when completing', () => {
    expect(statusTimestampPatch('active').archived_at).toBeNull();
    expect(statusTimestampPatch('completed')).toMatchObject({ status: 'completed', active_goal: null });
    expect(statusTimestampPatch('archived').archived_at).toEqual(expect.any(String));
  });

  it('derives a stable active goal from known tool intents', () => {
    expect(deriveActiveGoal('customer_track_order', '¿Dónde está mi pedido?')).toBe('Dar seguimiento a un pedido');
    expect(deriveActiveGoal('general_question', 'Necesito ayuda con mi cuenta')).toBe('Necesito ayuda con mi cuenta');
  });
});
