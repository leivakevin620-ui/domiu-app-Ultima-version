export interface DeliveryPricingConfig {
  baseFee: number;
  pricePerKm: number;
  minimumFee: number;
  rounding: number;
  maxAutomaticDistanceKm: number;
  nightSurcharge?: number;
}

export interface DeliveryPriceResult {
  distanceKm: number;
  durationMinutes: number;
  baseFee: number;
  pricePerKm: number;
  rawPrice: number;
  roundedPrice: number;
  finalPrice: number;
  nightSurchargeApplied: boolean;
  calculationSource: 'automatic' | 'manual' | 'fallback';
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

const DEFAULT_CONFIG: DeliveryPricingConfig = {
  baseFee: 3000,
  pricePerKm: 1200,
  minimumFee: 5000,
  rounding: 500,
  maxAutomaticDistanceKm: 30,
  nightSurcharge: 0,
};

function isNightHours(): boolean {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 6;
}

function roundPrice(amount: number, rounding: number): number {
  if (rounding <= 0) return Math.round(amount);
  return Math.ceil(amount / rounding) * rounding;
}

export function calculateDeliveryPrice(
  distanceKm: number,
  config: Partial<DeliveryPricingConfig> = {},
): DeliveryPriceResult {
  const warnings: string[] = [];
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!distanceKm || distanceKm <= 0) {
    warnings.push('La distancia debe ser mayor a 0 km');
    return {
      distanceKm: 0,
      durationMinutes: 0,
      baseFee: cfg.baseFee,
      pricePerKm: cfg.pricePerKm,
      rawPrice: 0,
      roundedPrice: 0,
      finalPrice: 0,
      nightSurchargeApplied: false,
      calculationSource: 'fallback',
      confidence: 'low',
      warnings: ['Distancia inválida. Ingresa los kilómetros manualmente.'],
    };
  }

  if (distanceKm > cfg.maxAutomaticDistanceKm) {
    warnings.push(
      `La distancia (${distanceKm} km) excede el máximo automático (${cfg.maxAutomaticDistanceKm} km). Verifica manualmente.`,
    );
  }

  const rawPrice = cfg.baseFee + distanceKm * cfg.pricePerKm;
  const roundedPrice = roundPrice(rawPrice, cfg.rounding);
  let finalPrice = Math.max(roundedPrice, cfg.minimumFee);

  const nightSurchargeApplied = isNightHours() && (cfg.nightSurcharge ?? 0) > 0;
  if (nightSurchargeApplied) {
    finalPrice += cfg.nightSurcharge!;
  }

  const durationMinutes = Math.round((distanceKm / 30) * 60);

  if (rawPrice < cfg.minimumFee) {
    warnings.push(`El precio calculado ($${rawPrice.toLocaleString('es-CO')}) está por debajo de la tarifa mínima`);
  }

  return {
    distanceKm: Math.round(distanceKm * 100) / 100,
    durationMinutes,
    baseFee: cfg.baseFee,
    pricePerKm: cfg.pricePerKm,
    rawPrice: Math.round(rawPrice),
    roundedPrice,
    finalPrice,
    nightSurchargeApplied,
    calculationSource: 'automatic',
    confidence: distanceKm > 0 ? 'high' : 'low',
    warnings,
  };
}

export function validateManualPrice(price: number): { valid: boolean; error?: string } {
  if (price === undefined || price === null) return { valid: true };
  if (typeof price !== 'number' || isNaN(price)) {
    return { valid: false, error: 'El precio debe ser un número válido' };
  }
  if (price < 0) {
    return { valid: false, error: 'El precio no puede ser negativo' };
  }
  if (price > 500000) {
    return { valid: false, error: 'El precio parece demasiado alto (> $500,000). Verifica.' };
  }
  return { valid: true };
}
