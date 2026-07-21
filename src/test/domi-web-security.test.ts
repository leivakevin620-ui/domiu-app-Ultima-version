import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const nextConfig = read('next.config.ts');
const proxy = read('src/proxy.ts');
const dockerfile = read('Dockerfile');
const health = read('src/app/api/health/route.ts');

describe('Domi web and deployment security', () => {
  it('publica una política CSP y headers de endurecimiento', () => {
    expect(nextConfig).toContain('Content-Security-Policy');
    expect(nextConfig).toContain('Strict-Transport-Security');
    expect(nextConfig).toContain('Permissions-Policy');
    expect(nextConfig).toContain("frame-ancestors 'none'");
    expect(nextConfig).toContain("object-src 'none'");
    expect(nextConfig).toContain("poweredByHeader: false");
  });

  it('elimina identidad enviada por el cliente y solo la agrega tras getUser', () => {
    expect(proxy).toContain("headers.delete(name)");
    expect(proxy).toContain('supabase.auth.getUser()');
    expect(proxy.indexOf("authenticatedHeaders.set('x-user-id'")).toBeGreaterThan(
      proxy.indexOf('supabase.auth.getUser()'),
    );
  });

  it('construye una imagen standalone y ejecuta como usuario sin privilegios', () => {
    expect(nextConfig).toContain("output: 'standalone'");
    expect(dockerfile).toContain('npm ci');
    expect(dockerfile).toContain('USER nextjs');
    expect(dockerfile).toContain('HEALTHCHECK');
    expect(dockerfile).not.toContain('COPY .env');
  });

  it('el health check no publica modelo, proveedor ni errores internos', () => {
    expect(health).not.toContain('supabaseServerKeyType');
    expect(health).not.toContain('databaseError');
    expect(health).not.toContain('model: generative');
    expect(health).not.toContain('provider: generative');
    expect(health).toContain("'X-Robots-Tag': 'noindex, nofollow, nosnippet'");
  });
});
