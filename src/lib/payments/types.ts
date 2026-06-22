import type { PaymentStatus as DB_PaymentStatus, TransactionType, WalletTransactionStatus } from '@/types/database';

export type PaymentProviderName = 'stripe' | 'mercadopago' | 'wompi' | 'payu' | 'nequi' | 'daviplata' | 'pse' | 'wallet_domiu';

export type PaymentFlowStatus =
  | 'pending'
  | 'processing'
  | 'authorized'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'refunded'
  | 'partially_refunded';

export type PaymentMethodType =
  | 'credit_card'
  | 'debit_card'
  | 'nequi'
  | 'daviplata'
  | 'pse'
  | 'cash'
  | 'wallet';

export interface PaymentMethod {
  id: string;
  userId: string;
  type: PaymentMethodType;
  provider: PaymentProviderName;
  token: string;
  brand?: string;
  lastFour?: string;
  holderName?: string;
  expiresAt?: string;
  isDefault: boolean;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: PaymentFlowStatus;
  provider: PaymentProviderName;
  providerIntentId?: string;
  methodId?: string;
  methodType: PaymentMethodType;
  description?: string;
  metadata: Record<string, unknown>;
  idempotencyKey: string;
  userId: string;
  referenceId: string;
  referenceType: 'order' | 'topup' | 'withdrawal';
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentTransaction {
  id: string;
  intentId: string;
  amount: number;
  currency: string;
  fee: number;
  netAmount: number;
  status: PaymentFlowStatus;
  provider: PaymentProviderName;
  providerTransactionId?: string;
  methodType: PaymentMethodType;
  userId: string;
  referenceId: string;
  referenceType: 'order' | 'topup' | 'withdrawal';
  description?: string;
  receiptUrl?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Refund {
  id: string;
  transactionId: string;
  amount: number;
  reason?: string;
  status: 'pending' | 'processed' | 'failed';
  providerRefundId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface WebhookEvent {
  id: string;
  provider: PaymentProviderName;
  eventType: string;
  rawBody: string;
  signature?: string;
  headers: Record<string, string>;
  status: 'received' | 'verified' | 'processed' | 'failed';
  processedAt?: string;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Invoice {
  id: string;
  number: string;
  userId: string;
  transactionId?: string;
  amount: number;
  currency: string;
  tax: number;
  total: number;
  status: 'draft' | 'issued' | 'paid' | 'cancelled';
  items: InvoiceItem[];
  billingInfo: BillingInfo;
  notes?: string;
  dueDate?: string;
  paidAt?: string;
  pdfUrl?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  tax: number;
  total: number;
}

export interface BillingInfo {
  name: string;
  documentType: 'CC' | 'NIT' | 'CE' | 'other';
  documentNumber: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
}

export interface PaymentProviderConfig {
  enabled: boolean;
  webhookSecret?: string;
  apiKey?: string;
  testMode: boolean;
  supportedMethods: PaymentMethodType[];
  feePercentage: number;
  feeFixed: number;
  maxAmount: number;
  minAmount: number;
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  methodId?: string;
  methodType: PaymentMethodType;
  provider: PaymentProviderName;
  description?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  userId: string;
  referenceId: string;
  referenceType: 'order' | 'topup' | 'withdrawal';
  billingInfo?: BillingInfo;
  returnUrl?: string;
}

export interface PaymentResult {
  success: boolean;
  intent?: PaymentIntent;
  transaction?: PaymentTransaction;
  redirectUrl?: string;
  requiresAction: boolean;
  errorMessage?: string;
}

export interface WalletMovement {
  id: string;
  walletId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: WalletTransactionStatus;
  referenceId?: string;
  referenceType?: string;
  description?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export const PAYMENT_STATUS_MAP: Record<PaymentFlowStatus, DB_PaymentStatus> = {
  pending: 'pending',
  processing: 'pending',
  authorized: 'pending',
  paid: 'completed',
  failed: 'failed',
  cancelled: 'failed',
  expired: 'failed',
  refunded: 'refunded',
  partially_refunded: 'refunded',
};

export const CURRENCY = 'COP';
export const DEFAULT_COUNTRY = 'CO';
