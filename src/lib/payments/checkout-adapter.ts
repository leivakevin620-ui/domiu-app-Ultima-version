import type { PaymentProviderName, PaymentRequest, PaymentResult, PaymentIntent, PaymentMethodType } from './types';
import { PaymentService } from './service';
import { CURRENCY } from './types';

export interface CheckoutOrderData {
  orderId: string;
  userId: string;
  amount: number;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface CheckoutPaymentMethod {
  type: PaymentMethodType;
  provider: PaymentProviderName;
  methodId?: string;
}

export interface CheckoutPaymentStatus {
  status: PaymentIntent['status'];
  success: boolean;
  errorMessage?: string;
  intentId?: string;
}

export class CheckoutAdapter {
  constructor(private readonly paymentService: PaymentService) {}

  private async getLatestOrderIntent(orderId: string): Promise<PaymentIntent | null> {
    const intents = await this.paymentService.getIntentsByReference(orderId, 'order');
    return intents.toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
  }

  async processCheckoutPayment(
    orderData: CheckoutOrderData,
    paymentMethod: CheckoutPaymentMethod,
  ): Promise<PaymentResult> {
    const request: PaymentRequest = {
      amount: orderData.amount,
      currency: CURRENCY,
      methodId: paymentMethod.methodId,
      methodType: paymentMethod.type,
      provider: paymentMethod.provider,
      description: orderData.description ?? `Payment for order ${orderData.orderId}`,
      metadata: {
        ...orderData.metadata,
        orderId: orderData.orderId,
      },
      userId: orderData.userId,
      referenceId: orderData.orderId,
      referenceType: 'order',
      returnUrl: undefined,
      billingInfo: undefined,
    };

    return this.paymentService.createPaymentIntent(request);
  }

  async processCheckoutRefund(
    orderId: string,
    amount?: number,
    reason?: string,
  ) {
    const intent = await this.getLatestOrderIntent(orderId);
    if (!intent) {
      throw new Error(`No payment found for order ${orderId}`);
    }

    const transactions = await this.paymentService.getTransactionsByReference(orderId, 'order');
    const transaction = transactions.toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    const transactionId = transaction?.id ?? intent.id;

    return this.paymentService.refundPayment(transactionId, amount, reason);
  }

  async getCheckoutPaymentStatus(orderId: string): Promise<CheckoutPaymentStatus> {
    const intent = await this.getLatestOrderIntent(orderId);

    if (!intent) {
      return {
        status: 'pending',
        success: false,
        errorMessage: 'No payment intent found',
      };
    }

    return {
      status: intent.status,
      success: intent.status === 'paid',
      errorMessage: intent.errorMessage,
      intentId: intent.id,
    };
  }
}
