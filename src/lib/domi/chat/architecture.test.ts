import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Domi modular chat architecture', () => {
  it('mantiene la ruta API mínima y delega en el manejador seguro', () => {
    const route = read('src/app/api/domi/chat/route.ts');
    expect(route).toContain("import { handleDomiChat } from '@/lib/domi/chat/handler'");
    expect(route).toContain('return handleDomiChat(request)');
    expect(route.split('\n').length).toBeLessThan(20);
  });

  it('separa preparación de sesión y generación de respuesta', () => {
    const handler = read('src/lib/domi/chat/handler.ts');
    expect(handler).toContain('prepareDomiChatSession');
    expect(handler).toContain('respondToDomiChat');
  });

  it('respeta la preferencia de memoria antes de guardar candidatos', () => {
    const memory = read('src/lib/domi/chat/memory.ts');
    expect(memory).toContain('if (!args.settings.memoryEnabled)');
    expect(memory).toContain('saveDomiMemory');
    expect(memory).toContain('memory_confirmation');
    expect(memory).toContain('memory_cancelled');
  });

  it('respeta la preferencia de proactividad al sugerir próximos pasos', () => {
    const respond = read('src/lib/domi/chat/respond.ts');
    expect(respond).toContain('settings.proactiveEnabled');
    expect(respond).toContain('suggestedActions');
  });

  it('mantiene idempotencia rate limit propiedad de conversación y auditoría', () => {
    const session = read('src/lib/domi/chat/session.ts');
    expect(session).toContain('findIdempotentDomiResponse');
    expect(session).toContain('enforceDomiRateLimit');
    expect(session).toContain('conversation_not_owned');
    expect(session).toContain('writeDomiAudit');
  });
});
