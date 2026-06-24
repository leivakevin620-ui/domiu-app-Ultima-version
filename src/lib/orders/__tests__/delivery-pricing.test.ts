import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateDeliveryPrice, validateManualPrice } from '../delivery-pricing';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('calculateDeliveryPrice', () => {
  it('debe calcular tarifa base para 0 km (distancia inválida)', () => {
    const result = calculateDeliveryPrice(0);
    expect(result.baseFee).toBe(3000);
    expect(result.finalPrice).toBe(0);
    expect(result.calculationSource).toBe('fallback');
    expect(result.confidence).toBe('low');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('debe calcular tarifa para 1 km (mínimo 5000)', () => {
    const result = calculateDeliveryPrice(1);
    expect(result.baseFee).toBe(3000);
    expect(result.rawPrice).toBe(4200); // 3000 + 1200*1
    expect(result.finalPrice).toBe(5000);
  });

  it('debe calcular tarifa para 5 km', () => {
    const result = calculateDeliveryPrice(5);
    expect(result.finalPrice).toBe(9000); // 3000 + 6000
  });

  it('debe redondear a 500', () => {
    const result = calculateDeliveryPrice(3.2);
    expect(result.rawPrice).toBe(6840); // 3000 + 3840
    expect(result.roundedPrice).toBe(7000); // ceil(6840/500)*500
  });

  it('debe respetar el mínimo', () => {
    const result = calculateDeliveryPrice(0.5);
    expect(result.rawPrice).toBe(3600); // 3000 + 600
    expect(result.finalPrice).toBe(5000);
  });

  it('debe usar configuración personalizada', () => {
    const result = calculateDeliveryPrice(3, {
      baseFee: 5000,
      pricePerKm: 2000,
      minimumFee: 8000,
      rounding: 1000,
    });
    expect(result.baseFee).toBe(5000);
    expect(result.finalPrice).toBe(11000);
  });

  it('debe devolver breakdown completo', () => {
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

  it('debe advertir si distancia excede el máximo', () => {
    const result = calculateDeliveryPrice(35);
    expect(result.warnings.some(w => w.includes('excede'))).toBe(true);
  });

  it('debe devolver distancia redondeada a 2 decimales', () => {
    const result = calculateDeliveryPrice(3.14159);
    expect(result.distanceKm).toBe(3.14);
  });
});

describe('validateManualPrice', () => {
  it('debe aceptar precio válido', () => {
    expect(validateManualPrice(15000)).toEqual({ valid: true });
  });

  it('debe aceptar null/undefined', () => {
    expect(validateManualPrice(null as unknown as number)).toEqual({ valid: true });
    expect(validateManualPrice(undefined as unknown as number)).toEqual({ valid: true });
  });

  it('debe rechazar NaN', () => {
    const result = validateManualPrice(NaN);
    expect(result.valid).toBe(false);
  });

  it('debe rechazar negativo', () => {
    const result = validateManualPrice(-100);
    expect(result.valid).toBe(false);
  });

  it('debe advertir si precio es muy alto', () => {
    const result = validateManualPrice(600000);
    expect(result.valid).toBe(false);
    expect(result.error!.toLowerCase()).toContain('alto');
  });
});
