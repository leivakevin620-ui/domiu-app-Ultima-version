-- Migration: 20250617_commissions_analytics.sql
-- Description: Commission system, analytics tables, and business wallet views

CREATE TABLE IF NOT EXISTS commission_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL CHECK (type IN ('global', 'category', 'business')),
  category VARCHAR(100),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  rate DECIMAL(5,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_config_type ON commission_config(type);
CREATE INDEX IF NOT EXISTS idx_commission_config_category ON commission_config(category);
CREATE INDEX IF NOT EXISTS idx_commission_config_business ON commission_config(business_id);

CREATE TABLE IF NOT EXISTS commission_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_total DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'collected', 'cancelled')),
  collected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_tx_order ON commission_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_commission_tx_business ON commission_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_commission_tx_status ON commission_transactions(status);
CREATE INDEX IF NOT EXISTS idx_commission_tx_created ON commission_transactions(created_at DESC);

CREATE TABLE IF NOT EXISTS business_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  method VARCHAR(50) DEFAULT 'bank_transfer',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'rejected')),
  notes TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_payouts_business ON business_payouts(business_id);
CREATE INDEX IF NOT EXISTS idx_business_payouts_status ON business_payouts(status);

INSERT INTO commission_config (type, category, rate) VALUES
  ('category', 'Restaurante', 12.00),
  ('category', 'Farmacia', 10.00),
  ('category', 'Supermercado', 8.00),
  ('category', 'Licorera', 15.00),
  ('category', 'Ropa', 10.00),
  ('category', 'Electrónicos', 8.00),
  ('category', 'Mascotas', 10.00),
  ('category', 'Otros', 10.00),
  ('global', NULL, 10.00);

CREATE OR REPLACE FUNCTION calculate_commission(p_order_id UUID)
RETURNS TABLE(commission_rate DECIMAL, commission_amount DECIMAL) AS $$
DECLARE
  v_business_id UUID;
  v_category VARCHAR;
  v_rate DECIMAL;
  v_total DECIMAL;
BEGIN
  SELECT business_id, total_amount INTO v_business_id, v_total FROM orders WHERE id = p_order_id;
  SELECT cuisine_type INTO v_category FROM businesses WHERE id = v_business_id;
  SELECT rate INTO v_rate FROM commission_config
    WHERE type = 'business' AND business_id = v_business_id AND is_active = true LIMIT 1;
  IF v_rate IS NULL THEN
    SELECT rate INTO v_rate FROM commission_config
      WHERE type = 'category' AND category = v_category AND is_active = true LIMIT 1;
  END IF;
  IF v_rate IS NULL THEN
    SELECT rate INTO v_rate FROM commission_config
      WHERE type = 'global' AND is_active = true LIMIT 1;
  END IF;
  RETURN QUERY SELECT COALESCE(v_rate, 0), ROUND(COALESCE(v_total, 0) * COALESCE(v_rate, 0) / 100, 2);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_create_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_rate DECIMAL;
  v_amount DECIMAL;
BEGIN
  IF NEW.status != 'delivered' THEN RETURN NEW; END IF;
  SELECT c.commission_rate, c.commission_amount INTO v_rate, v_amount
    FROM calculate_commission(NEW.id) c;
  INSERT INTO commission_transactions (order_id, business_id, order_total, commission_rate, commission_amount)
    VALUES (NEW.id, NEW.business_id, NEW.total_amount, v_rate, v_amount);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_create_commission_trigger ON orders;
CREATE TRIGGER auto_create_commission_trigger
AFTER UPDATE OF status ON orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'delivered')
EXECUTE FUNCTION auto_create_commission();

ALTER TABLE commission_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage commission config" ON commission_config;
CREATE POLICY "Admins can manage commission config"
  ON commission_config FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage commission transactions" ON commission_transactions;
CREATE POLICY "Admins can manage commission transactions"
  ON commission_transactions FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

DROP POLICY IF EXISTS "Businesses can view own commission transactions" ON commission_transactions;
CREATE POLICY "Businesses can view own commission transactions"
  ON commission_transactions FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage payouts" ON business_payouts;
CREATE POLICY "Admins can manage payouts"
  ON business_payouts FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

DROP POLICY IF EXISTS "Businesses can view own payouts" ON business_payouts;
CREATE POLICY "Businesses can view own payouts"
  ON business_payouts FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));