-- ============================================================
-- DOMIU MAGDALENA - PANEL REPARTIDOR MARKETPLACE
-- Agrega columnas de control temporal y RLS para repartidor
-- ============================================================

-- Agregar timestamps para acciones del repartidor
ALTER TABLE pedidos_cliente ADD COLUMN IF NOT EXISTS recogido_en TIMESTAMPTZ;
ALTER TABLE pedidos_cliente ADD COLUMN IF NOT EXISTS entregado_en TIMESTAMPTZ;

-- RLS: repartidor puede SELECT sus pedidos asignados
DROP POLICY IF EXISTS "repartidor_select_pedidos" ON pedidos_cliente;
CREATE POLICY "repartidor_select_pedidos" ON pedidos_cliente FOR SELECT
  USING (repartidor_id IN (SELECT id FROM repartidores WHERE user_id = auth.uid()));

-- RLS: repartidor puede UPDATE sus pedidos asignados
DROP POLICY IF EXISTS "repartidor_update_pedidos" ON pedidos_cliente;
CREATE POLICY "repartidor_update_pedidos" ON pedidos_cliente FOR UPDATE
  USING (repartidor_id IN (SELECT id FROM repartidores WHERE user_id = auth.uid()));

-- RLS: repartidor puede INSERT/UPDATE su ubicacion
DROP POLICY IF EXISTS "repartidor_insert_ubicacion" ON ubicaciones_repartidores;
CREATE POLICY "repartidor_insert_ubicacion" ON ubicaciones_repartidores FOR INSERT
  WITH CHECK (repartidor_id IN (SELECT id FROM repartidores WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "repartidor_update_ubicacion" ON ubicaciones_repartidores;
CREATE POLICY "repartidor_update_ubicacion" ON ubicaciones_repartidores FOR UPDATE
  USING (repartidor_id IN (SELECT id FROM repartidores WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "repartidor_select_ubicacion" ON ubicaciones_repartidores;
CREATE POLICY "repartidor_select_ubicacion" ON ubicaciones_repartidores FOR SELECT
  USING (repartidor_id IN (SELECT id FROM repartidores WHERE user_id = auth.uid()));
