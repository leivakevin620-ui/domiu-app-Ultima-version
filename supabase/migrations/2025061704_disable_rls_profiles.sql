-- ==========================================
-- DomiU App - Fix RLS recursion on profiles
-- ==========================================
-- INSTRUCCIONES:
-- 1. Ve a https://supabase.com/dashboard/project/vuwaqmwgvldqmmgkpyjh/sql/new
-- 2. Pega todo este SQL
-- 3. Haz clic en "RUN" o "Ejecutar"
-- ==========================================

-- Eliminar la política recursiva que causa el error 42P17
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

-- Deshabilitar RLS en la tabla profiles por completo
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- Alternativa: Si prefieres mantener RLS,
-- comenta las líneas de arriba y
-- descomenta las de abajo:
-- ==========================================
-- CREATE POLICY "Enable read access for own profile"
--   ON profiles FOR SELECT
--   USING (auth.uid() = id OR auth.role() = 'service_role');
