-- Migration: 2025062601_courier_profile_enhancements.sql
-- Description: Add courier profile columns, bucket creation, and RLS policies for 1.5 profile redesign

-- 1. Add missing is_available column to drivers
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT FALSE;

-- 2. Create courier_documents storage bucket for document uploads
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('courier-documents', 'courier-documents', false, false, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- 3. Create courier_incidents table for structured incident reporting
CREATE TABLE IF NOT EXISTS courier_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  incident_type VARCHAR(50) NOT NULL CHECK (incident_type IN ('accident', 'traffic_violation', 'customer_complaint', 'order_issue', 'vehicle_issue', 'other')),
  description TEXT,
  severity VARCHAR(20) NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor', 'moderate', 'severe', 'critical')),
  location JSONB,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_courier_incidents_driver_id ON courier_incidents(driver_id);
CREATE INDEX IF NOT EXISTS idx_courier_incidents_type ON courier_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_courier_incidents_severity ON courier_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_courier_incidents_created_at ON courier_incidents(created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_courier_incidents_updated_at'
  ) THEN
    CREATE TRIGGER update_courier_incidents_updated_at
    BEFORE UPDATE ON courier_incidents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

-- 4. RLS policies for courier_incidents
ALTER TABLE courier_incidents ENABLE ROW LEVEL SECURITY;

-- Couriers can read their own incidents
CREATE POLICY "couriers_read_own_incidents" ON courier_incidents
  FOR SELECT
  USING (driver_id = auth.uid());

-- Couriers can insert their own incidents
CREATE POLICY "couriers_insert_own_incidents" ON courier_incidents
  FOR INSERT
  WITH CHECK (driver_id = auth.uid());

-- Admin can read all incidents
CREATE POLICY "admins_read_all_incidents" ON courier_incidents
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ));

-- Admin can update incidents (resolve them)
CREATE POLICY "admins_update_incidents" ON courier_incidents
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ));

-- 5. RLS policies for drivers table (courier can read/update own)
DROP POLICY IF EXISTS "couriers_read_own_driver" ON drivers;
CREATE POLICY "couriers_read_own_driver" ON drivers
  FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "couriers_update_own_driver" ON drivers;
CREATE POLICY "couriers_update_own_driver" ON drivers
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admin can read all drivers
DROP POLICY IF EXISTS "admins_read_all_drivers" ON drivers;
CREATE POLICY "admins_read_all_drivers" ON drivers
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ));

-- 6. RLS policy for courier-documents bucket
-- Authenticated users can upload their own documents
CREATE POLICY "couriers_upload_own_documents" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'courier-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Couriers can read their own documents
CREATE POLICY "couriers_read_own_documents" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'courier-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admin can read all courier documents
CREATE POLICY "admins_read_all_courier_documents" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'courier-documents'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 7. Update existing drivers: set is_available based on status
UPDATE drivers SET is_available = (status = 'available') WHERE is_available IS NULL;
