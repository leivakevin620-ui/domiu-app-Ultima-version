export function formatCOP(value: number | string | null | undefined, options?: { symbol?: boolean; code?: boolean }) {
  const amount = Number(value ?? 0);
  const normalized = Number.isFinite(amount) ? Math.round(amount) : 0;
  const formatted = normalized.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  if (options?.code) return `${formatted} COP`;
  if (options?.symbol === false) return formatted;
  return `$ ${formatted}`;
}

export function formatCOPCompact(value: number | string | null | undefined) {
  return formatCOP(value, { symbol: false });
}

export function parseCOP(value: string) {
  const normalized = value.replace(/[^0-9-]/g, '');
  const amount = Number(normalized || 0);
  return Number.isFinite(amount) ? amount : 0;
}
