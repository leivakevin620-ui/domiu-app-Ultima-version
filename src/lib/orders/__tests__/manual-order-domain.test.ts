import { describe, expect, it } from 'vitest';
import {
  calculateManualOrderTotals,
  manualOrderRequestSchema,
  normalizeManualOrderPhone,
  type ResolvedManualOrderItem,
} from '@/lib/orders/manual-order-domain';

const baseInput = {
  panel: 'admin' as const,
  businessId: '11111111-1111-4111-8111-111111111111',
  idempotencyKey: '22222222-2222-4222-8222-222222222222',
  customer: {
    kind: 'guest' as const,
    name: 'Kevin Leiva',
    phone: '3113748405',
  },
  delivery: {
    type: 'delivery' as const,
    address: 'Carrera 5 # 10-20',
    city: 'Santa Marta',
    distanceKm: 3.2,
  },
  deliveryFee: {
    source: 'automatic' as const,
    amount: 7000,
  },
  salesChannel: 'whatsapp' as const,
  paymentMethod: 'cash' as const,
  paymentStatus: 'pending' as const,
  paidAmount: 0,
  initialStatus: 'confirmed' as const,
  adminReason: 'Pedido recibido por WhatsApp y verificado por administración',
  tipAmount: 0,
  surchargeAmount: 0,
  items: [
    {
      productId: '33333333-3333-4333-8333-333333333333',
      isCustomItem: false,
      quantity: 2,
    },
  ],
};

describe('manual order domain', () => {
  it('accepts a guest customer without creating an auth identity', () => {
    const result = manualOrderRequestSchema.safeParse(baseInput);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.customer.customerId).toBeUndefined();
  });

  it('requires an administrative creation reason', () => {
    const result = manualOrderRequestSchema.safeParse({
      ...baseInput,
      adminReason: undefined,
    });
    expect(result.success).toBe(false);
  });

  it('requires a reason when the delivery fee is overridden', () => {
    const result = manualOrderRequestSchema.safeParse({
      ...baseInput,
      deliveryFee: { source: 'manual', amount: 9000 },
    });
    expect(result.success).toBe(false);
  });

  it('prevents delivery fees for pickup orders', () => {
    const result = manualOrderRequestSchema.safeParse({
      ...baseInput,
      delivery: { type: 'pickup' },
      deliveryFee: { source: 'not_applicable', amount: 5000 },
    });
    expect(result.success).toBe(false);
  });

  it('prevents courier assignment for pickup orders', () => {
    const result = manualOrderRequestSchema.safeParse({
      ...baseInput,
      delivery: { type: 'pickup' },
      deliveryFee: { source: 'not_applicable', amount: 0 },
      courierId: '44444444-4444-4444-8444-444444444444',
    });
    expect(result.success).toBe(false);
  });

  it('requires a description for the other sales channel', () => {
    const result = manualOrderRequestSchema.safeParse({
      ...baseInput,
      salesChannel: 'other',
    });
    expect(result.success).toBe(false);
  });

  it('calculates integer COP totals without trusting frontend totals', () => {
    const items: ResolvedManualOrderItem[] = [
      {
        name: 'Hamburguesa',
        productId: '1',
        quantity: 2,
        unitPrice: 18_000,
        isCustomItem: false,
      },
      {
        name: 'Gaseosa',
        productId: '2',
        quantity: 1,
        unitPrice: 5_000,
        isCustomItem: false,
      },
    ];
    expect(
      calculateManualOrderTotals(items, {
        deliveryFee: 7_000,
        tipAmount: 2_000,
        surchargeAmount: 0,
        paidAmount: 20_000,
      }),
    ).toEqual({
      subtotal: 41_000,
      deliveryFee: 7_000,
      tipAmount: 2_000,
      surchargeAmount: 0,
      total: 50_000,
      paidAmount: 20_000,
      outstandingAmount: 30_000,
    });
  });

  it('normalizes Colombian phone formatting', () => {
    expect(normalizeManualOrderPhone('+57 (311) 374-8405')).toBe('+573113748405');
  });
});
