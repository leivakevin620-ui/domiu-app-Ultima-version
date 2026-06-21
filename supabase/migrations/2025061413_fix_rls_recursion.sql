-- Migration: 20250614_12_fix_rls_recursion.sql
-- Description: Fix infinite recursion in profiles RLS policy

-- Drop problematic policies that cause recursion
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can read all orders" ON orders;
DROP POLICY IF EXISTS "Admins can read driver locations" ON driver_locations;

-- Create a SECURITY DEFINER function in public schema to bypass RLS for admin check
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- Re-create policies using the SECURITY DEFINER function (no recursion)
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can read all orders"
  ON orders FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can read driver locations"
  ON driver_locations FOR SELECT
  USING (public.is_admin());