import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { InMemoryIdempotencyStore, verifySignature, validatePaymentRequest } from '../security';
import type { PaymentRequest } from '../types';

describe('Security', () => {
  describe('verifySignature', () => {
    it('succeeds with correct signature', () => {
      const payload = '{"amount":50000,"currency":"COP"}';
      const secret = 'whsec_test_secret';
      const signature = createHmac('sha256', secret).update(payload, 'utf8').digest('hex');

      expect(verifySignature(payload, signature, secret)).toBe(true);
    });

    it('fails with wrong signature', () => {
      const payload = '{"amount":50000,"currency":"COP"}';
      const secret = 'whsec_test_secret';

      expect(verifySignature(payload, 'wrong_signature', secret)).toBe(false);
    });

    it('fails with wrong secret', () => {
      const payload = '{"amount":50000,"currency":"COP"}';
      const secret = 'whsec_test_secret';
      const signature = createHmac('sha256', secret).update(payload, 'utf8').digest('hex');

      expect(verifySignature(payload, signature, 'wrong_secret')).toBe(false);
    });
  });

  describe('InMemoryIdempotencyStore', () => {
    it('returns null for non-existent key', async () => {
      const store = new InMemoryIdempotencyStore();
      expect(await store.get('nonexistent')).toBeNull();
    });

    it('stores and retrieves values', async () => {
      const store = new InMemoryIdempotencyStore();
      await store.set('key_1', { result: { success: true, intent: {} as PaymentIntent, requiresAction: false } }, 60000);
      const cached = await store.get('key_1');
      expect(cached).not.toBeNull();
      expect(cached!.result.success).toBe(true);
    });

    it('returns null for expired keys', async () => {
      const store = new InMemoryIdempotencyStore();
      await store.set('key_ttl', { result: { success: true, intent: {} as PaymentIntent, requiresAction: false } }, -1);
      expect(await store.get('key_ttl')).toBeNull();
    });

    it('generates deterministic keys', () => {
      const store = new InMemoryIdempotencyStore();
      const key1 = store.generateKey({
        amount: 50000,
        currency: 'COP',
        methodType: 'credit_card',
        provider: 'stripe',
        userId: 'user_1',
        referenceId: 'order_1',
        referenceType: 'order',
      });
      const key2 = store.generateKey({
        amount: 50000,
        currency: 'COP',
        methodType: 'credit_card',
        provider: 'stripe',
        userId: 'user_1',
        referenceId: 'order_1',
        referenceType: 'order',
      });
      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64);
    });
  });

  describe('validatePaymentRequest', () => {
    it('returns no errors for valid request', () => {
      const valid: PaymentRequest = {
        amount: 50000,
        currency: 'COP',
        methodType: 'credit_card',
        provider: 'stripe',
        userId: 'user_1',
        referenceId: 'order_1',
        referenceType: 'order',
      };
      const errors = validatePaymentRequest(valid);
      expect(errors).toHaveLength(0);
    });

    it('reports error for zero amount', () => {
      const errors = validatePaymentRequest({
        amount: 0,
        currency: 'COP',
        methodType: 'credit_card',
        provider: 'stripe',
        userId: 'user_1',
        referenceId: 'order_1',
        referenceType: 'order',
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.toLowerCase().includes('amount'))).toBe(true);
    });

    it('reports errors for empty fields', () => {
      const errors = validatePaymentRequest({
        amount: -100,
        currency: '',
        methodType: 'credit_card',
        provider: 'stripe',
        userId: '',
        referenceId: '',
        referenceType: 'order',
      });
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});
