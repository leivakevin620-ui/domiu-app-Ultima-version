import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateDeliveryPrice, validateManualPrice } from '../delivery-pricing';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('calculateDeliveryPrice', () => {
  it('devuelve fallback seguro para 0 km', () => {
    const result = calculateDeliveryPrice(0);
    expect(result.baseFee).toBe(5000);
    expect(result.finalPrice).toBe(0);
    expect(result.calculationSource).toBe('fallback');
    expect(result.confidence).toBe('low');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('incluye hasta 2 km en la tarifa base de 5000 COP', () => {
    const oneKm = calculateDeliveryPrice(1);
    const twoKm = calculateDeliveryPrice(2);
    expect(oneKm.rawPrice).toBe(5000);
    expect(oneKm.finalPrice).toBe(5000);
    expect(twoKm.finalPrice).toBe(5000);
  });

  it('calcula 5 km con kilometraje adicional y redondeo', () => {
    const result = calculateDeliveryPrice(5);
    expect(result.rawPrice).toBe(8600);
    expect(result.finalPrice).toBe(9000);
  });

  it('coincide con PostgreSQL para 3.2 km', () => {
    const result = calculateDeliveryPrice(3.2);
    expect(result.rawPrice).toBe(6440);
    expect(result.roundedPrice).toBe(6500);
    expect(result.finalPrice).toBe(6500);
  });

  it('respeta el mínimo para distancias dentro del tramo base', () => {
    const result = calculateDeliveryPrice(0.5);
    expect(result.rawPrice).toBe(5000);
    expect(result.finalPrice).toBe(5000);
  });

  it('usa configuración personalizada incluyendo distancia base', () => {
    const result = calculateDeliveryPrice(3, {
      baseFee: 5000,
      baseDistanceKm: 1,
      pricePerKm: 2000,
      minimumFee: 8000,
      rounding: 1000,
    });
    expect(result.baseFee).toBe(5000);
    expect(result.finalPrice).toBe(9000);
  });

  it('devuelve el desglose completo', () => {
    const result = calculateDeliveryPrice(10);
    expect(result).toHaveProperty('distanceKm');
    expect(result).toHaveProperty('durationMinutes');
    expect(result).toHaveProperty('baseFee');
    expect(result).toHaveProperty('pricePerKm');
    expect(result).toHaveProperty('rawPrice');
    expect(result).toHaveProperty('roundedPrice');
    expect(result).toHaveProperty('finalPrice');
    expect(result).toHaveProperty('nightSurchargeApplied');
    expect(result).toHaveProperty('calculationSource');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('warnings');
  });

  it('advierte si la distancia excede el máximo automático', () => {
    const result = calculateDeliveryPrice(35);
    expect(result.warnings.some((warning) => warning.includes('excede'))).toBe(true);
  });

  it('redondea la distancia a dos decimales', () => {
    const result = calculateDeliveryPrice(3.14159);
    expect(result.distanceKm).toBe(3.14);
  });
});

describe('validateManualPrice', () => {
  it('acepta un precio válido', () => {
    expect(validateManualPrice(15000)).toEqual({ valid: true });
  });

  it('acepta null o undefined', () => {
    expect(validateManualPrice(null as unknown as number)).toEqual({ valid: true });
    expect(validateManualPrice(undefined as unknown as number)).toEqual({ valid: true });
  });

  it('rechaza NaN', () => {
    expect(validateManualPrice(Number.NaN).valid).toBe(false);
  });

  it('rechaza valores negativos', () => {
    expect(validateManualPrice(-100).valid).toBe(false);
  });

  it('rechaza precios excesivamente altos', () => {
    const result = validateManualPrice(600000);
    expect(result.valid).toBe(false);
    expect(result.error?.toLowerCase()).toContain('alto');
  });
});
