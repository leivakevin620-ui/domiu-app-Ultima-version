import { describe, expect, it } from 'vitest';
import {
  calculateCustomerServiceFee,
  calculateOrderFinancials,
  DEFAULT_FINANCIAL_SETTINGS,
} from '../order-earnings';

describe('order financials', () => {
  it('distribuye el domicilio 80/20 y entrega el subtotal completo al comercio', () => {
    const result = calculateOrderFinancials({
      subtotal: 50_000,
      deliveryFee: 5_000,
      serviceFeeOverride: 1_500,
    });

    expect(result.businessEarnings).toBe(50_000);
    expect(result.courierEarnings).toBe(4_000);
    expect(result.platformDeliveryCommission).toBe(1_000);
    expect(result.platformServiceFee).toBe(1_500);
    expect(result.platformEarnings).toBe(2_500);
    expect(result.customerTotal).toBe(56_500);
    expect(result.businessEarnings + result.courierEarnings + result.platformEarnings).toBe(
      result.customerTotal,
    );
  });

  it('aplica 3 % con mínimo de 500 y máximo de 2.500 COP', () => {
    expect(calculateCustomerServiceFee(5_000, 'product_order')).toBe(500);
    expect(calculateCustomerServiceFee(50_000, 'product_order')).toBe(1_500);
    expect(calculateCustomerServiceFee(500_000, 'product_order')).toBe(2_500);
  });

  it('usa tarifa fija en domicilios manuales', () => {
    expect(calculateCustomerServiceFee(0, 'manual_delivery')).toBe(
      DEFAULT_FINANCIAL_SETTINGS.manualDeliveryServiceFeeCop,
    );
  });

  it('rechaza una distribución que no sume exactamente 100 %', () => {
    expect(() =>
      calculateOrderFinancials(
        { subtotal: 10_000, deliveryFee: 5_000 },
        {
          ...DEFAULT_FINANCIAL_SETTINGS,
          courierDeliveryRateBps: 7_500,
          platformDeliveryRateBps: 2_000,
        },
      ),
    ).toThrow('100 %');
  });

  it('trabaja únicamente con pesos enteros', () => {
    expect(() =>
      calculateOrderFinancials({ subtotal: 10_000.5, deliveryFee: 5_000 }),
    ).toThrow('pesos enteros');
  });
});
