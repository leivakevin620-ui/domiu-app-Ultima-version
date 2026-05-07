-- ============================================================
-- DOMIU MAGDALENA - ADMIN MARKETPLACE
-- Agrega columnas financieras y de control a pedidos_cliente
-- ============================================================

-- Agregar columnas financieras
ALTER TABLE pedidos_cliente ADD COLUMN IF NOT EXISTS estado_admin TEXT DEFAULT 'recibido'
  CHECK (estado_admin IN ('recibido','en_preparacion','listo_para_recoger','asignado','en_camino','entregado','cancelado'));

ALTER TABLE pedidos_cliente ADD COLUMN IF NOT EXISTS costo_envio NUMERIC(10,2) DEFAULT 0;
ALTER TABLE pedidos_cliente ADD COLUMN IF NOT EXISTS comision_empresa NUMERIC(10,2) DEFAULT 0;
ALTER TABLE pedidos_cliente ADD COLUMN IF NOT EXISTS pago_repartidor NUMERIC(10,2) DEFAULT 0;
ALTER TABLE pedidos_cliente ADD COLUMN IF NOT EXISTS ganancia_empresa NUMERIC(10,2) DEFAULT 0;
ALTER TABLE pedidos_cliente ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ DEFAULT now();

-- Actualizar el CHECK de estado para incluir todos los estados del flujo admin
ALTER TABLE pedidos_cliente DROP CONSTRAINT IF EXISTS pedidos_cliente_estado_check;
ALTER TABLE pedidos_cliente ADD CONSTRAINT pedidos_cliente_estado_check
  CHECK (estado IN ('recibido','preparacion','en_preparacion','listo_para_recoger','asignado','camino','en_camino','entregado','cancelado'));

-- RLS permisiva para desarrollo
DROP POLICY IF EXISTS "pedidos_cliente_update_admin" ON pedidos_cliente;
CREATE POLICY "pedidos_cliente_update_admin" ON pedidos_cliente FOR UPDATE USING (true);
