import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { validateMutationRequest } from '@/lib/http/request-security';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function request(method: string, headers: Record<string, string> = {}) {
  return new NextRequest('https://domiu.example/api/domi/chat', { method, headers });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Domi request security', () => {
  it('acepta JSON del mismo origen', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://domiu.example');
    expect(validateMutationRequest(request('POST', {
      origin: 'https://domiu.example',
      'content-type': 'application/json',
    }))).toEqual({ ok: true, reason: 'same_origin' });
  });

  it('bloquea origen cruzado y contenido no JSON', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://domiu.example');
    expect(validateMutationRequest(request('POST', {
      origin: 'https://attacker.example',
      'content-type': 'application/json',
    }))).toEqual({ ok: false, reason: 'cross_site' });
    expect(validateMutationRequest(request('POST', {
      origin: 'https://domiu.example',
      'content-type': 'text/plain',
    }))).toEqual({ ok: false, reason: 'invalid_content_type' });
  });

  it('permite DELETE del mismo origen sin cuerpo', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(validateMutationRequest(request('DELETE', {
      origin: 'https://domiu.example',
    }))).toEqual({ ok: true, reason: 'same_origin' });
  });

  it('rechaza mutaciones sin evidencia de origen', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(validateMutationRequest(request('PATCH', {
      'content-type': 'application/json',
    }))).toEqual({ ok: false, reason: 'missing_origin' });
  });

  it('protege todas las rutas mutables de Domi', () => {
    for (const path of [
      'src/app/api/domi/chat/route.ts',
      'src/app/api/domi/conversations/route.ts',
      'src/app/api/domi/conversations/[id]/route.ts',
      'src/app/api/domi/feedback/route.ts',
      'src/app/api/domi/proactive/route.ts',
      'src/app/api/domi/settings/route.ts',
      'src/app/api/domi/voice/route.ts',
      'src/app/api/admin/domi/route.ts',
    ]) {
      expect(read(path), path).toContain('rejectUnsafeMutation');
    }
  });

  it('no autoriza usuarios mediante getSession local', () => {
    const auth = read('src/lib/auth/server-auth.ts');
    expect(auth).toContain('supabase.auth.getUser()');
    expect(auth).not.toContain('supabase.auth.getSession()');
  });
});
