import type {
  PaymentProviderName,
  PaymentIntent,
  PaymentTransaction,
  Refund,
  WebhookEvent,
  PaymentRequest,
  PaymentResult,
  PaymentMethod,
  Invoice,
  InvoiceItem,
  BillingInfo,
} from './types';
import type { IPaymentProvider, IPaymentRepository, IIdempotencyStore, IWebhookHandler } from './interfaces';
import {
  PaymentError,
  PaymentProviderError,
  PaymentValidationError,
  PaymentNotFoundError,
  ProviderNotAvailableError,
} from './errors';
import { CURRENCY } from './types';

const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000;

let instance: PaymentService | null = null;

export class PaymentService {
  private readonly providers = new Map<PaymentProviderName, IPaymentProvider>();
  private repository: IPaymentRepository | null = null;
  private idempotencyStore: IIdempotencyStore | null = null;
  private readonly webhookHandlers = new Map<string, IWebhookHandler>();

  private constructor() {}

  static getInstance(): PaymentService {
    if (!instance) {
      instance = new PaymentService();
    }
    return instance;
  }

  static resetInstance(): void {
    instance = null;
  }

  registerProvider(name: PaymentProviderName, provider: IPaymentProvider): void {
    this.providers.set(name, provider);
  }

  getProvider(name: PaymentProviderName): IPaymentProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new ProviderNotAvailableError(name);
    }
    return provider;
  }

  getAvailableProviders(): IPaymentProvider[] {
    return Array.from(this.providers.values()).filter((p) => p.isAvailable());
  }

  setRepository(repo: IPaymentRepository): void {
    this.repository = repo;
  }

  setIdempotencyStore(store: IIdempotencyStore): void {
    this.idempotencyStore = store;
  }

  private getRepo(): IPaymentRepository {
    if (!this.repository) {
      throw new PaymentError('NO_REPOSITORY', 'Payment repository not configured', 500);
    }
    return this.repository;
  }

  private getIdempotencyStore(): IIdempotencyStore {
    if (!this.idempotencyStore) {
      throw new PaymentError('NO_IDEMPOTENCY_STORE', 'Idempotency store not configured', 500);
    }
    return this.idempotencyStore;
  }

  private validateRequest(request: PaymentRequest): void {
    const errors: string[] = [];

    if (!request.amount || request.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }

    if (!request.currency) {
      errors.push('Currency is required');
    } else if (request.currency !== CURRENCY) {
      errors.push(`Unsupported currency: ${request.currency}. Only ${CURRENCY} is supported`);
    }

    if (!request.userId) {
      errors.push('userId is required');
    }

    if (!request.referenceId) {
      errors.push('referenceId is required');
    }

    if (!request.referenceType) {
      errors.push('referenceType is required');
    }

    if (!request.methodType) {
      errors.push('methodType is required');
    }

    if (!request.provider) {
      errors.push('provider is required');
    }

    if (errors.length > 0) {
      throw new PaymentValidationError(errors.join('; '), { errors });
    }
  }

  async createPaymentIntent(request: PaymentRequest): Promise<PaymentResult> {
    this.validateRequest(request);

    const key = request.idempotencyKey ?? crypto.randomUUID();
    const store = this.getIdempotencyStore();

    const existing = await store.get(key);
    if (existing) {
      return existing.result;
    }

    const provider = this.getProvider(request.provider);

    let result: PaymentResult;
    try {
      result = await provider.createPaymentIntent({ ...request, idempotencyKey: key });
    } catch (err) {
      const mapped = this.mapProviderError(request.provider, err);
      result = {
        success: false,
        requiresAction: false,
        errorMessage: mapped.message,
      };
    }

    if (result.success && result.intent) {
      const repo = this.getRepo();
      await repo.saveIntent(result.intent);

      if (result.transaction) {
        await repo.saveTransaction(result.transaction);
      }
    }

    await store.set(key, { result }, IDEMPOTENCY_TTL);

    return result;
  }

  async capturePayment(intentId: string): Promise<PaymentResult> {
    const repo = this.getRepo();
    const intent = await repo.getIntent(intentId);
    if (!intent) {
      throw new PaymentNotFoundError('PaymentIntent', intentId);
    }

    const provider = this.getProvider(intent.provider);
    try {
      const result = await provider.capturePayment(intentId);
      if (result.success) {
        await repo.updateIntent(intentId, { status: result.intent?.status ?? 'paid' });
      }
      return result;
    } catch (err) {
      throw this.mapProviderError(intent.provider, err);
    }
  }

  async cancelPayment(intentId: string): Promise<PaymentResult> {
    const repo = this.getRepo();
    const intent = await repo.getIntent(intentId);
    if (!intent) {
      throw new PaymentNotFoundError('PaymentIntent', intentId);
    }

    const provider = this.getProvider(intent.provider);
    try {
      const result = await provider.cancelPayment(intentId);
      if (result.success) {
        await repo.updateIntent(intentId, { status: result.intent?.status ?? 'cancelled' });
      }
      return result;
    } catch (err) {
      throw this.mapProviderError(intent.provider, err);
    }
  }

  async refundPayment(transactionId: string, amount?: number, reason?: string): Promise<Refund> {
    const repo = this.getRepo();
    const transaction = await repo.getTransaction(transactionId);
    if (!transaction) {
      throw new PaymentNotFoundError('PaymentTransaction', transactionId);
    }

    const provider = this.getProvider(transaction.provider);
    try {
      const refund = await provider.refundPayment(transactionId, amount, reason);
      await repo.saveRefund(refund);
      const refundStatus = amount && amount < transaction.amount ? 'partially_refunded' : 'refunded';
      await repo.updateIntent(transaction.intentId, { status: refundStatus });
      return refund;
    } catch (err) {
      throw this.mapProviderError(transaction.provider, err);
    }
  }

  async getTransaction(transactionId: string): Promise<PaymentTransaction | null> {
    const repo = this.getRepo();
    return repo.getTransaction(transactionId);
  }

  async getIntent(intentId: string): Promise<PaymentIntent | null> {
    const repo = this.getRepo();
    return repo.getIntent(intentId);
  }

  async getIntentsByReference(referenceId: string, referenceType: string): Promise<PaymentIntent[]> {
    const repo = this.getRepo();
    return repo.getIntentsByReference(referenceId, referenceType);
  }

  async getTransactionsByReference(referenceId: string, referenceType: string): Promise<PaymentTransaction[]> {
    const repo = this.getRepo();
    return repo.getTransactionsByReference(referenceId, referenceType);
  }

  createInvoice(data: {
    userId: string;
    amount: number;
    currency: string;
    tax: number;
    items: InvoiceItem[];
    billingInfo: BillingInfo;
    transactionId?: string;
    notes?: string;
    dueDate?: string;
    metadata?: Record<string, unknown>;
  }): Invoice {
    const count = Date.now().toString(36).toUpperCase();
    return {
      id: crypto.randomUUID(),
      number: `INV-${count}`,
      userId: data.userId,
      transactionId: data.transactionId,
      amount: data.amount,
      currency: data.currency,
      tax: data.tax,
      total: data.amount + data.tax,
      status: 'draft',
      items: data.items,
      billingInfo: data.billingInfo,
      notes: data.notes,
      dueDate: data.dueDate,
      metadata: data.metadata ?? {},
      createdAt: new Date().toISOString(),
    };
  }

  async verifyWebhook(provider: PaymentProviderName, event: WebhookEvent): Promise<boolean> {
    const prov = this.getProvider(provider);
    return prov.verifyWebhook(event);
  }

  async processWebhookEvent(event: WebhookEvent): Promise<void> {
    const repo = this.getRepo();
    await repo.saveWebhookEvent(event);

    const handler = this.webhookHandlers.get(event.eventType) ?? this.webhookHandlers.get('*');
    if (handler) {
      await handler.handleEvent(event);
    }
  }

  registerWebhookHandler(eventType: string, handler: IWebhookHandler): void {
    this.webhookHandlers.set(eventType, handler);
  }

  async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    const repo = this.getRepo();
    return repo.getPaymentMethods(userId);
  }

  async savePaymentMethod(method: PaymentMethod): Promise<void> {
    const repo = this.getRepo();
    await repo.savePaymentMethod(method);
  }

  async deletePaymentMethod(methodId: string): Promise<void> {
    const repo = this.getRepo();
    await repo.deletePaymentMethod(methodId);
  }

  private mapProviderError(provider: PaymentProviderName, err: unknown): PaymentError {
    if (err instanceof PaymentError) {
      return err;
    }
    const message = err instanceof Error ? err.message : 'Unknown payment error';
    return new PaymentProviderError(provider, message);
  }
}
