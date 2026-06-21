-- Migration: 20250614_11_rls_security_policies.sql
-- Description: Enable RLS and create security policies for all tables

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_topups ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_reactions ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
-- Users can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can read other profiles (public info)
DROP POLICY IF EXISTS "Users can read other profiles" ON profiles;
CREATE POLICY "Users can read other profiles"
  ON profiles FOR SELECT
  USING (deleted_at IS NULL);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can read all profiles
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- BUSINESSES POLICIES
-- Anyone can read active businesses
DROP POLICY IF EXISTS "Anyone can read active businesses" ON businesses;
CREATE POLICY "Anyone can read active businesses"
  ON businesses FOR SELECT
  USING (is_active = TRUE AND deleted_at IS NULL);

-- Business owners can read their own businesses
DROP POLICY IF EXISTS "Owners can read own businesses" ON businesses;
CREATE POLICY "Owners can read own businesses"
  ON businesses FOR SELECT
  USING (owner_id = auth.uid());

-- Business owners can create businesses
DROP POLICY IF EXISTS "Users can create businesses" ON businesses;
CREATE POLICY "Users can create businesses"
  ON businesses FOR INSERT
  WITH CHECK (
    owner_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('merchant', 'admin'))
  );

-- Business owners can update their own businesses
DROP POLICY IF EXISTS "Owners can update own businesses" ON businesses;
CREATE POLICY "Owners can update own businesses"
  ON businesses FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- CATEGORIES POLICIES
-- Anyone can read active categories
DROP POLICY IF EXISTS "Anyone can read active categories" ON categories;
CREATE POLICY "Anyone can read active categories"
  ON categories FOR SELECT
  USING (is_active = TRUE AND deleted_at IS NULL);

-- Business owners can read their categories
DROP POLICY IF EXISTS "Owners can read own categories" ON categories;
CREATE POLICY "Owners can read own categories"
  ON categories FOR SELECT
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- Business owners can create categories
DROP POLICY IF EXISTS "Owners can create categories" ON categories;
CREATE POLICY "Owners can create categories"
  ON categories FOR INSERT
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- PRODUCTS POLICIES
-- Anyone can read active products
DROP POLICY IF EXISTS "Anyone can read active products" ON products;
CREATE POLICY "Anyone can read active products"
  ON products FOR SELECT
  USING (status = 'available' AND deleted_at IS NULL);

-- Business owners can read their products
DROP POLICY IF EXISTS "Owners can read own products" ON products;
CREATE POLICY "Owners can read own products"
  ON products FOR SELECT
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- Business owners can create products
DROP POLICY IF EXISTS "Owners can create products" ON products;
CREATE POLICY "Owners can create products"
  ON products FOR INSERT
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- ADDRESSES POLICIES
-- Users can read their own addresses
DROP POLICY IF EXISTS "Users can read own addresses" ON addresses;
CREATE POLICY "Users can read own addresses"
  ON addresses FOR SELECT
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- Users can create addresses
DROP POLICY IF EXISTS "Users can create addresses" ON addresses;
CREATE POLICY "Users can create addresses"
  ON addresses FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own addresses
DROP POLICY IF EXISTS "Users can update own addresses" ON addresses;
CREATE POLICY "Users can update own addresses"
  ON addresses FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ORDERS POLICIES
-- Customers can read their own orders
DROP POLICY IF EXISTS "Customers can read own orders" ON orders;
CREATE POLICY "Customers can read own orders"
  ON orders FOR SELECT
  USING (customer_id = auth.uid());

-- Business owners can read orders for their businesses
DROP POLICY IF EXISTS "Owners can read own business orders" ON orders;
CREATE POLICY "Owners can read own business orders"
  ON orders FOR SELECT
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- Couriers can read their assigned orders
DROP POLICY IF EXISTS "Couriers can read assigned orders" ON orders;
CREATE POLICY "Couriers can read assigned orders"
  ON orders FOR SELECT
  USING (courier_id = auth.uid());

-- Admins can read all orders
DROP POLICY IF EXISTS "Admins can read all orders" ON orders;
CREATE POLICY "Admins can read all orders"
  ON orders FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- WALLETS POLICIES
-- Users can read their own wallet
DROP POLICY IF EXISTS "Users can read own wallet" ON wallets;
CREATE POLICY "Users can read own wallet"
  ON wallets FOR SELECT
  USING (user_id = auth.uid());

-- Only system can create/update wallets
DROP POLICY IF EXISTS "No direct wallet manipulation" ON wallets;
CREATE POLICY "No direct wallet manipulation"
  ON wallets FOR INSERT
  WITH CHECK (FALSE);

