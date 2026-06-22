import type { IPaymentProvider } from '../interfaces';
import type { WebhookEvent } from '../types';
import { verifySignature } from '../security/signature';
import { PaymentSignatureError, PaymentProviderError } from '../errors';

export interface WebhookResponse {
  received: boolean;
  status: 'success' | 'failed';
  message?: string;
}

export async function processProviderWebhook(
  provider: IPaymentProvider,
  event: WebhookEvent,
): Promise<WebhookResponse> {
  const secret = provider.getConfig().webhookSecret;

  if (secret && event.signature) {
    const isValid = verifySignature(event.rawBody, event.signature, secret);
    if (!isValid) {
      throw new PaymentSignatureError();
    }
    event.status = 'verified';
  }

  try {
    const verified = await provider.verifyWebhook(event);
    if (!verified) {
      throw new PaymentProviderError(
        provider.name,
        'Webhook verification failed at provider level',
      );
    }

    event.status = 'processed';
    event.processedAt = new Date().toISOString();

    return {
      received: true,
      status: 'success',
    };
  } catch (error) {
    if (error instanceof PaymentSignatureError || error instanceof PaymentProviderError) {
      throw error;
    }

    event.status = 'failed';
    event.errorMessage = error instanceof Error ? error.message : String(error);

    return {
      received: true,
      status: 'failed',
      message: event.errorMessage,
    };
  }
}

export function createWebhookResponse(
  status: 'success' | 'failed',
  message?: string,
): WebhookResponse {
  return {
    received: true,
    status,
    ...(message && { message }),
  };
}
