-- Migration: 20250614_07_wallets_transactions.sql
-- Description: Create wallets and wallet transactions tables

CREATE TYPE transaction_type AS ENUM ('credit', 'debit', 'refund', 'bonus', 'adjustment');
CREATE TYPE wallet_transaction_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- Create wallets table
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  balance DECIMAL(12, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'COP',
  is_active BOOLEAN DEFAULT TRUE,
  total_credited DECIMAL(12, 2) DEFAULT 0,
  total_debited DECIMAL(12, 2) DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for wallets
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_is_active ON wallets(is_active);
CREATE INDEX idx_wallets_balance ON wallets(balance);

-- Create wallet_transactions table
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  transaction_type transaction_type NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  balance_before DECIMAL(12, 2),
  balance_after DECIMAL(12, 2),
  status wallet_transaction_status DEFAULT 'pending',
  reference_id VARCHAR(255), -- order_id, refund_id, etc
  reference_type VARCHAR(100), -- 'order', 'refund', 'bonus', etc
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for wallet_transactions
CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX idx_wallet_transactions_reference_id ON wallet_transactions(reference_id);
CREATE INDEX idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX idx_wallet_transactions_deleted_at ON wallet_transactions(deleted_at);

-- Create wallet top-ups table
CREATE TABLE wallet_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method payment_method NOT NULL,
  status payment_status DEFAULT 'pending',
  payment_reference VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallet_topups_wallet_id ON wallet_topups(wallet_id);
CREATE INDEX idx_wallet_topups_status ON wallet_topups(status);

-- Triggers for updated_at
CREATE TRIGGER update_wallets_updated_at
BEFORE UPDATE ON wallets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_transactions_updated_at
BEFORE UPDATE ON wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_topups_updated_at
BEFORE UPDATE ON wallet_topups
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create wallet for new user
CREATE OR REPLACE FUNCTION create_wallet_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wallets (user_id, balance)
  VALUES (NEW.id, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_wallet_on_profile_creation
AFTER INSERT ON profiles
FOR EACH ROW
WHEN (NEW.role = 'customer' OR NEW.role = 'courier')
EXECUTE FUNCTION create_wallet_for_user();

-- Function to update wallet balance atomically
CREATE OR REPLACE FUNCTION add_wallet_transaction(
  p_wallet_id UUID,
  p_transaction_type transaction_type,
  p_amount DECIMAL,
  p_reference_id VARCHAR DEFAULT NULL,
  p_reference_type VARCHAR DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS wallet_transactions AS $$
DECLARE
  v_wallet wallet_transactions;
  v_old_balance DECIMAL;
  v_new_balance DECIMAL;
  v_wallet_exists BOOLEAN;
BEGIN
  -- Lock wallet for update
  SELECT 1 INTO v_wallet_exists FROM wallets WHERE id = p_wallet_id FOR UPDATE;
  
  IF NOT v_wallet_exists THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  -- Get current balance
  SELECT balance INTO v_old_balance FROM wallets WHERE id = p_wallet_id;

  -- Calculate new balance
  IF p_transaction_type = 'debit' OR p_transaction_type = 'refund' THEN
    v_new_balance := v_old_balance - p_amount;
  ELSE -- credit or bonus or adjustment
    v_new_balance := v_old_balance + p_amount;
  END IF;

  -- Validate balance doesn't go negative for debits
  IF v_new_balance < 0 AND (p_transaction_type = 'debit' OR p_transaction_type = 'refund') THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  -- Create transaction record
  INSERT INTO wallet_transactions (
    wallet_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    status,
    reference_id,
    reference_type,
    description,
    metadata
  ) VALUES (
    p_wallet_id,
    p_transaction_type,
    p_amount,
    v_old_balance,
    v_new_balance,
    'completed',
    p_reference_id,
    p_reference_type,
    p_description,
    p_metadata
  ) RETURNING * INTO v_wallet;

  -- Update wallet balance
  UPDATE wallets
  SET 
    balance = v_new_balance,
    total_credited = CASE WHEN p_transaction_type IN ('credit', 'bonus') THEN total_credited + p_amount ELSE total_credited END,
    total_debited = CASE WHEN p_transaction_type IN ('debit', 'refund') THEN total_debited + p_amount ELSE total_debited END
  WHERE id = p_wallet_id;

  RETURN v_wallet;
END;
$$ LANGUAGE plpgsql;
