-- Migration: 20250614_06_drivers_locations.sql
-- Description: Create drivers and driver real-time locations tables

CREATE TYPE driver_status AS ENUM ('available', 'busy', 'offline', 'on_break');
CREATE TYPE vehicle_type AS ENUM ('bike', 'motorcycle', 'car', 'van');

-- Create drivers table (extends profiles for couriers)
CREATE TABLE drivers (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  license_number VARCHAR(100) UNIQUE NOT NULL,
  license_expiry DATE,
  vehicle_type vehicle_type DEFAULT 'bike',
  vehicle_plate VARCHAR(50) UNIQUE,
  vehicle_model VARCHAR(100),
  status driver_status DEFAULT 'offline',
  is_verified BOOLEAN DEFAULT FALSE,
  total_deliveries INT DEFAULT 0,
  completed_deliveries INT DEFAULT 0,
  rating DECIMAL(2, 1) DEFAULT 0,
  total_ratings INT DEFAULT 0,
  avg_rating DECIMAL(3, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  bank_account JSONB, -- {account_number, bank_name, account_holder}
  metadata JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for drivers
CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_drivers_is_verified ON drivers(is_verified);
CREATE INDEX idx_drivers_is_active ON drivers(is_active);
CREATE INDEX idx_drivers_rating ON drivers(rating DESC);
CREATE INDEX idx_drivers_deleted_at ON drivers(deleted_at);

-- Real-time driver locations table
CREATE TABLE driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  accuracy DECIMAL(5, 2), -- meters
  speed DECIMAL(5, 2), -- km/h
  heading DECIMAL(5, 2), -- degrees
  altitude DECIMAL(8, 2),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for driver_locations
CREATE INDEX idx_driver_locations_driver_id ON driver_locations(driver_id);
CREATE INDEX idx_driver_locations_order_id ON driver_locations(order_id);
CREATE INDEX idx_driver_locations_created_at ON driver_locations(created_at DESC);
CREATE INDEX idx_driver_locations_location ON driver_locations USING GIST(location);

-- Trigger to update location column
CREATE TRIGGER update_driver_location_trigger
BEFORE INSERT ON driver_locations
FOR EACH ROW
EXECUTE FUNCTION update_address_location();

-- Keep only last 1000 locations per driver for performance
CREATE OR REPLACE FUNCTION cleanup_old_driver_locations()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM driver_locations
  WHERE driver_id = NEW.driver_id
  AND id NOT IN (
    SELECT id FROM driver_locations
    WHERE driver_id = NEW.driver_id
    ORDER BY created_at DESC
    LIMIT 1000
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cleanup_driver_locations_trigger
AFTER INSERT ON driver_locations
FOR EACH ROW
EXECUTE FUNCTION cleanup_old_driver_locations();

-- Driver availability table
CREATE TABLE driver_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL, -- 0=Sunday, 6=Saturday
  starts_at TIME,
  ends_at TIME,
  is_working BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(driver_id, day_of_week)
);

CREATE INDEX idx_driver_availability_driver_id ON driver_availability(driver_id);

-- Driver earnings table
CREATE TABLE driver_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  base_amount DECIMAL(10, 2),
  bonus_amount DECIMAL(10, 2) DEFAULT 0,
  penalty_amount DECIMAL(10, 2) DEFAULT 0,
  total_earned DECIMAL(10, 2),
  status VARCHAR(50) DEFAULT 'completed', -- pending, completed, paid
  paid_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_driver_earnings_driver_id ON driver_earnings(driver_id);
CREATE INDEX idx_driver_earnings_order_id ON driver_earnings(order_id);
CREATE INDEX idx_driver_earnings_status ON driver_earnings(status);

-- Triggers for updated_at
CREATE TRIGGER update_drivers_updated_at
BEFORE UPDATE ON drivers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_availability_updated_at
BEFORE UPDATE ON driver_availability
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_earnings_updated_at
BEFORE UPDATE ON driver_earnings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
