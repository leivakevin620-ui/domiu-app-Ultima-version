-- ============================================
-- DOMIU MAGDALENA - SUPABASE SETUP
-- Ejecuta todo este SQL en el SQL Editor de Supabase
-- ============================================

-- Tabla de perfiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  nombre TEXT,
  rol TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de repartidores
CREATE TABLE IF NOT EXISTS repartidores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  telefono TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de locales
CREATE TABLE IF NOT EXISTS locales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  direccion TEXT,
  telefono TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  cliente TEXT NOT NULL,
  telefono TEXT,
  direccion TEXT NOT NULL,
  barrio TEXT,
  local_id UUID REFERENCES locales(id),
  repartidor_id UUID REFERENCES repartidores(id),
  km DECIMAL(5,2),
  envio INTEGER,
  precio INTEGER NOT NULL,
  pago_repartidor INTEGER,
  empresa_recibe INTEGER,
  estado TEXT DEFAULT 'Pendiente',
  liquidado BOOLEAN DEFAULT false,
  tiempo_min INTEGER,
  turno_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de turnos
CREATE TABLE IF NOT EXISTS turnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  total_turno INTEGER DEFAULT 0,
  empresa_recibe_total INTEGER DEFAULT 0,
  por_liquidar INTEGER DEFAULT 0,
  liquidado_total INTEGER DEFAULT 0,
  entregados INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de configuración
CREATE TABLE IF NOT EXISTS app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tarifa_base INTEGER DEFAULT 2500,
  costo_por_km INTEGER DEFAULT 1200,
  porcentaje_repartidor INTEGER DEFAULT 55,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla historial direcciones
CREATE TABLE IF NOT EXISTS address_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  cliente TEXT NOT NULL,
  direccion TEXT NOT NULL,
  barrio TEXT,
  km DECIMAL(5,2),
  tiempo_min INTEGER,
  envio INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE repartidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE locales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE address_history ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Own profile select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Own profile update" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Own repartidores all" ON repartidores FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own locales all" ON locales FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own pedidos all" ON pedidos FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own turnos all" ON turnos FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own config all" ON app_config FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own address all" ON address_history FOR ALL USING (auth.uid() = user_id);

-- Trigger auto-perfil
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, nombre)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'nombre');
  INSERT INTO app_config (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
