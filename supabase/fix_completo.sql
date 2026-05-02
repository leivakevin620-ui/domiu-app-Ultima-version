-- ============================================
-- DOMIU MAGDALENA - SQL COMPLETO
-- Ejecuta TODO esto una sola vez en SQL Editor de Supabase
-- ============================================
-- Este script hace 4 cosas:
-- 1. Borra cuentas admin no autorizadas
-- 2. Agrega CASCADE a las foreign keys
-- 3. Configura el trigger de registro correcto
-- 4. Configura las politicas RLS
-- ============================================

-- ==================================================
-- PARTE 1: LIMPIEZA - Borrar cuentas admin no autorizadas
-- ==================================================

-- Borrar en orden de dependencias
DELETE FROM pedidos WHERE user_id IN (SELECT id FROM profiles WHERE rol = 'admin' AND email != 'leivakevin620@gmail.com');
DELETE FROM turnos WHERE user_id IN (SELECT id FROM profiles WHERE rol = 'admin' AND email != 'leivakevin620@gmail.com');
DELETE FROM app_config WHERE user_id IN (SELECT id FROM profiles WHERE rol = 'admin' AND email != 'leivakevin620@gmail.com');
DELETE FROM address_history WHERE user_id IN (SELECT id FROM profiles WHERE rol = 'admin' AND email != 'leivakevin620@gmail.com');
DELETE FROM pedido_estado_history WHERE pedido_id IN (SELECT id FROM pedidos WHERE user_id IN (SELECT id FROM profiles WHERE rol = 'admin' AND email != 'leivakevin620@gmail.com'));
DELETE FROM locales WHERE user_id IN (SELECT id FROM profiles WHERE rol = 'admin' AND email != 'leivakevin620@gmail.com');
DELETE FROM repartidores WHERE user_id IN (SELECT id FROM profiles WHERE rol = 'admin' AND email != 'leivakevin620@gmail.com');
DELETE FROM profiles WHERE rol = 'admin' AND email != 'leivakevin620@gmail.com';

-- Verificar que solo queda el admin autorizado
SELECT email, rol FROM profiles WHERE rol = 'admin';

-- ==================================================
-- PARTE 2: CASCADA - Agregar ON DELETE CASCADE a las foreign keys
-- ==================================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE app_config DROP CONSTRAINT IF EXISTS app_config_user_id_fkey;
ALTER TABLE app_config ADD CONSTRAINT app_config_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE address_history DROP CONSTRAINT IF EXISTS address_history_user_id_fkey;
ALTER TABLE address_history ADD CONSTRAINT address_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE locales DROP CONSTRAINT IF EXISTS locales_user_id_fkey;
ALTER TABLE locales ADD CONSTRAINT locales_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE turnos DROP CONSTRAINT IF EXISTS turnos_user_id_fkey;
ALTER TABLE turnos ADD CONSTRAINT turnos_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_user_id_fkey;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE repartidores DROP CONSTRAINT IF EXISTS repartidores_user_id_fkey;
ALTER TABLE repartidores ADD CONSTRAINT repartidores_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ==================================================
-- PARTE 3: TRIGGER - Funcion que se ejecuta al crear usuario
-- ==================================================

-- Borrar trigger anterior si existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Borrar funcion anterior si existe
DROP FUNCTION IF EXISTS handle_new_user();

-- Crear funcion nueva
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

  -- Si es repartidor, crear automaticamente el registro en repartidores
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

-- Crear el trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ==================================================
-- PARTE 4: POLITICAS RLS - Permisos
-- ==================================================

-- profiles: cada usuario ve y edita solo su perfil
DROP POLICY IF EXISTS "Profile select own" ON profiles;
CREATE POLICY "Profile select own" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Own profile update" ON profiles;
CREATE POLICY "Own profile update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- repartidores: cualquier usuario puede ver todos (para que el admin los vea)
-- cada repartidor solo puede editar su propio registro
DROP POLICY IF EXISTS "Repartidores select any" ON repartidores;
CREATE POLICY "Repartidores select any" ON repartidores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Repartidor update own" ON repartidores;
CREATE POLICY "Repartidor update own" ON repartidores FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Repartidor delete own" ON repartidores;
CREATE POLICY "Repartidor delete own" ON repartidores FOR DELETE USING (auth.uid() = user_id);

-- locales: el dueno puede hacer todo, todos pueden ver
DROP POLICY IF EXISTS "Locales select any" ON locales;
CREATE POLICY "Locales select any" ON locales FOR SELECT USING (true);

DROP POLICY IF EXISTS "Own locales all" ON locales;
CREATE POLICY "Own locales all" ON locales FOR ALL USING (auth.uid() = user_id);

-- pedidos: admin ve todos los suyos, rider ve los asignados
DROP POLICY IF EXISTS "Pedidos admin all" ON pedidos;
CREATE POLICY "Pedidos admin all" ON pedidos FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Pedidos rider select" ON pedidos;
CREATE POLICY "Pedidos rider select" ON pedidos FOR SELECT USING (
  repartidor_id IN (SELECT id FROM repartidores WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Pedidos rider update" ON pedidos;
CREATE POLICY "Pedidos rider update" ON pedidos FOR UPDATE USING (
  repartidor_id IN (SELECT id FROM repartidores WHERE user_id = auth.uid())
);

-- turnos: el dueno puede hacer todo, todos pueden ver
DROP POLICY IF EXISTS "Turnos select any" ON turnos;
CREATE POLICY "Turnos select any" ON turnos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Own turnos all" ON turnos;
CREATE POLICY "Own turnos all" ON turnos FOR ALL USING (auth.uid() = user_id);

-- app_config: solo el dueno
DROP POLICY IF EXISTS "Own config all" ON app_config;
CREATE POLICY "Own config all" ON app_config FOR ALL USING (auth.uid() = user_id);

-- address_history: solo el dueno
DROP POLICY IF EXISTS "Own address all" ON address_history;
CREATE POLICY "Own address all" ON address_history FOR ALL USING (auth.uid() = user_id);

-- estado history: todos pueden ver
DROP POLICY IF EXISTS "Estado history select" ON pedido_estado_history;
CREATE POLICY "Estado history select" ON pedido_estado_history FOR SELECT USING (true);
