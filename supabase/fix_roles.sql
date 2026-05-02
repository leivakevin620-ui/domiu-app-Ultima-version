-- ============================================
-- FIX: Registro y separación de roles
-- Ejecuta TODO en SQL Editor de Supabase
-- ============================================

-- 1. REEMPLAZAR TRIGGER handle_new_user para que lea el rol de metadata
-- y cree automáticamente el repartidor si el rol es "repartidor"
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insertar perfil con rol correcto desde metadata
  INSERT INTO profiles (id, email, nombre, rol)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    COALESCE(NEW.raw_user_meta_data->>'rol', 'admin')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nombre = EXCLUDED.nombre,
    rol = EXCLUDED.rol;

  -- Si es repartidor, crear automáticamente el registro en repartidores
  IF COALESCE(NEW.raw_user_meta_data->>'rol', 'admin') = 'repartidor' THEN
    INSERT INTO repartidores (
      user_id,
      nombre,
      telefono,
      documento,
      vehiculo,
      placa,
      estado
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
      COALESCE(NEW.raw_user_meta_data->>'telefono', ''),
      COALESCE(NEW.raw_user_meta_data->>'documento', ''),
      COALESCE(NEW.raw_user_meta_data->>'vehiculo', ''),
      COALESCE(NEW.raw_user_meta_data->>'placa', ''),
      'No disponible'
    );
  END IF;

  -- Config por defecto para admin
  IF COALESCE(NEW.raw_user_meta_data->>'rol', 'admin') = 'admin' THEN
    INSERT INTO app_config (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Asegurar que el trigger exista
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. Política RLS: permitir INSERT en repartidores para usuarios autenticados
DROP POLICY IF EXISTS "Repartidores insert authenticated" ON repartidores;
CREATE POLICY "Repartidores insert authenticated" ON repartidores
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Política RLS: permitir INSERT en profiles para el propio usuario
DROP POLICY IF EXISTS "Profile insert own" ON profiles;
CREATE POLICY "Profile insert own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 5. Política RLS: permitir UPDATE en profiles para el propio usuario (ya existe pero asegurar)
DROP POLICY IF EXISTS "Own profile update" ON profiles;
CREATE POLICY "Own profile update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 6. Política RLS: permitir UPDATE en repartidores para el propio repartidor
DROP POLICY IF EXISTS "Repartidor update own" ON repartidores;
CREATE POLICY "Repartidor update own" ON repartidores
  FOR UPDATE USING (auth.uid() = user_id);

-- 7. Política RLS: permitir SELECT en profiles para el propio usuario
DROP POLICY IF EXISTS "Profile select own" ON profiles;
CREATE POLICY "Profile select own" ON profiles
  FOR SELECT USING (auth.uid() = id);
