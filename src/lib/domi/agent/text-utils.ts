export function normalizeDomiText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseDomiBudget(message: string): number | null {
  const normalized = normalizeDomiText(message);
  const match = normalized.match(/(?:\$\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{1,6})\s*(mil|k)?\b/);
  if (!match) return null;
  let amount = Number(match[1].replace(/[.,]/g, ''));
  if (!Number.isFinite(amount)) return null;
  if (match[2] && amount < 1000) amount *= 1000;
  return amount >= 1000 && amount <= 10_000_000 ? Math.round(amount) : null;
}

export function cleanDomiQuery(message: string) {
  return message
    .replace(/(?:con|de|hasta|por)\s+(?:un\s+)?presupuesto\s+(?:de\s+)?\$?[\d.,]+\s*(?:mil|k)?/gi, ' ')
    .replace(/(?:no\s+)?(?:pase|supere|cueste mas de|cueste más de)\s+\$?[\d.,]+\s*(?:mil|k)?/gi, ' ')
    .replace(/\$?[\d.,]+\s*(?:mil|k)?/gi, ' ')
    .replace(/\b(?:busca(?:me)?|buscar|encuentra(?:me)?|recomienda(?:me)?|quiero|quisiera|necesito|opciones?|productos?|negocios?|restaurantes?|hoy|por favor)\b/gi, ' ')
    .replace(/[<>()[\]{}|`$^\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

export function extractDomiReference(message: string) {
  return message.match(/[“"']([^“"']{2,120})[”"']/)?.[1]?.trim().slice(0, 120) || null;
}
