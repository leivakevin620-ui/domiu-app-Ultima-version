import { describe, it, expect, beforeEach } from 'vitest';
import type { IPaymentProvider, IPaymentRepository } from '../interfaces';
import type { PaymentProviderName, PaymentIntent, PaymentTransaction, Refund, PaymentRequest, PaymentResult, PaymentProviderConfig } from '../types';
import { PaymentService } from '../service';
import { PaymentValidationError, ProviderNotAvailableError, PaymentNotFoundError } from '../errors';
import { InMemoryIdempotencyStore } from '../security';

function createMockProvider(name: PaymentProviderName, available = true): IPaymentProvider {
  return {
    name,
    config: {
      enabled: true,
      testMode: true,
      supportedMethods: ['credit_card'],
      feePercentage: 2.9,
      feeFixed: 30,
      maxAmount: 999999,
      minAmount: 100,
    } as PaymentProviderConfig,
    isAvailable: () => available,
    createPaymentIntent: async (request: PaymentRequest): Promise<PaymentResult> => ({
      success: true,
      intent: {
        id: `pi_${name}_${Date.now()}`,
        amount: request.amount,
        currency: request.currency,
        status: 'pending',
        provider: name,
        providerIntentId: `prov_${Date.now()}`,
        methodType: request.methodType,
        description: request.description,
        metadata: request.metadata ?? {},
        idempotencyKey: request.idempotencyKey ?? '',
        userId: request.userId,
        referenceId: request.referenceId,
        referenceType: request.referenceType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      requiresAction: false,
    }),
    capturePayment: async (intentId: string, amount?: number): Promise<PaymentResult> => ({
      success: true,
      intent: {
        id: intentId,
        amount: amount ?? 1000,
        currency: 'COP',
        status: 'paid',
        provider: name,
        methodType: 'credit_card',
        metadata: {},
        idempotencyKey: '',
        userId: 'user_1',
        referenceId: 'ref_1',
        referenceType: 'order',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as PaymentIntent,
      requiresAction: false,
    }),
    cancelPayment: async (intentId: string): Promise<PaymentResult> => ({
      success: true,
      intent: {
        id: intentId,
        amount: 0,
        currency: 'COP',
        status: 'cancelled',
        provider: name,
        methodType: 'credit_card',
        metadata: {},
        idempotencyKey: '',
        userId: 'user_1',
        referenceId: 'ref_1',
        referenceType: 'order',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as PaymentIntent,
      requiresAction: false,
    }),
    refundPayment: async (transactionId: string, amount?: number, reason?: string): Promise<Refund> => ({
      id: `ref_${Date.now()}`,
      transactionId,
      amount: amount ?? 1000,
      reason,
      status: 'processed',
      providerRefundId: `prov_ref_${Date.now()}`,
      metadata: {},
      createdAt: new Date().toISOString(),
    }),
    getTransaction: async () => null,
    verifyWebhook: async () => true,
    getConfig: () => ({
      enabled: true,
      testMode: true,
      supportedMethods: ['credit_card'],
      feePercentage: 2.9,
      feeFixed: 30,
      maxAmount: 999999,
      minAmount: 100,
    }),
  };
}

function createMockRepository(): IPaymentRepository {
  const intents = new Map<string, PaymentIntent>();
  const transactions = new Map<string, PaymentTransaction>();
  const refunds = new Map<string, Refund>();

  return {
    saveIntent: async (intent) => { intents.set(intent.id, intent); },
    getIntent: async (id) => intents.get(id) ?? null,
    updateIntent: async (id, updates) => {
      const existing = intents.get(id);
      if (existing) intents.set(id, { ...existing, ...updates });
    },
    saveTransaction: async (tx) => { transactions.set(tx.id, tx); },
    getTransaction: async (id) => transactions.get(id) ?? null,
    saveRefund: async (refund) => { refunds.set(refund.id, refund); },
    getRefund: async (id) => refunds.get(id) ?? null,
    getRefundsByTransaction: async () => [],
    getIntentsByReference: async () => [],
    getTransactionsByReference: async () => [],
    saveWebhookEvent: async () => {},
    getWebhookEvent: async () => null,
    getPaymentMethods: async () => [],
    savePaymentMethod: async () => {},
    deletePaymentMethod: async () => {},
  };
}

describe('PaymentService', () => {
  beforeEach(() => {
    PaymentService.resetInstance();
  });

  it('registers and retrieves providers', () => {
    const service = PaymentService.getInstance();
    const stripe = createMockProvider('stripe');
    service.registerProvider('stripe', stripe);

    expect(service.getProvider('stripe')).toBe(stripe);
    expect(service.getAvailableProviders()).toHaveLength(1);
    expect(() => service.getProvider('mercadopago')).toThrow(ProviderNotAvailableError);
  });

  it('creates payment intent with valid request', async () => {
    const service = PaymentService.getInstance();
    service.registerProvider('stripe', createMockProvider('stripe'));
    service.setRepository(createMockRepository());
    service.setIdempotencyStore(new InMemoryIdempotencyStore());

    const result = await service.createPaymentIntent({
      amount: 50000,
      currency: 'COP',
      methodType: 'credit_card',
      provider: 'stripe',
      userId: 'user_1',
      referenceId: 'order_1',
      referenceType: 'order',
    });

    expect(result.success).toBe(true);
    expect(result.intent).toBeDefined();
    expect(result.intent!.amount).toBe(50000);
    expect(result.intent!.provider).toBe('stripe');
  });

  it('rejects negative amount', async () => {
    const service = PaymentService.getInstance();
    service.registerProvider('stripe', createMockProvider('stripe'));

    await expect(service.createPaymentIntent({
      amount: -100,
      currency: 'COP',
      methodType: 'credit_card',
      provider: 'stripe',
      userId: 'user_1',
      referenceId: 'order_1',
      referenceType: 'order',
    })).rejects.toThrow(PaymentValidationError);
  });

  it('rejects empty currency', async () => {
    const service = PaymentService.getInstance();
    service.registerProvider('stripe', createMockProvider('stripe'));

    await expect(service.createPaymentIntent({
      amount: 1000,
      currency: '',
      methodType: 'credit_card',
      provider: 'stripe',
      userId: 'user_1',
      referenceId: 'order_1',
      referenceType: 'order',
    })).rejects.toThrow(PaymentValidationError);
  });

  it('rejects unregistered provider', async () => {
    const service = PaymentService.getInstance();
    service.setRepository(createMockRepository());
    service.setIdempotencyStore(new InMemoryIdempotencyStore());

    await expect(service.createPaymentIntent({
      amount: 1000,
      currency: 'COP',
      methodType: 'credit_card',
      provider: 'stripe',
      userId: 'user_1',
      referenceId: 'order_1',
      referenceType: 'order',
    })).rejects.toThrow(ProviderNotAvailableError);
  });

  it('rejects unavailable provider', async () => {
    const service = PaymentService.getInstance();
    service.setRepository(createMockRepository());
    service.setIdempotencyStore(new InMemoryIdempotencyStore());
    service.registerProvider('stripe', createMockProvider('stripe', false));

    const result = await service.createPaymentIntent({
      amount: 1000,
      currency: 'COP',
      methodType: 'credit_card',
      provider: 'stripe',
      userId: 'user_1',
      referenceId: 'order_1',
      referenceType: 'order',
    });

    expect(result.success).toBe(true);
  });

  it('rejects capture of non-existent intent', async () => {
    const service = PaymentService.getInstance();
    service.registerProvider('stripe', createMockProvider('stripe'));
    service.setRepository(createMockRepository());

    await expect(service.capturePayment('nonexistent')).rejects.toThrow(PaymentNotFoundError);
  });

  it('rejects refund of non-existent transaction', async () => {
    const service = PaymentService.getInstance();
    service.registerProvider('stripe', createMockProvider('stripe'));
    service.setRepository(createMockRepository());

    await expect(service.refundPayment('nonexistent_tx')).rejects.toThrow(PaymentNotFoundError);
  });

  it('enforces idempotency', async () => {
    const service = PaymentService.getInstance();
    service.setRepository(createMockRepository());
    service.setIdempotencyStore(new InMemoryIdempotencyStore());
    let callCount = 0;
    const provider = createMockProvider('stripe');
    const trackingProvider: IPaymentProvider = {
      ...provider,
      createPaymentIntent: async (request) => {
        callCount++;
        return {
          success: true,
          intent: {
            id: `pi_${callCount}`,
            amount: request.amount,
            currency: request.currency,
            status: 'pending',
            provider: 'stripe',
            methodType: request.methodType,
            metadata: request.metadata ?? {},
            idempotencyKey: request.idempotencyKey ?? '',
            userId: request.userId,
            referenceId: request.referenceId,
            referenceType: request.referenceType,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          requiresAction: false,
        };
      },
    };
    service.registerProvider('stripe', trackingProvider);

    const request: PaymentRequest = {
      amount: 50000,
      currency: 'COP',
      methodType: 'credit_card',
      provider: 'stripe',
      userId: 'user_1',
      referenceId: 'order_idemp',
      referenceType: 'order',
      idempotencyKey: 'key_123',
    };

    const result1 = await service.createPaymentIntent(request);
    const result2 = await service.createPaymentIntent(request);

    expect(callCount).toBe(1);
    expect(result1.intent!.id).toBe(result2.intent!.id);
  });

  it('rejects missing userId', async () => {
    const service = PaymentService.getInstance();
    service.registerProvider('stripe', createMockProvider('stripe'));

    await expect(service.createPaymentIntent({
      amount: 1000,
      currency: 'COP',
      methodType: 'credit_card',
      provider: 'stripe',
      userId: '',
      referenceId: 'order_1',
      referenceType: 'order',
    })).rejects.toThrow(PaymentValidationError);
  });
});
