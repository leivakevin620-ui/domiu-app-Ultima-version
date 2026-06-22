import type { PaymentRequest } from '../types';

const SENSITIVE_FIELDS = new Set(['password', 'secret', 'token', 'apiKey', 'api_key', 'cardNumber', 'cvc', 'cvv', 'expiryDate']);

const VALID_CURRENCIES = new Set(['COP', 'USD', 'EUR', 'MXN', 'BRL', 'ARS', 'CLP', 'PEN']);

const VALID_PROVIDERS = new Set(['stripe', 'mercadopago', 'wompi', 'payu', 'nequi', 'daviplata', 'pse', 'wallet_domiu']);

export function validatePaymentRequest(request: PaymentRequest): string[] {
  const errors: string[] = [];

  const amountError = validateAmount(request.amount);
  if (amountError) errors.push(amountError);

  const currencyError = validateCurrency(request.currency);
  if (currencyError) errors.push(currencyError);

  const providerError = validateProvider(request.provider);
  if (providerError) errors.push(providerError);

  if (!request.userId) {
    errors.push('userId is required');
  }

  if (!request.referenceId) {
    errors.push('referenceId is required');
  }

  if (!request.referenceType) {
    errors.push('referenceType is required');
  }

  return errors;
}

export function validateAmount(amount: number): string | null {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return 'amount must be a valid number';
  }
  if (amount <= 0) {
    return 'amount must be greater than 0';
  }
  if (!Number.isFinite(amount)) {
    return 'amount must be a finite number';
  }
  return null;
}

export function validateCurrency(currency: string): string | null {
  if (!currency) {
    return 'currency is required';
  }
  if (!VALID_CURRENCIES.has(currency)) {
    return `currency must be one of: ${Array.from(VALID_CURRENCIES).join(', ')}`;
  }
  return null;
}

export function validateProvider(provider: string): string | null {
  if (!provider) {
    return 'provider is required';
  }
  if (!VALID_PROVIDERS.has(provider)) {
    return `provider must be one of: ${Array.from(VALID_PROVIDERS).join(', ')}`;
  }
  return null;
}

export function validateEmail(email: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!SENSITIVE_FIELDS.has(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
