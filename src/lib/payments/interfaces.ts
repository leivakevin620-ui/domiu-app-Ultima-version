import type {
  PaymentProviderName,
  PaymentIntent,
  PaymentTransaction,
  Refund,
  PaymentRequest,
  PaymentResult,
  PaymentProviderConfig,
  WebhookEvent,
} from './types';

export interface IPaymentProvider {
  readonly name: PaymentProviderName;
  readonly config: PaymentProviderConfig;

  createPaymentIntent(request: PaymentRequest): Promise<PaymentResult>;
  capturePayment(intentId: string, amount?: number): Promise<PaymentResult>;
  cancelPayment(intentId: string): Promise<PaymentResult>;
  refundPayment(transactionId: string, amount?: number, reason?: string): Promise<Refund>;
  getTransaction(providerTransactionId: string): Promise<PaymentTransaction | null>;
  verifyWebhook(event: WebhookEvent): Promise<boolean>;
  getConfig(): PaymentProviderConfig;
  isAvailable(): boolean;
}

export interface IPaymentRepository {
  saveIntent(intent: PaymentIntent): Promise<void>;
  getIntent(id: string): Promise<PaymentIntent | null>;
  updateIntent(id: string, updates: Partial<PaymentIntent>): Promise<void>;
  saveTransaction(tx: PaymentTransaction): Promise<void>;
  getTransaction(id: string): Promise<PaymentTransaction | null>;
  saveRefund(refund: Refund): Promise<void>;
  getRefund(id: string): Promise<Refund | null>;
  getRefundsByTransaction(transactionId: string): Promise<Refund[]>;
  getIntentsByReference(referenceId: string, referenceType: string): Promise<PaymentIntent[]>;
  getTransactionsByReference(referenceId: string, referenceType: string): Promise<PaymentTransaction[]>;
  saveWebhookEvent(event: WebhookEvent): Promise<void>;
  getWebhookEvent(id: string): Promise<WebhookEvent | null>;
  getPaymentMethods(userId: string): Promise<import('./types').PaymentMethod[]>;
  savePaymentMethod(method: import('./types').PaymentMethod): Promise<void>;
  deletePaymentMethod(methodId: string): Promise<void>;
}

export interface IWalletService {
  getBalance(userId: string): Promise<number>;
  credit(userId: string, amount: number, description: string, referenceId?: string, referenceType?: string): Promise<import('./types').WalletMovement>;
  debit(userId: string, amount: number, description: string, referenceId?: string, referenceType?: string): Promise<import('./types').WalletMovement>;
  getMovements(userId: string, limit?: number, offset?: number): Promise<import('./types').WalletMovement[]>;
  getMovementsCount(userId: string): Promise<number>;
  isAvailable(userId: string): Promise<boolean>;
}

export interface IIdempotencyStore {
  get(key: string): Promise<{ result: PaymentResult } | null>;
  set(key: string, value: { result: PaymentResult }, ttlMs: number): Promise<void>;
}

export interface IWebhookHandler {
  handleEvent(event: WebhookEvent): Promise<void>;
  registerHandler(eventType: string, handler: (event: WebhookEvent) => Promise<void>): void;
}
