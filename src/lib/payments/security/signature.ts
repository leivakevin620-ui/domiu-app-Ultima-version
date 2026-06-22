import { createHmac, randomBytes } from 'node:crypto';

export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = signPayload(payload, secret);
  return expected.length === signature.length && timingSafeEqual(expected, signature);
}

export function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
