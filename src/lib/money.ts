export function formatCOP(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `$ ${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(safe)}`;
}

export function formatCOPNumber(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(safe);
}
