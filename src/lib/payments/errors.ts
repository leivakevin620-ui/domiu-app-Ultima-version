export class PaymentError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: string, message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class PaymentProviderError extends PaymentError {
  constructor(provider: string, message: string, statusCode = 502, details?: unknown) {
    super(`PROVIDER_ERROR:${provider}`, `[${provider}] ${message}`, statusCode, details);
    this.name = 'PaymentProviderError';
  }
}

export class PaymentValidationError extends PaymentError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'PaymentValidationError';
  }
}

export class PaymentNotFoundError extends PaymentError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} with id '${id}' not found`, 404);
    this.name = 'PaymentNotFoundError';
  }
}

export class PaymentConflictError extends PaymentError {
  constructor(message: string, details?: unknown) {
    super('CONFLICT', message, 409, details);
    this.name = 'PaymentConflictError';
  }
}

export class PaymentIdempotencyError extends PaymentError {
  constructor(key: string) {
    super('IDEMPOTENCY', `Duplicate request detected (key: ${key})`, 409);
    this.name = 'PaymentIdempotencyError';
  }
}

export class PaymentSignatureError extends PaymentError {
  constructor() {
    super('SIGNATURE_MISMATCH', 'Webhook signature verification failed', 401);
    this.name = 'PaymentSignatureError';
  }
}

export class WalletError extends PaymentError {
  constructor(code: string, message: string, statusCode = 400, details?: unknown) {
    super(`WALLET:${code}`, message, statusCode, details);
    this.name = 'WalletError';
  }
}

export class WalletInsufficientFundsError extends WalletError {
  constructor(balance: number, required: number) {
    super('INSUFFICIENT_FUNDS', `Insufficient funds. Balance: ${balance}, required: ${required}`, 400, { balance, required });
    this.name = 'WalletInsufficientFundsError';
  }
}

export class ProviderNotAvailableError extends PaymentError {
  constructor(provider: string) {
    super('PROVIDER_UNAVAILABLE', `Payment provider '${provider}' is not available`, 503);
    this.name = 'ProviderNotAvailableError';
  }
}
