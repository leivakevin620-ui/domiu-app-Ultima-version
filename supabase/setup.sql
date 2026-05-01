-- ============================================
-- DOMIU MAGDALENA - SUPABASE SETUP (COMPLETO)
-- Ejecuta todo este SQL en el SQL Editor de Supabase
-- ============================================

-- Tabla de perfiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  nombre TEXT,
  telefono TEXT,
  rol TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de repartidores (CON TODAS LAS COLUMNAS)
CREATE TABLE IF NOT EXISTS repartidores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  telefono TEXT,
  estado TEXT DEFAULT 'No disponible',
  vehiculo TEXT,
  placa TEXT,
  documento TEXT,
  foto_url TEXT,
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
  turno_id UUID REFERENCES turnos(id),
  codigo TEXT NOT NULL,
  cliente TEXT NOT NULL,
  telefono TEXT,
  direccion TEXT NOT NULL,
  barrio TEXT,
  notas TEXT,
  local_id UUID REFERENCES locales(id),
  repartidor_id UUID REFERENCES repartidores(id),
  km DECIMAL(5,2),
  envio INTEGER,
  precio INTEGER NOT NULL,
  pago_repartidor INTEGER,
  empresa_recibe INTEGER,
  estado TEXT DEFAULT 'Pendiente',
  liquidado BOOLEAN DEFAULT false,
  cancelado BOOLEAN DEFAULT false,
  cancelado_razon TEXT,
  cancelado_at TIMESTAMPTZ,
  tiempo_min INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de turnos
CREATE TABLE IF NOT EXISTS turnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  notas TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de configuracion
CREATE TABLE IF NOT EXISTS app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tarifa_base INTEGER DEFAULT 2500,
  costo_por_km INTEGER DEFAULT 1200,
  porcentaje_repartidor INTEGER DEFAULT 55,
  whatsapp_number TEXT DEFAULT '',
  company_name TEXT DEFAULT 'DomiU Magdalena',
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

-- Tabla historial de estados (auditoria)
CREATE TABLE IF NOT EXISTS pedido_estado_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  estado_anterior TEXT,
  estado_nuevo TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE repartidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE locales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE address_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_estado_history ENABLE ROW LEVEL SECURITY;

-- Politicas
CREATE POLICY "Own profile select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Own profile update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Repartidores: admin ve/edita todos, rider ve el suyo
CREATE POLICY "Repartidores all own" ON repartidores FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Repartidores select any" ON repartidores FOR SELECT USING (true);

CREATE POLICY "Own locales all" ON locales FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Locales select any" ON locales FOR SELECT USING (true);

-- Pedidos: admin (user_id) o rider asignado
CREATE POLICY "Pedidos admin all" ON pedidos FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Pedidos rider select" ON pedidos FOR SELECT USING (
  repartidor_id IN (SELECT id FROM repartidores WHERE user_id = auth.uid())
);
CREATE POLICY "Pedidos rider update" ON pedidos FOR UPDATE USING (
  repartidor_id IN (SELECT id FROM repartidores WHERE user_id = auth.uid())
);

CREATE POLICY "Own turnos all" ON turnos FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Turnos select any" ON turnos FOR SELECT USING (true);

CREATE POLICY "Own config all" ON app_config FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own address all" ON address_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Estado history select" ON pedido_estado_history FOR SELECT USING (true);

-- Trigger auto-perfil
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, nombre)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'nombre')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO app_config (user_id) VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger historial de estados
CREATE OR REPLACE FUNCTION track_pedido_estado()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO pedido_estado_history (pedido_id, estado_anterior, estado_nuevo)
    VALUES (NEW.id, OLD.estado, NEW.estado);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pedido_estado_trigger ON pedidos;
CREATE TRIGGER pedido_estado_trigger
  AFTER UPDATE OF estado ON pedidos
  FOR EACH ROW EXECUTE FUNCTION track_pedido_estado();

-- FUNCION: Generar codigo unico para pedidos
CREATE OR REPLACE FUNCTION generate_pedido_codigo()
RETURNS TEXT AS $$
DECLARE
  count_val INTEGER;
  code TEXT;
BEGIN
  SELECT COALESCE(COUNT(*), 0) + 1 INTO count_val FROM pedidos;
  code := 'DOM-' || LPAD(count_val::TEXT, 4, '0');
  WHILE EXISTS (SELECT 1 FROM pedidos WHERE codigo = code) LOOP
    count_val := count_val + 1;
    code := 'DOM-' || LPAD(count_val::TEXT, 4, '0');
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- FUNCION: Register rider con perfil completo
CREATE OR REPLACE FUNCTION register_rider(
  p_email TEXT, p_password TEXT, p_nombre TEXT, p_telefono TEXT,
  p_vehiculo TEXT DEFAULT NULL, p_placa TEXT DEFAULT NULL, p_documento TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_rider_id UUID;
BEGIN
  INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, instance_id, aud)
  VALUES (p_email, crypt(p_password, gen_salt('bf')), NOW(), jsonb_build_object('nombre', p_nombre), NOW(), NOW(), uuid_nil(), 'authenticated')
  RETURNING id INTO v_user_id;
  
  INSERT INTO profiles (id, email, nombre, rol)
  VALUES (v_user_id, p_email, p_nombre, 'rider')
  ON CONFLICT (id) DO UPDATE SET rol = 'rider';
  
  INSERT INTO repartidores (user_id, nombre, telefono, vehiculo, placa, documento, estado)
  VALUES (v_user_id, p_nombre, p_telefono, p_vehiculo, p_placa, p_documento, 'Disponible')
  RETURNING id INTO v_rider_id;
  
  RETURN jsonb_build_object('user_id', v_user_id, 'rider_id', v_rider_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCION: Register admin user
CREATE OR REPLACE FUNCTION register_admin_user(p_email TEXT, p_password TEXT, p_nombre TEXT)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
BEGIN
  INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, instance_id, aud)
  VALUES (p_email, crypt(p_password, gen_salt('bf')), NOW(), jsonb_build_object('nombre', p_nombre), NOW(), NOW(), uuid_nil(), 'authenticated')
  RETURNING id INTO v_user_id;
  
  INSERT INTO profiles (id, email, nombre, rol)
  VALUES (v_user_id, p_email, p_nombre, 'admin')
  ON CONFLICT (id) DO UPDATE SET rol = 'admin';
  
  RETURN jsonb_build_object('user_id', v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- MIGRACION PARA BASES DE DATOS EXISTENTES
-- Si ya tienes las tablas, ejecuta estos ALTER:
-- ============================================
-- ALTER TABLE repartidores ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'No disponible';
-- ALTER TABLE repartidores ADD COLUMN IF NOT EXISTS vehiculo TEXT;
-- ALTER TABLE repartidores ADD COLUMN IF NOT EXISTS placa TEXT;
-- ALTER TABLE repartidores ADD COLUMN IF NOT EXISTS documento TEXT;
-- ALTER TABLE repartidores ADD COLUMN IF NOT EXISTS foto_url TEXT;
-- ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS notas TEXT;
-- ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cancelado BOOLEAN DEFAULT false;
-- ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cancelado_razon TEXT;
-- ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cancelado_at TIMESTAMPTZ;
-- ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS turno_id UUID REFERENCES turnos(id);
-- ALTER TABLE app_config ADD COLUMN IF NOT EXISTS whatsapp_number TEXT DEFAULT '';
-- ALTER TABLE app_config ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT 'DomiU Magdalena';
