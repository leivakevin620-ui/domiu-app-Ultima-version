import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('DomiAssistant hook lifecycle', () => {
  it('declares every React hook before the authenticated render guard', () => {
    const source = readProjectFile('src/components/domi/DomiAssistant.tsx');
    const guard = 'if (!mounted || isLoading || !profile) return null;';
    const guardIndex = source.indexOf(guard);

    expect(guardIndex).toBeGreaterThan(-1);

    const hookIndexes = Array.from(
      source.matchAll(/\buse(?:State|Effect|Memo|Callback|Ref)\s*\(/g),
      (match) => match.index,
    ).filter((index): index is number => typeof index === 'number');

    expect(hookIndexes.length).toBeGreaterThan(0);
    expect(Math.max(...hookIndexes)).toBeLessThan(guardIndex);
  });

  it('keeps Domi mounted inside the global provider tree', () => {
    const providers = readProjectFile('src/components/providers/RootProviders.tsx');

    expect(providers).toContain("import { DomiAssistant } from '@/components/domi/DomiAssistant';");
    expect(providers).toContain('<DomiAssistant />');
  });
});
