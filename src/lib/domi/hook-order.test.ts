import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('DomiAssistant hook lifecycle', () => {
  it('declares every React hook before the authenticated render guard', () => {
    const source = readProjectFile('src/components/domi/DomiAssistantStable.tsx');
    const guard = "if (!mounted || isLoading || !profile || profile.role === 'guest') return null;";
    const guardIndex = source.indexOf(guard);

    expect(guardIndex).toBeGreaterThan(-1);

    const hookIndexes = Array.from(
      source.matchAll(/\buse(?:State|Effect|Memo|Callback|Ref)\s*\(/g),
      (match) => match.index,
    ).filter((index): index is number => typeof index === 'number');

    expect(hookIndexes.length).toBeGreaterThan(0);
    expect(Math.max(...hookIndexes)).toBeLessThan(guardIndex);
  });

  it('keeps Domi isolated and mounted through its protected host', () => {
    const providers = readProjectFile('src/components/providers/RootProviders.tsx');
    const host = readProjectFile('src/components/domi/DomiAssistantHost.tsx');

    expect(providers).toContain(
      "import { DomiAssistantHost } from '@/components/domi/DomiAssistantHost';",
    );
    expect(providers).toContain('<DomiAssistantHost />');
    expect(host).toContain('<DomiAssistantStable />');
    expect(host).toContain('getDerivedStateFromError');
  });
});
