import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const migration = [
  '20260719233834_domi_complete_agent_settings.sql',
  '20260719233853_domi_complete_agent_order_drafts.sql',
  '20260719233911_domi_complete_agent_learning.sql',
  '20260719233932_domi_complete_agent_evaluations.sql',
  '20260719233950_domi_complete_agent_proactive.sql',
  '20260719234008_domi_complete_agent_voice.sql',
].map((file) => read(`supabase/migrations/${file}`)).join('\n');
const orchestrator = read('src/lib/domi/agent/conversation-orchestrator.ts');
const recommendations = read('src/lib/domi/agent/recommendation-engine.ts');
const drafts = read('src/lib/domi/agent/order-draft-service.ts');
const adminApi = read('src/app/api/admin/domi/route.ts');
const voice = read('src/components/domi/DomiVoiceDock.tsx');
const proactive = read('src/lib/domi/agent/proactive-service.ts');
const host = read('src/components/domi/DomiAssistantHost.tsx');

describe('Domi complete agent architecture', () => {
  it('crea persistencia separada para borradores aprendizaje evaluación proactividad y voz', () => {
    for (const table of [
      'domi_order_drafts',
      'domi_learning_candidates',
      'domi_evaluations',
      'domi_proactive_events',
      'domi_voice_sessions',
    ]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('usa datos comerciales reales para recomendaciones', () => {
    expect(recommendations).toContain(".from('products')");
    expect(recommendations).toContain(".from('customer_favorites')");
    expect(recommendations).toContain('estimateDomiPricing');
    expect(recommendations).toContain('quantity_available');
    expect(recommendations).toContain('discount_price');
    expect(recommendations).toContain('businesses.operations_status');
  });

  it('prepara carrito y borrador sin crear pedido ni pago', () => {
    expect(drafts).toContain(".from('domi_order_drafts')");
    expect(drafts).toContain("type: 'cart.replace'");
    expect(drafts).toContain('el pago debe hacerse manualmente');
    expect(drafts).not.toContain(".from('payments').insert");
    expect(drafts).not.toContain(".from('orders').insert");
  });

  it('mantiene aprendizaje global bajo revisión administrativa explícita', () => {
    expect(adminApi).toContain("candidate.status !== 'approved'");
    expect(adminApi).toContain("candidate.candidate_type === 'preference_pattern'");
    expect(adminApi).toContain('articleTitle');
    expect(adminApi).toContain('articleContent');
    expect(adminApi).toContain("status: 'deployed'");
  });

  it('no guarda audio y permite interrumpir voz', () => {
    expect(voice).toContain("action: 'start'");
    expect(voice).toContain("closeVoiceSession('interrupt'");
    expect(voice).toContain('Domi no guarda grabaciones de audio');
    expect(voice).toContain('speechSynthesis.cancel');
  });

  it('genera proactividad solo cuando está autorizada', () => {
    expect(proactive).toContain('!args.settings.proactiveEnabled');
    expect(proactive).toContain("args.settings.proactiveFrequency === 'off'");
    expect(proactive).toContain('inQuietHours(args.settings)');
    expect(proactive).toContain(".eq('customer_id', args.context.userId)");
  });

  it('orquesta recomendaciones promociones direcciones pedidos memoria y configuración', () => {
    expect(orchestrator).toContain('classifyDomiAdvancedIntent');
    expect(orchestrator).toContain('recommendDomiProducts');
    expect(orchestrator).toContain('getDomiPromotions');
    expect(orchestrator).toContain('prepareDomiOrderDraft');
    expect(orchestrator).toContain('captureDomiLearningCandidate');
    expect(orchestrator).toContain('updateConversation');
  });

  it('monta los módulos dentro del límite de error de Domi', () => {
    expect(host).toContain('<DomiAssistantStable />');
    expect(host).toContain('<DomiAgentBridge />');
    expect(host).toContain('<DomiVoiceDock />');
    expect(host).toContain('<DomiProactiveDock />');
    expect(host).toContain('<DomiFeedbackDock />');
  });

  it('no añade automatizaciones financieras ni cambios administrativos sensibles', () => {
    const all = `${orchestrator}\n${drafts}\n${adminApi}`;
    expect(all).not.toContain('executePayment');
    expect(all).not.toContain('processRefund');
    expect(all).not.toContain('transferFunds');
    expect(all).not.toContain('changeUserRole');
    expect(all).not.toContain('createAdministrator');
  });
});