-- WALLET TRANSACTIONS POLICIES
-- Users can read their own wallet transactions
DROP POLICY IF EXISTS "Users can read own wallet transactions" ON wallet_transactions;
CREATE POLICY "Users can read own wallet transactions"
  ON wallet_transactions FOR SELECT
  USING (
    wallet_id IN (SELECT id FROM wallets WHERE user_id = auth.uid())
  );

-- CHATS POLICIES
-- Users can read chats they're part of
DROP POLICY IF EXISTS "Users can read own chats" ON chats;
CREATE POLICY "Users can read own chats"
  ON chats FOR SELECT
  USING (
    participant_1_id = auth.uid() OR participant_2_id = auth.uid()
  );

-- Users can create chats
DROP POLICY IF EXISTS "Users can create chats" ON chats;
CREATE POLICY "Users can create chats"
  ON chats FOR INSERT
  WITH CHECK (
    participant_1_id = auth.uid() OR participant_2_id = auth.uid()
  );

-- MESSAGES POLICIES
-- Users can read messages from their chats
DROP POLICY IF EXISTS "Users can read chat messages" ON messages;
CREATE POLICY "Users can read chat messages"
  ON messages FOR SELECT
  USING (
    chat_id IN (
      SELECT id FROM chats 
      WHERE participant_1_id = auth.uid() OR participant_2_id = auth.uid()
    )
  );

-- Users can create messages
DROP POLICY IF EXISTS "Users can create messages" ON messages;
CREATE POLICY "Users can create messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    chat_id IN (
      SELECT id FROM chats 
      WHERE (participant_1_id = auth.uid() OR participant_2_id = auth.uid())
    )
  );

-- NOTIFICATIONS POLICIES
-- Users can read their own notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (recipient_id = auth.uid());

-- Users can update their own notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- RATINGS POLICIES
-- Anyone can read public ratings
DROP POLICY IF EXISTS "Anyone can read public ratings" ON ratings;
CREATE POLICY "Anyone can read public ratings"
  ON ratings FOR SELECT
  USING (is_public = TRUE AND deleted_at IS NULL);

-- Users can read their own ratings
DROP POLICY IF EXISTS "Users can read own ratings" ON ratings;
CREATE POLICY "Users can read own ratings"
  ON ratings FOR SELECT
  USING (rater_id = auth.uid());

-- Users can create ratings for their orders
DROP POLICY IF EXISTS "Users can create ratings for their orders" ON ratings;
CREATE POLICY "Users can create ratings for their orders"
  ON ratings FOR INSERT
  WITH CHECK (
    rater_id = auth.uid() AND
    order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())
  );

-- DRIVERS POLICIES
-- Drivers can read their own profile
DROP POLICY IF EXISTS "Drivers can read own profile" ON drivers;
CREATE POLICY "Drivers can read own profile"
  ON drivers FOR SELECT
  USING (id = auth.uid());

-- Anyone can read verified drivers
DROP POLICY IF EXISTS "Anyone can read verified drivers" ON drivers;
CREATE POLICY "Anyone can read verified drivers"
  ON drivers FOR SELECT
  USING (is_verified = TRUE AND is_active = TRUE);

-- DRIVER LOCATIONS POLICIES
-- Drivers can create their own locations
DROP POLICY IF EXISTS "Drivers can create locations" ON driver_locations;
CREATE POLICY "Drivers can create locations"
  ON driver_locations FOR INSERT
  WITH CHECK (driver_id = auth.uid());

-- Admins can read driver locations
DROP POLICY IF EXISTS "Admins can read driver locations" ON driver_locations;
CREATE POLICY "Admins can read driver locations"
  ON driver_locations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Customers can see courier location for their orders
DROP POLICY IF EXISTS "Customers can see courier locations" ON driver_locations;
CREATE POLICY "Customers can see courier locations"
  ON driver_locations FOR SELECT
  USING (
    order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())
  );

-- Business owners can see courier locations for their orders
DROP POLICY IF EXISTS "Owners can see courier locations" ON driver_locations;
CREATE POLICY "Owners can see courier locations"
  ON driver_locations FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders 
      WHERE business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    )
  );

-- GRANT EXECUTE PERMISSIONS ON FUNCTIONS
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_order_number() TO authenticated;
GRANT EXECUTE ON FUNCTION add_wallet_transaction(UUID, transaction_type, DECIMAL, VARCHAR, VARCHAR, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_messages_as_read(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_as_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification(UUID, notification_type, VARCHAR, TEXT, UUID, VARCHAR, VARCHAR, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_business_rating(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_driver_rating(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_product_rating(UUID) TO authenticated;

-- GRANT SELECT ON VIEWS
GRANT SELECT ON unread_messages TO authenticated;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON profiles(role, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_businesses_owner_active ON businesses(owner_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_business_available ON products(business_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer_status_date ON orders(customer_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_business_status_date ON orders(business_id, status, created_at DESC) WHERE deleted_at IS NULL;
