-- ============================================
-- DOMIU MAGDALENA - SETUP COMPLETO
-- Ejecuta TODO en SQL Editor de Supabase
-- ============================================

-- 1. TABLAS
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  nombre TEXT,
  rol TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repartidores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  telefono TEXT,
  documento TEXT,
  vehiculo TEXT,
  placa TEXT,
  estado TEXT DEFAULT 'No disponible',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  direccion TEXT,
  telefono TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
  metodo_pago TEXT DEFAULT 'Efectivo',
  tiempo_min INTEGER,
  turno_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tarifa_base INTEGER DEFAULT 2500,
  costo_por_km INTEGER DEFAULT 1200,
  porcentaje_repartidor INTEGER DEFAULT 55,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- 2. RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE repartidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE locales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE address_history ENABLE ROW LEVEL SECURITY;

-- 3. LIMPIAR POLITICAS VIEJAS
DROP POLICY IF EXISTS "Own profile select" ON profiles;
DROP POLICY IF EXISTS "Own profile update" ON profiles;
DROP POLICY IF EXISTS "Own repartidores all" ON repartidores;
DROP POLICY IF EXISTS "Own locales all" ON locales;
DROP POLICY IF EXISTS "Own pedidos all" ON pedidos;
DROP POLICY IF EXISTS "Own turnos all" ON turnos;
DROP POLICY IF EXISTS "Own config all" ON app_config;
DROP POLICY IF EXISTS "Own address all" ON address_history;

-- 4. POLITICAS CORRECTAS
-- Profiles: todos pueden ver, cada uno actualiza el suyo
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Repartidores: admin ve todos, rider ve el suyo
CREATE POLICY "repartidores_select_all" ON repartidores FOR SELECT USING (true);
CREATE POLICY "repartidores_insert_admin" ON repartidores FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin')
);
CREATE POLICY "repartidores_update_admin" ON repartidores FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'operador'))
);
CREATE POLICY "repartidores_update_own" ON repartidores FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "repartidores_insert_own" ON repartidores FOR INSERT WITH CHECK (true);

-- Locales: admin CRUD
CREATE POLICY "locales_select_all" ON locales FOR SELECT USING (true);
CREATE POLICY "locales_admin_all" ON locales FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'operador'))
);

-- Pedidos: admin ve todos, rider ve los asignados
CREATE POLICY "pedidos_select_admin" ON pedidos FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'operador'))
);
CREATE POLICY "pedidos_select_rider" ON pedidos FOR SELECT USING (
  repartidor_id IN (SELECT id FROM repartidores WHERE user_id = auth.uid())
);
CREATE POLICY "pedidos_admin_all" ON pedidos FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'operador'))
);
CREATE POLICY "pedidos_rider_update" ON pedidos FOR UPDATE USING (
  repartidor_id IN (SELECT id FROM repartidores WHERE user_id = auth.uid())
) WITH CHECK (
  repartidor_id IN (SELECT id FROM repartidores WHERE user_id = auth.uid())
);

-- Turnos: admin CRUD, rider ve
CREATE POLICY "turnos_select_all" ON turnos FOR SELECT USING (true);
CREATE POLICY "turnos_admin_all" ON turnos FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'operador'))
);

-- Config: solo admin
CREATE POLICY "config_admin_all" ON app_config FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'operador'))
);

-- Address: cada uno ve el suyo
CREATE POLICY "address_select_own" ON address_history FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "address_insert_own" ON address_history FOR INSERT WITH CHECK (user_id = auth.uid());

-- 5. TRIGGER CORREGIDO
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role text;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'admin');

  INSERT INTO public.profiles (id, email, nombre, rol)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nombre', 'Usuario'), user_role);

  INSERT INTO public.app_config (user_id) VALUES (NEW.id);

  IF user_role = 'repartidor' THEN
    INSERT INTO public.repartidores (user_id, nombre, telefono, documento, vehiculo, placa, estado)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'nombre', 'Repartidor'),
      COALESCE(NEW.raw_user_meta_data->>'telefono', ''),
      COALESCE(NEW.raw_user_meta_data->>'documento', ''),
      COALESCE(NEW.raw_user_meta_data->>'vehiculo', ''),
      COALESCE(NEW.raw_user_meta_data->>'placa', ''),
      'No disponible'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. FORZAR ADMIN PRINCIPAL
UPDATE profiles SET rol = 'admin' WHERE email = 'leivakevin620@gmail.com';
