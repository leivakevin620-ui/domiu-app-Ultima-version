import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/supabase', () => {
  const state = { balance: 50000, isActive: true, walletId: 'wallet_1' };
  let lastInsert: Record<string, unknown> = {};

  const makeBuilder = () => {
    const b: Record<string, unknown> = {
      select: vi.fn(() => b),
      insert: vi.fn((values: unknown) => {
        lastInsert = { ...(values as Record<string, unknown>), id: 'tx_1', created_at: new Date().toISOString() };
        return b;
      }),
      update: vi.fn((values: Record<string, unknown>) => {
        if (values.balance !== undefined) state.balance = values.balance as number;
        if (values.is_active !== undefined) state.isActive = values.is_active as boolean;
        return b;
      }),
      eq: vi.fn(() => b),
      maybeSingle: vi.fn(() => ({
        data: { id: state.walletId, user_id: 'user_test', balance: state.balance, is_active: state.isActive, created_at: new Date().toISOString() },
        error: null,
      })),
      single: vi.fn(() => ({ data: { ...lastInsert }, error: null })),
      order: vi.fn(() => b),
      range: vi.fn(() => ({ data: [lastInsert], error: null })),
    };
    return b;
  };

  return {
    getBrowserClient: vi.fn(() => ({ from: vi.fn(() => makeBuilder()) })),
  };
});

import { WalletService } from '../wallet';

describe('WalletService', () => {
  let service: WalletService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WalletService();
  });

  it('returns balance for user', async () => {
    const balance = await service.getBalance('user_test');
    expect(typeof balance).toBe('number');
  });

  it('credits user wallet', async () => {
    const movement = await service.credit('user_test', 50000, 'test credit', 'ref_1', 'order');
    expect(movement).toBeDefined();
    expect(movement.amount).toBe(50000);
    expect(movement.type).toBe('credit');
  });

  it('debits user wallet', async () => {
    const movement = await service.debit('user_test', 20000, 'test debit');
    expect(movement).toBeDefined();
    expect(movement.type).toBe('debit');
  });

  it('returns movements for user', async () => {
    const movements = await service.getMovements('user_test');
    expect(Array.isArray(movements)).toBe(true);
  });

  it('checks availability', async () => {
    const available = await service.isAvailable('user_test');
    expect(typeof available).toBe('boolean');
  });
});
