-- Migration: 20250614_04_addresses.sql
-- Description: Create addresses table with geolocation support

CREATE EXTENSION IF NOT EXISTS "postgis";

DO $$ BEGIN CREATE TYPE address_type AS ENUM ('home', 'work', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create addresses table
CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type address_type DEFAULT 'home',
  label VARCHAR(100),
  street_address VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state_province VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) NOT NULL DEFAULT 'Colombia',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location GEOGRAPHY(POINT, 4326), -- For PostGIS queries
  is_primary BOOLEAN DEFAULT FALSE,
  instructions TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for addresses
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_type ON addresses(type);
CREATE INDEX IF NOT EXISTS idx_addresses_is_primary ON addresses(is_primary);
CREATE INDEX IF NOT EXISTS idx_addresses_deleted_at ON addresses(deleted_at);
CREATE INDEX IF NOT EXISTS idx_addresses_location ON addresses USING GIST(location);

-- Function to update location column from lat/lng
CREATE OR REPLACE FUNCTION update_address_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_address_location_trigger ON addresses;
CREATE TRIGGER update_address_location_trigger
BEFORE INSERT OR UPDATE ON addresses
FOR EACH ROW
EXECUTE FUNCTION update_address_location();

DROP TRIGGER IF EXISTS update_addresses_updated_at ON addresses;
CREATE TRIGGER update_addresses_updated_at
BEFORE UPDATE ON addresses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Business addresses table
CREATE TABLE IF NOT EXISTS business_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  street_address VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state_province VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) NOT NULL DEFAULT 'Colombia',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location GEOGRAPHY(POINT, 4326),
  phone VARCHAR(20),
  is_primary BOOLEAN DEFAULT FALSE,
  delivery_available BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_business_addresses_business_id ON business_addresses(business_id);
CREATE INDEX IF NOT EXISTS idx_business_addresses_location ON business_addresses USING GIST(location);

DROP TRIGGER IF EXISTS update_business_location_trigger ON business_addresses;
CREATE TRIGGER update_business_location_trigger
BEFORE INSERT OR UPDATE ON business_addresses
FOR EACH ROW
EXECUTE FUNCTION update_address_location();

DROP TRIGGER IF EXISTS update_business_addresses_updated_at ON business_addresses;
CREATE TRIGGER update_business_addresses_updated_at
BEFORE UPDATE ON business_addresses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();