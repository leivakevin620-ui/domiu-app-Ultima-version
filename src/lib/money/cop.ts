export function toCopInteger(value: unknown, label = 'Valor'): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} no es un número válido`);
  if (!Number.isInteger(parsed)) throw new Error(`${label} debe expresarse en pesos enteros COP`);
  if (parsed < 0) throw new Error(`${label} no puede ser negativo`);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label} supera el rango monetario permitido`);
  return parsed;
}

export function formatCop(value: unknown, options: { symbol?: boolean } = {}): string {
  const amount = toCopInteger(value);
  const formatted = new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    useGrouping: true,
  }).format(amount);
  return options.symbol === false ? formatted : `$${formatted}`;
}

export function roundCop(value: number, increment = 1): number {
  if (!Number.isFinite(value)) throw new Error('El valor a redondear no es válido');
  const safeIncrement = toCopInteger(increment, 'Incremento de redondeo');
  if (safeIncrement < 1) throw new Error('El incremento debe ser mayor que cero');
  return Math.round(value / safeIncrement) * safeIncrement;
}
