import { randomUUID } from 'crypto';
import type {
  PaymentProviderName,
  PaymentIntent,
  PaymentTransaction,
  Refund,
  PaymentRequest,
  PaymentResult,
  PaymentProviderConfig,
} from '../types';
import type { IPaymentProvider } from '../interfaces';

const CONFIG: PaymentProviderConfig = {
  enabled: true,
  testMode: true,
  supportedMethods: ['credit_card', 'debit_card', 'pse', 'nequi', 'daviplata'],
  feePercentage: 2.5,
  feeFixed: 200,
  maxAmount: 999999999,
  minAmount: 100,
};

const INTENTS = new Map<string, PaymentIntent>();
const TXNS = new Map<string, PaymentTransaction>();

export class WompiProvider implements IPaymentProvider {
  readonly name: PaymentProviderName = 'wompi';
  readonly config: PaymentProviderConfig = { ...CONFIG };

  async createPaymentIntent(request: PaymentRequest): Promise<PaymentResult> {
    await new Promise(r => setTimeout(r, 300));
    const intent: PaymentIntent = {
      id: randomUUID(),
      amount: request.amount,
      currency: request.currency,
      status: 'authorized',
      provider: this.name,
      providerIntentId: `wp_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      methodId: request.methodId,
      methodType: request.methodType,
      description: request.description,
      metadata: request.metadata ?? {},
      idempotencyKey: request.idempotencyKey ?? randomUUID(),
      userId: request.userId,
      referenceId: request.referenceId,
      referenceType: request.referenceType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    INTENTS.set(intent.id, intent);
    INTENTS.set(intent.providerIntentId!, intent);
    if (request.methodType === 'pse' && request.returnUrl) {
      return {
        success: true,
        intent,
        redirectUrl: `https://checkout.wompi.co/pse/${intent.providerIntentId}`,
        requiresAction: true,
      };
    }
    return { success: true, intent, requiresAction: false };
  }

  async capturePayment(intentId: string, amount?: number): Promise<PaymentResult> {
    await new Promise(r => setTimeout(r, 300));
    const stored = INTENTS.get(intentId);
    if (stored) {
      stored.status = 'paid';
      stored.updatedAt = new Date().toISOString();
    }
    const intent: PaymentIntent = stored ?? {
      id: intentId,
      amount: amount ?? 0,
      currency: 'COP',
      status: 'paid',
      provider: this.name,
      providerIntentId: intentId,
      methodType: 'credit_card',
      metadata: {},
      idempotencyKey: randomUUID(),
      userId: '',
      referenceId: '',
      referenceType: 'order',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const txn: PaymentTransaction = {
      id: randomUUID(),
      intentId,
      amount: amount ?? intent.amount,
      currency: 'COP',
      fee: Math.round((amount ?? intent.amount) * 0.025) + 200,
      netAmount: (amount ?? intent.amount) - Math.round((amount ?? intent.amount) * 0.025) - 200,
      status: 'paid',
      provider: this.name,
      providerTransactionId: `txn_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      methodType: intent.methodType,
      userId: intent.userId,
      referenceId: intent.referenceId,
      referenceType: intent.referenceType,
      description: intent.description,
      metadata: {},
      createdAt: new Date().toISOString(),
    };
    TXNS.set(txn.providerTransactionId!, txn);
    return { success: true, intent, transaction: txn, requiresAction: false };
  }

  async cancelPayment(intentId: string): Promise<PaymentResult> {
    await new Promise(r => setTimeout(r, 200));
    const stored = INTENTS.get(intentId);
    if (stored) {
      stored.status = 'cancelled';
      stored.updatedAt = new Date().toISOString();
    }
    const intent: PaymentIntent = stored ?? {
      id: intentId,
      amount: 0,
      currency: 'COP',
      status: 'cancelled',
      provider: this.name,
      providerIntentId: intentId,
      methodType: 'credit_card',
      metadata: {},
      idempotencyKey: randomUUID(),
      userId: '',
      referenceId: '',
      referenceType: 'order',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return { success: true, intent, requiresAction: false };
  }

  async refundPayment(transactionId: string, amount?: number, reason?: string): Promise<Refund> {
    await new Promise(r => setTimeout(r, 300));
    return {
      id: randomUUID(),
      transactionId,
      amount: amount ?? 0,
      reason,
      status: 'processed',
      providerRefundId: `rf_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      metadata: {},
      createdAt: new Date().toISOString(),
    };
  }

  async getTransaction(providerTransactionId: string): Promise<PaymentTransaction | null> {
    return TXNS.get(providerTransactionId) ?? null;
  }

  async verifyWebhook(): Promise<boolean> {
    return true;
  }

  getConfig(): PaymentProviderConfig {
    return this.config;
  }

  isAvailable(): boolean {
    return this.config.enabled;
  }
}
