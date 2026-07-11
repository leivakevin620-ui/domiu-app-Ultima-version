-- Migration: 2026071001_multitenancy_foundation
-- Purpose: introduce a backward-compatible multi-tenant foundation.
-- Safety: does not replace existing RLS policies and does not enforce NOT NULL
-- on legacy operational tables during this first rollout phase.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Core tenant entities
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  legal_name text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'suspended', 'archived')),
  country_code char(2) NOT NULL DEFAULT 'CO',
  currency_code char(3) NOT NULL DEFAULT 'COP',
  timezone text NOT NULL DEFAULT 'America/Bogota',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN (
      'owner',
      'super_admin',
      'admin',
      'operations',
      'support',
      'finance',
      'business_owner',
      'business_staff',
      'courier',
      'customer',
      'member'
    )),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('invited', 'active', 'suspended', 'revoked')),
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  department text,
  country_code char(2) NOT NULL DEFAULT 'CO',
  timezone text NOT NULL DEFAULT 'America/Bogota',
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('planned', 'active', 'paused', 'archived')),
  center_latitude numeric(10,7),
  center_longitude numeric(10,7),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name, department)
);

CREATE TABLE IF NOT EXISTS public.zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  color text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  boundary jsonb,
  base_delivery_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (base_delivery_fee >= 0),
  included_distance_km numeric(8,2) NOT NULL DEFAULT 0 CHECK (included_distance_km >= 0),
  extra_km_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (extra_km_fee >= 0),
  minimum_delivery_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (minimum_delivery_fee >= 0),
  maximum_delivery_fee numeric(12,2) CHECK (maximum_delivery_fee IS NULL OR maximum_delivery_fee >= 0),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, city_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user
  ON public.tenant_memberships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant
  ON public.tenant_memberships(tenant_id, role, status);
CREATE INDEX IF NOT EXISTS idx_cities_tenant
  ON public.cities(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_zones_tenant_city
  ON public.zones(tenant_id, city_id, status);

-- ============================================================
-- Timestamp helper
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_tenants_updated_at ON public.tenants;
CREATE TRIGGER set_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_tenant_memberships_updated_at ON public.tenant_memberships;
CREATE TRIGGER set_tenant_memberships_updated_at
BEFORE UPDATE ON public.tenant_memberships
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_cities_updated_at ON public.cities;
CREATE TRIGGER set_cities_updated_at
BEFORE UPDATE ON public.cities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_zones_updated_at ON public.zones;
CREATE TRIGGER set_zones_updated_at
BEFORE UPDATE ON public.zones
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Default tenant and initial city
-- ============================================================

INSERT INTO public.tenants (
  slug,
  name,
  legal_name,
  country_code,
  currency_code,
  timezone,
  settings
)
VALUES (
  'domiu-magdalena',
  'DomiU Magdalena',
  'DomiU Magdalena',
  'CO',
  'COP',
  'America/Bogota',
  jsonb_build_object(
    'single_business_cart', true,
    'multitenancy_version', 1,
    'delivery_pricing_model', 'hybrid'
  )
)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    country_code = EXCLUDED.country_code,
    currency_code = EXCLUDED.currency_code,
    timezone = EXCLUDED.timezone,
    updated_at = now();

INSERT INTO public.cities (
  tenant_id,
  name,
  department,
  country_code,
  timezone,
  status
)
SELECT
  id,
  'Ciénaga',
  'Magdalena',
  'CO',
  'America/Bogota',
  'active'
FROM public.tenants
WHERE slug = 'domiu-magdalena'
ON CONFLICT (tenant_id, name, department) DO NOTHING;

-- ============================================================
-- Tenant authorization helpers
-- ============================================================

CREATE OR REPLACE FUNCTION public.default_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.tenants
  WHERE slug = 'domiu-magdalena'
    AND status IN ('active', 'paused')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships tm
    WHERE tm.tenant_id = p_tenant_id
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(
  p_tenant_id uuid,
  p_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships tm
    WHERE tm.tenant_id = p_tenant_id
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
      AND tm.role = ANY (p_roles)
  );
$$;

REVOKE ALL ON FUNCTION public.default_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_tenant_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_tenant_role(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.default_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, text[]) TO authenticated, service_role;

-- ============================================================
-- Backward-compatible tenant_id propagation
-- Adds tenant_id only to tables that exist in the current schema.
-- ============================================================

DO $$
DECLARE
  target_table text;
  target_tables text[] := ARRAY[
    'profiles',
    'businesses',
    'business_hours',
    'categories',
    'products',
    'product_options',
    'addresses',
    'favorites',
    'carts',
    'cart_items',
    'orders',
    'order_items',
    'order_events',
    'assignments',
    'drivers',
    'couriers',
    'driver_locations',
    'courier_locations',
    'notifications',
    'chats',
    'messages',
    'wallets',
    'wallet_transactions',
    'promotions',
    'coupons',
    'ratings',
    'support_tickets',
    'audit_logs'
  ];
  tenant_uuid uuid;
BEGIN
  tenant_uuid := public.default_tenant_id();

  IF tenant_uuid IS NULL THEN
    RAISE EXCEPTION 'Default tenant domiu-magdalena was not created';
  END IF;

  FOREACH target_table IN ARRAY target_tables
  LOOP
    IF to_regclass(format('public.%I', target_table)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid',
        target_table
      );

      EXECUTE format(
        'UPDATE public.%I SET tenant_id = $1 WHERE tenant_id IS NULL',
        target_table
      ) USING tenant_uuid;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = format('%s_tenant_id_fkey', target_table)
          AND conrelid = format('public.%I', target_table)::regclass
      ) THEN
        EXECUTE format(
          'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT NOT VALID',
          target_table,
          format('%s_tenant_id_fkey', target_table)
        );
      END IF;

      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id)',
        format('idx_%s_tenant_id', target_table),
        target_table
      );
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- Seed memberships for existing authenticated profiles.
-- This preserves current access while the application is adapted.
-- ============================================================

