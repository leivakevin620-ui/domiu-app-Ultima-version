-- ============================================================
-- DOMIU MAGDALENA - PANEL NEGOCIO ALIADO
-- Agrega columnas faltantes a tablas existentes
-- ============================================================

-- Agregar usuario_id a negocios para vincular con auth
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Agregar columna imagen_url a productos si no existe
ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen_url TEXT DEFAULT '';

-- Agregar columna estado_negocio a pedidos_cliente (para el flujo del negocio)
ALTER TABLE pedidos_cliente ADD COLUMN IF NOT EXISTS estado_negocio TEXT DEFAULT 'recibido'
  CHECK (estado_negocio IN ('recibido','en_preparacion','listo_para_recoger'));

-- Actualizar políticas RLS para desarrollo permisivo
DROP POLICY IF EXISTS "negocios_insert_public" ON negocios;
CREATE POLICY "negocios_insert_public" ON negocios FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "negocios_update_public" ON negocios;
CREATE POLICY "negocios_update_public" ON negocios FOR UPDATE USING (true);

DROP POLICY IF EXISTS "productos_insert_public" ON productos;
CREATE POLICY "productos_insert_public" ON productos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "productos_update_public" ON productos;
CREATE POLICY "productos_update_public" ON productos FOR UPDATE USING (true);

DROP POLICY IF EXISTS "productos_delete_public" ON productos;
CREATE POLICY "productos_delete_public" ON productos FOR DELETE USING (true);

-- Habilitar Realtime en pedidos_cliente (necesario para notificaciones en vivo)
-- Esto se hace desde el dashboard de Supabase, pero dejamos el comando por referencia
-- ALTER PUBLICATION supabase_realtime ADD TABLE pedidos_cliente;
