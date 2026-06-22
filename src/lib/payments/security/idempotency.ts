import type { IIdempotencyStore } from '../interfaces';
import type { PaymentRequest, PaymentResult } from '../types';
import { createHash } from 'node:crypto';

interface CacheEntry {
  value: { result: PaymentResult };
  expiresAt: number;
}

export class InMemoryIdempotencyStore implements IIdempotencyStore {
  private store = new Map<string, CacheEntry>();

  async get(key: string): Promise<{ result: PaymentResult } | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: { result: PaymentResult }, ttlMs: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  generateKey(request: PaymentRequest): string {
    const raw = `${request.provider}:${request.referenceType}:${request.referenceId}:${request.userId}`;
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }
}
