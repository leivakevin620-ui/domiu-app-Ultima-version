import type { WalletMovement } from '../types';
import type { IWalletService } from '../interfaces';
import { WalletError, WalletInsufficientFundsError, PaymentNotFoundError } from '../errors';
import { getBrowserClient } from '@/lib/db/supabase';

export class WalletService implements IWalletService {
  async getBalance(userId: string): Promise<number> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new WalletError('FETCH_ERROR', `Failed to fetch wallet: ${error.message}`, 502);
    }

    if (!data) {
      throw new PaymentNotFoundError('Wallet', userId);
    }

    return data.balance;
  }

  async credit(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string,
    referenceType?: string,
  ): Promise<WalletMovement> {
    if (amount <= 0) {
      throw new WalletError('INVALID_AMOUNT', 'Credit amount must be greater than 0', 400);
    }

    const supabase = getBrowserClient();

    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('id, balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (walletError) {
      throw new WalletError('FETCH_ERROR', `Failed to fetch wallet: ${walletError.message}`, 502);
    }

    if (!wallet) {
      throw new PaymentNotFoundError('Wallet', userId);
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;

    const { data: movement, error: insertError } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        type: 'credit',
        amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: 'completed',
        description,
        reference_id: referenceId,
        reference_type: referenceType,
        metadata: {},
      })
      .select()
      .single();

    if (insertError) {
      throw new WalletError('INSERT_ERROR', `Failed to create credit movement: ${insertError.message}`, 502);
    }

    const { error: updateError } = await supabase
      .from('wallets')
      .update({ balance: balanceAfter })
      .eq('id', wallet.id);

    if (updateError) {
      throw new WalletError('UPDATE_ERROR', `Failed to update wallet balance: ${updateError.message}`, 502);
    }

    return this.mapMovement(movement, wallet.id);
  }

  async debit(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string,
    referenceType?: string,
  ): Promise<WalletMovement> {
    if (amount <= 0) {
      throw new WalletError('INVALID_AMOUNT', 'Debit amount must be greater than 0', 400);
    }

    const supabase = getBrowserClient();

    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('id, balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (walletError) {
      throw new WalletError('FETCH_ERROR', `Failed to fetch wallet: ${walletError.message}`, 502);
    }

    if (!wallet) {
      throw new PaymentNotFoundError('Wallet', userId);
    }

    if (wallet.balance < amount) {
      throw new WalletInsufficientFundsError(wallet.balance, amount);
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - amount;

    const { data: movement, error: insertError } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        type: 'debit',
        amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: 'completed',
        description,
        reference_id: referenceId,
        reference_type: referenceType,
        metadata: {},
      })
      .select()
      .single();

    if (insertError) {
      throw new WalletError('INSERT_ERROR', `Failed to create debit movement: ${insertError.message}`, 502);
    }

    const { error: updateError } = await supabase
      .from('wallets')
      .update({ balance: balanceAfter })
      .eq('id', wallet.id);

    if (updateError) {
      throw new WalletError('UPDATE_ERROR', `Failed to update wallet balance: ${updateError.message}`, 502);
    }

    return this.mapMovement(movement, wallet.id);
  }

  async getMovements(userId: string, limit = 20, offset = 0): Promise<WalletMovement[]> {
    const supabase = getBrowserClient();

    const { data: wallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!wallet) {
      return [];
    }

    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new WalletError('FETCH_ERROR', `Failed to fetch movements: ${error.message}`, 502);
    }

    return (data ?? []).map((m) => this.mapMovement(m, wallet.id));
  }

  async getMovementsCount(userId: string): Promise<number> {
    const supabase = getBrowserClient();

    const { data: wallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!wallet) {
      return 0;
    }

    const { count, error } = await supabase
      .from('wallet_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('wallet_id', wallet.id);

    if (error) {
      throw new WalletError('FETCH_ERROR', `Failed to count movements: ${error.message}`, 502);
    }

    return count ?? 0;
  }

  async isAvailable(userId: string): Promise<boolean> {
    const supabase = getBrowserClient();

    const { data, error } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      return false;
    }

    return data !== null;
  }

  private mapMovement(row: Record<string, unknown>, walletId: string): WalletMovement {
    return {
      id: row.id as string,
      walletId: (row.wallet_id as string) ?? walletId,
      type: row.type as WalletMovement['type'],
      amount: row.amount as number,
      balanceBefore: row.balance_before as number,
      balanceAfter: row.balance_after as number,
      status: row.status as WalletMovement['status'],
      referenceId: row.reference_id as string | undefined,
      referenceType: row.reference_type as string | undefined,
      description: row.description as string | undefined,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: row.created_at as string,
    };
  }
}