DO $$
DECLARE
  tenant_uuid uuid;
BEGIN
  tenant_uuid := public.default_tenant_id();

  IF to_regclass('public.profiles') IS NOT NULL THEN
    INSERT INTO public.tenant_memberships (
      tenant_id,
      user_id,
      role,
      status,
      joined_at
    )
    SELECT
      tenant_uuid,
      p.id,
      CASE
        WHEN lower(coalesce(p.role::text, '')) = 'admin' THEN 'admin'
        WHEN lower(coalesce(p.role::text, '')) IN ('business', 'business_owner', 'owner') THEN 'business_owner'
        WHEN lower(coalesce(p.role::text, '')) IN ('courier', 'driver', 'repartidor') THEN 'courier'
        WHEN lower(coalesce(p.role::text, '')) IN ('client', 'customer', 'cliente') THEN 'customer'
        ELSE 'member'
      END,
      'active',
      now()
    FROM public.profiles p
    INNER JOIN auth.users u ON u.id = p.id
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
  END IF;
END;
$$;

-- ============================================================
-- RLS only for new foundation tables.
-- Existing table policies are deliberately untouched in Phase 1.
-- ============================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read active tenants" ON public.tenants;
CREATE POLICY "Authenticated can read active tenants"
ON public.tenants FOR SELECT
TO authenticated
USING (
  status IN ('active', 'paused')
  AND (
    public.is_tenant_member(id)
    OR id = public.default_tenant_id()
  )
);

DROP POLICY IF EXISTS "Users can read own tenant memberships" ON public.tenant_memberships;
CREATE POLICY "Users can read own tenant memberships"
ON public.tenant_memberships FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_tenant_role(
    tenant_id,
    ARRAY['owner', 'super_admin', 'admin', 'operations', 'support']::text[]
  )
);

DROP POLICY IF EXISTS "Tenant admins manage memberships" ON public.tenant_memberships;
CREATE POLICY "Tenant admins manage memberships"
ON public.tenant_memberships FOR ALL
TO authenticated
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['owner', 'super_admin', 'admin']::text[]
  )
)
WITH CHECK (
  public.has_tenant_role(
    tenant_id,
    ARRAY['owner', 'super_admin', 'admin']::text[]
  )
);

DROP POLICY IF EXISTS "Tenant members read cities" ON public.cities;
CREATE POLICY "Tenant members read cities"
ON public.cities FOR SELECT
TO authenticated
USING (
  public.is_tenant_member(tenant_id)
  OR tenant_id = public.default_tenant_id()
);

DROP POLICY IF EXISTS "Tenant admins manage cities" ON public.cities;
CREATE POLICY "Tenant admins manage cities"
ON public.cities FOR ALL
TO authenticated
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['owner', 'super_admin', 'admin', 'operations']::text[]
  )
)
WITH CHECK (
  public.has_tenant_role(
    tenant_id,
    ARRAY['owner', 'super_admin', 'admin', 'operations']::text[]
  )
);

DROP POLICY IF EXISTS "Tenant members read zones" ON public.zones;
CREATE POLICY "Tenant members read zones"
ON public.zones FOR SELECT
TO authenticated
USING (
  public.is_tenant_member(tenant_id)
  OR tenant_id = public.default_tenant_id()
);

DROP POLICY IF EXISTS "Tenant admins manage zones" ON public.zones;
CREATE POLICY "Tenant admins manage zones"
ON public.zones FOR ALL
TO authenticated
USING (
  public.has_tenant_role(
    tenant_id,
    ARRAY['owner', 'super_admin', 'admin', 'operations']::text[]
  )
)
WITH CHECK (
  public.has_tenant_role(
    tenant_id,
    ARRAY['owner', 'super_admin', 'admin', 'operations']::text[]
  )
);

COMMIT;
