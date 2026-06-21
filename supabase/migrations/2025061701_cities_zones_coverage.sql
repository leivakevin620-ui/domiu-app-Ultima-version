-- Migration: 20250617_cities_zones_coverage.sql
-- Description: Multi-city and zone coverage system

CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  department VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cities_slug ON cities(slug);
CREATE INDEX IF NOT EXISTS idx_cities_active ON cities(is_active);

CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  delivery_estimate VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(city_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_zones_city ON zones(city_id);
CREATE INDEX IF NOT EXISTS idx_zones_active ON zones(is_active);

CREATE TABLE IF NOT EXISTS delivery_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES cities(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES zones(id) ON DELETE CASCADE,
  base_rate DECIMAL(10,2) NOT NULL DEFAULT 2.50,
  rate_per_km DECIMAL(10,2) NOT NULL DEFAULT 0.50,
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  free_delivery_min DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_rates_city ON delivery_rates(city_id);
CREATE INDEX IF NOT EXISTS idx_delivery_rates_zone ON delivery_rates(zone_id);

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id) ON DELETE SET NULL;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES zones(id) ON DELETE SET NULL;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7);

CREATE INDEX IF NOT EXISTS idx_businesses_city ON businesses(city_id);
CREATE INDEX IF NOT EXISTS idx_businesses_zone ON businesses(zone_id);

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id) ON DELETE SET NULL;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES zones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_drivers_city ON drivers(city_id);
CREATE INDEX IF NOT EXISTS idx_drivers_zone ON drivers(zone_id);

-- Seed cities
INSERT INTO cities (name, slug, department, latitude, longitude) VALUES
  ('Santa Marta', 'santa-marta', 'Magdalena', 11.2408, -74.1990),
  ('Barranquilla', 'barranquilla', 'Atlántico', 10.9685, -74.7813),
  ('Cartagena', 'cartagena', 'Bolívar', 10.3910, -75.5144),
  ('Bogotá', 'bogota', 'Cundinamarca', 4.7110, -74.0721),
  ('Medellín', 'medellin', 'Antioquia', 6.2476, -75.5658);

-- Seed zones for Santa Marta
INSERT INTO zones (city_id, name, slug, delivery_estimate) VALUES
  ((SELECT id FROM cities WHERE slug = 'santa-marta'), 'Centro', 'centro', '20-30 min'),
  ((SELECT id FROM cities WHERE slug = 'santa-marta'), 'Rodadero', 'rodadero', '25-35 min'),
  ((SELECT id FROM cities WHERE slug = 'santa-marta'), 'Mamatoco', 'mamatoco', '30-40 min'),
  ((SELECT id FROM cities WHERE slug = 'santa-marta'), 'Bastidas', 'bastidas', '25-35 min'),
  ((SELECT id FROM cities WHERE slug = 'santa-marta'), 'Pescaíto', 'pescaito', '20-30 min');

-- Seed delivery rates for Santa Marta
INSERT INTO delivery_rates (city_id, base_rate, rate_per_km, free_delivery_min)
  SELECT id, 2.50, 0.50, 20.00 FROM cities WHERE slug = 'santa-marta';

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active cities" ON cities;
CREATE POLICY "Anyone can read active cities" ON cities FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage cities" ON cities;
CREATE POLICY "Admins manage cities" ON cities FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));
DROP POLICY IF EXISTS "Anyone can read active zones" ON zones;
CREATE POLICY "Anyone can read active zones" ON zones FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage zones" ON zones;
CREATE POLICY "Admins manage zones" ON zones FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));
DROP POLICY IF EXISTS "Anyone can read rates" ON delivery_rates;
CREATE POLICY "Anyone can read rates" ON delivery_rates FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage rates" ON delivery_rates;
CREATE POLICY "Admins manage rates" ON delivery_rates FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));