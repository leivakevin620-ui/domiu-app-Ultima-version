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
import { WalletInsufficientFundsError, PaymentNotFoundError } from '../errors';
import { WalletService } from '../wallet/service';

const CONFIG: PaymentProviderConfig = {
  enabled: true,
  testMode: true,
  supportedMethods: ['wallet'],
  feePercentage: 0,
  feeFixed: 0,
  maxAmount: 999999999,
  minAmount: 100,
};

const INTENTS = new Map<string, PaymentIntent>();
const TXNS = new Map<string, PaymentTransaction>();

export class WalletProvider implements IPaymentProvider {
  readonly name: PaymentProviderName = 'wallet_domiu';
  readonly config: PaymentProviderConfig = { ...CONFIG };
  private walletService = new WalletService();

  async createPaymentIntent(request: PaymentRequest): Promise<PaymentResult> {
    const balance = await this.walletService.getBalance(request.userId);
    if (balance < request.amount) {
      throw new WalletInsufficientFundsError(balance, request.amount);
    }
    const intent: PaymentIntent = {
      id: randomUUID(),
      amount: request.amount,
      currency: request.currency,
      status: 'authorized',
      provider: this.name,
      providerIntentId: `wal_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
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
    return { success: true, intent, requiresAction: false };
  }

  async capturePayment(intentId: string, amount?: number): Promise<PaymentResult> {
    const stored = INTENTS.get(intentId);
    if (!stored) {
      throw new PaymentNotFoundError('PaymentIntent', intentId);
    }
    const captureAmount = amount ?? stored.amount;
    await this.walletService.debit(
      stored.userId,
      captureAmount,
      `Payment capture for ${stored.referenceId}`,
      stored.referenceId,
      stored.referenceType,
    );
    stored.status = 'paid';
    stored.updatedAt = new Date().toISOString();
    const txn: PaymentTransaction = {
      id: randomUUID(),
      intentId,
      amount: captureAmount,
      currency: stored.currency,
      fee: 0,
      netAmount: captureAmount,
      status: 'paid',
      provider: this.name,
      providerTransactionId: `txn_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      methodType: stored.methodType,
      userId: stored.userId,
      referenceId: stored.referenceId,
      referenceType: stored.referenceType,
      description: stored.description,
      metadata: {},
      createdAt: new Date().toISOString(),
    };
    TXNS.set(txn.providerTransactionId!, txn);
    return { success: true, intent: stored, transaction: txn, requiresAction: false };
  }

  async cancelPayment(intentId: string): Promise<PaymentResult> {
    const stored = INTENTS.get(intentId);
    if (!stored) {
      throw new PaymentNotFoundError('PaymentIntent', intentId);
    }
    stored.status = 'cancelled';
    stored.updatedAt = new Date().toISOString();
    return { success: true, intent: stored, requiresAction: false };
  }

  async refundPayment(transactionId: string, amount?: number, reason?: string): Promise<Refund> {
    const stored = TXNS.get(transactionId);
    if (!stored) {
      const txnFromId = Array.from(TXNS.values()).find(t => t.id === transactionId);
      if (!txnFromId) {
        throw new PaymentNotFoundError('PaymentTransaction', transactionId);
      }
    }
    const txn = stored ?? TXNS.get(transactionId)!;
    await this.walletService.credit(
      txn.userId,
      amount ?? txn.amount,
      reason ?? `Refund for transaction ${transactionId}`,
      txn.referenceId,
      txn.referenceType,
    );
    return {
      id: randomUUID(),
      transactionId,
      amount: amount ?? txn.amount,
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
