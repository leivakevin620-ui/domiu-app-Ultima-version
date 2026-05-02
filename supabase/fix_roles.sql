-- ============================================
-- FIX: Registro, separación de roles y limpieza
-- Ejecuta TODO en SQL Editor de Supabase
-- ============================================

-- 1. ELIMINAR cuentas admin que NO sean leivakevin620@gmail.com
-- Primero eliminar de repartidores (si existen)
DELETE FROM repartidores
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email != 'leivakevin620@gmail.com'
  AND raw_user_meta_data->>'rol' = 'admin'
);

-- Eliminar de profiles
DELETE FROM profiles
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email != 'leivakevin620@gmail.com'
  AND raw_user_meta_data->>'rol' = 'admin'
);

-- Eliminar usuarios auth (esto requiere ser superadmin en Supabase)
-- NOTA: Si esto falla por permisos, elimina manualmente desde Authentication > Users en el dashboard
-- DELETE FROM auth.users
-- WHERE email != 'leivakevin620@gmail.com'
-- AND raw_user_meta_data->>'rol' = 'admin';

-- 2. REEMPLAZAR TRIGGER handle_new_user
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

-- 3. Asegurar que el trigger exista
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 4. Políticas RLS
DROP POLICY IF EXISTS "Repartidores insert authenticated" ON repartidores;
CREATE POLICY "Repartidores insert authenticated" ON repartidores
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Repartidores select any" ON repartidores;
CREATE POLICY "Repartidores select any" ON repartidores
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Repartidor update own" ON repartidores;
CREATE POLICY "Repartidor update own" ON repartidores
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Repartidores all own" ON repartidores;
CREATE POLICY "Repartidores all own" ON repartidores
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Profile select own" ON profiles;
CREATE POLICY "Profile select own" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Own profile update" ON profiles;
CREATE POLICY "Own profile update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Profile insert own" ON profiles;
CREATE POLICY "Profile insert own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
