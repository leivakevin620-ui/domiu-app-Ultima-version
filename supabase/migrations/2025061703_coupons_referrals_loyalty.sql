-- Migration: 20250617_coupons_referrals_loyalty.sql
-- Description: Coupon system, referral program, and loyalty points

CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed', 'free_shipping')),
  value DECIMAL(10,2) NOT NULL,
  max_discount DECIMAL(10,2),
  min_amount DECIMAL(10,2) DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  usage_limit INTEGER DEFAULT NULL,
  per_user_limit INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_expires ON coupons(expires_at);

CREATE TABLE IF NOT EXISTS coupon_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  discount_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon ON coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user ON coupon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_order ON coupon_usage(order_id);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL UNIQUE,
  referred_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'expired')),
  reward_given BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  converted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);

CREATE TABLE IF NOT EXISTS loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason VARCHAR(100) NOT NULL,
  reference_id VARCHAR(100),
  reference_type VARCHAR(50),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_user ON loyalty_points(user_id);

CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  points_required INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('free_shipping', 'discount', 'product')),
  value DECIMAL(10,2),
  stock INTEGER DEFAULT NULL,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rewards_active ON rewards(is_active);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points_spent INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user ON reward_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_reward ON reward_redemptions(reward_id);

-- Auto-create referral code on profile creation
CREATE OR REPLACE FUNCTION auto_create_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  v_code VARCHAR(20);
  v_prefix VARCHAR(4);
BEGIN
  v_prefix := UPPER(COALESCE(LEFT(NEW.first_name, 2), 'U') || COALESCE(LEFT(NEW.last_name, 2), 'R'));
  v_code := v_prefix || UPPER(SUBSTRING(MD5(NEW.id::TEXT) FROM 1 FOR 4));
  INSERT INTO referrals (referrer_id, code) VALUES (NEW.id, v_code);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_create_referral_code_trigger ON profiles;
CREATE TRIGGER auto_create_referral_code_trigger
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION auto_create_referral_code();

-- Default rewards
INSERT INTO rewards (title, description, points_required, type, value) VALUES
  ('Envío Gratis', 'Obtén envío gratis en tu próximo pedido', 50, 'free_shipping', NULL),
  ('$5 de Descuento', 'Descuento de $5 en tu próximo pedido', 100, 'discount', 5.00),
  ('$10 de Descuento', 'Descuento de $10 en tu próximo pedido', 180, 'discount', 10.00),
  ('$20 de Descuento', 'Descuento de $20 en tu próximo pedido', 320, 'discount', 20.00);

-- Default coupons
INSERT INTO coupons (code, type, value, max_discount, min_amount, description) VALUES
  ('BIENVENIDO10', 'percentage', 10.00, 5.00, 10.00, '10% de descuento en tu primer pedido (máx $5)'),
  ('ENVIOGRATIS', 'free_shipping', 0, NULL, 15.00, 'Envío gratis en pedidos mayores a $15'),
  ('DOMIU20', 'percentage', 20.00, 8.00, 20.00, '20% de descuento (máx $8)');

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage coupons" ON coupons;
CREATE POLICY "Admins manage coupons" ON coupons FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));
DROP POLICY IF EXISTS "Anyone can read active coupons" ON coupons;
CREATE POLICY "Anyone can read active coupons" ON coupons FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage coupon usage" ON coupon_usage;
CREATE POLICY "Admins manage coupon usage" ON coupon_usage FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));
DROP POLICY IF EXISTS "Users read own usage" ON coupon_usage;
CREATE POLICY "Users read own usage" ON coupon_usage FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users read own referrals" ON referrals;
CREATE POLICY "Users read own referrals" ON referrals FOR SELECT USING (referrer_id = auth.uid() OR referred_id = auth.uid());
DROP POLICY IF EXISTS "Users read own points" ON loyalty_points;
CREATE POLICY "Users read own points" ON loyalty_points FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins manage points" ON loyalty_points;
CREATE POLICY "Admins manage points" ON loyalty_points FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));
DROP POLICY IF EXISTS "Anyone can read active rewards" ON rewards;
CREATE POLICY "Anyone can read active rewards" ON rewards FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage rewards" ON rewards;
CREATE POLICY "Admins manage rewards" ON rewards FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));
DROP POLICY IF EXISTS "Users read own redemptions" ON reward_redemptions;
CREATE POLICY "Users read own redemptions" ON reward_redemptions FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins manage redemptions" ON reward_redemptions;
CREATE POLICY "Admins manage redemptions" ON reward_redemptions FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));