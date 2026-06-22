import type { IWebhookHandler } from '../interfaces';
import type { WebhookEvent } from '../types';
import { PaymentError } from '../errors';

type EventHandler = (event: WebhookEvent) => Promise<void>;

export class WebhookEventRegistry implements IWebhookHandler {
  private handlers = new Map<string, EventHandler[]>();

  constructor() {
    this.registerBuiltinHandlers();
  }

  registerHandler(eventType: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventType) ?? [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
  }

  async handleEvent(event: WebhookEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType);
    if (!handlers || handlers.length === 0) {
      return;
    }

    const results = await Promise.allSettled(
      handlers.map((handler) => handler(event)),
    );

    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );

    if (rejected.length > 0) {
      throw new PaymentError(
        'WEBHOOK_HANDLER_ERROR',
        `Webhook handler(s) failed for event '${event.eventType}': ${rejected.map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason))).join('; ')}`,
        500,
      );
    }
  }

  getRegisteredHandlers(): string[] {
    return Array.from(this.handlers.keys());
  }

  private registerBuiltinHandlers(): void {
    this.registerHandler('payment.intent.succeeded', async (event) => {
      event.status = 'processed';
      event.processedAt = new Date().toISOString();
    });

    this.registerHandler('payment.intent.failed', async (event) => {
      event.status = 'processed';
      event.processedAt = new Date().toISOString();
    });

    this.registerHandler('payment.refund.completed', async (event) => {
      event.status = 'processed';
      event.processedAt = new Date().toISOString();
    });
  }
}
