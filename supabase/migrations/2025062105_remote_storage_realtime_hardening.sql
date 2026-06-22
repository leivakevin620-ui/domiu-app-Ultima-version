-- Migration: 2025062105_remote_storage_realtime_hardening
-- Description: Final Storage policies and Realtime publication hardening.

-- ============================================================
-- Helpers
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_storage_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_business_owner(p_business_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM businesses
    WHERE id = p_business_id
      AND owner_id = auth.uid()
      AND deleted_at IS NULL
  );
$$;

-- ============================================================
-- Bucket metadata alignment
-- ============================================================

UPDATE storage.buckets
SET public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id IN ('business-logos', 'user-avatars');

UPDATE storage.buckets
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id IN ('business-banners', 'product-images', 'promotions', 'categories', 'ratings-images');

UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
WHERE id = 'chat-files';

-- ============================================================
-- Drop previous broad policies
-- ============================================================

DROP POLICY IF EXISTS "Business owners can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can upload banners" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Chat participants can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload rating images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload promotions" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload category images" ON storage.objects;
DROP POLICY IF EXISTS "Public read business logos" ON storage.objects;
DROP POLICY IF EXISTS "Public read business banners" ON storage.objects;
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
DROP POLICY IF EXISTS "Public read user avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read ratings images" ON storage.objects;
DROP POLICY IF EXISTS "Public read promotions" ON storage.objects;
DROP POLICY IF EXISTS "Public read category images" ON storage.objects;
DROP POLICY IF EXISTS "Chat participants can read files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete own storage objects" ON storage.objects;
DROP POLICY IF EXISTS "Public read public storage buckets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read private chat files" ON storage.objects;
DROP POLICY IF EXISTS "Owners upload business media" ON storage.objects;
DROP POLICY IF EXISTS "Owners upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins upload promotions and categories" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload chat files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload rating images" ON storage.objects;
DROP POLICY IF EXISTS "Owners update own storage objects" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete own storage objects" ON storage.objects;

-- ============================================================
-- Public read policies
-- ============================================================

CREATE POLICY "Public read public storage buckets"
  ON storage.objects FOR SELECT
  USING (
    bucket_id IN (
      'business-logos',
      'business-banners',
      'product-images',
      'promotions',
      'categories',
      'user-avatars',
      'ratings-images'
    )
  );

CREATE POLICY "Authenticated read private chat files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'chat-files'
    AND auth.role() = 'authenticated'
  );

-- ============================================================
-- Controlled upload policies
-- ============================================================

CREATE POLICY "Owners upload business media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id IN ('business-logos', 'business-banners')
    AND auth.role() = 'authenticated'
    AND (
      public.is_storage_admin()
      OR owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR (
        array_length(storage.foldername(name), 1) >= 1
        AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.is_business_owner(((storage.foldername(name))[1])::uuid)
      )
    )
  );

CREATE POLICY "Owners upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
    AND (
      public.is_storage_admin()
      OR owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR (
        array_length(storage.foldername(name), 1) >= 1
        AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.is_business_owner(((storage.foldername(name))[1])::uuid)
      )
    )
  );

CREATE POLICY "Admins upload promotions and categories"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id IN ('promotions', 'categories')
    AND public.is_storage_admin()
  );

CREATE POLICY "Users upload own avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND auth.role() = 'authenticated'
    AND (
      public.is_storage_admin()
      OR owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

CREATE POLICY "Authenticated upload chat files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-files'
    AND auth.role() = 'authenticated'
    AND (
      public.is_storage_admin()
      OR owner = auth.uid()
    )
  );

CREATE POLICY "Authenticated upload rating images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ratings-images'
    AND auth.role() = 'authenticated'
    AND (
      public.is_storage_admin()
      OR owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- ============================================================
-- Update and delete policies
-- ============================================================

CREATE POLICY "Owners update own storage objects"
  ON storage.objects FOR UPDATE
  USING (
    public.is_storage_admin()
    OR owner = auth.uid()
  )
  WITH CHECK (
    public.is_storage_admin()
    OR owner = auth.uid()
  );

CREATE POLICY "Owners delete own storage objects"
  ON storage.objects FOR DELETE
  USING (
    public.is_storage_admin()
    OR owner = auth.uid()
  );

-- ============================================================
-- Realtime publication
-- ============================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
