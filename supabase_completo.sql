-- ============================================================
-- DOMIU MAGDALENA - SQL COMPLETO (ejecutar todo en 1 vez)
-- Sin errores: FK corregido, estado CHECK con "recogido"
-- ============================================================

-- ============================================================
-- 1. TABLAS PRINCIPALES
-- ============================================================

CREATE TABLE IF NOT EXISTS negocios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('Restaurantes','Tiendas','Licoreras','Droguerias','Promociones')),
  descripcion TEXT,
  logo TEXT DEFAULT '',
  banner TEXT DEFAULT '',
  direccion TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  horario TEXT DEFAULT 'Lun-Dom 8:00-22:00',
  rating NUMERIC(2,1) DEFAULT 4.5 CHECK (rating >= 0 AND rating <= 5),
  tiempo_estimado TEXT DEFAULT '30-45 min',
  domicilio_cost NUMERIC(10,2) DEFAULT 3000,
  abierto BOOLEAN DEFAULT true,
  destacado BOOLEAN DEFAULT false,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT DEFAULT '',
  precio NUMERIC(10,2) NOT NULL CHECK (precio > 0),
  imagen TEXT DEFAULT '',
  categoria_producto TEXT DEFAULT 'General',
  disponible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla repartidores (del sistema original, necesaria para FKs)
CREATE TABLE IF NOT EXISTS repartidores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS pedidos_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 8)),
  cliente_nombre TEXT NOT NULL,
  cliente_telefono TEXT NOT NULL,
  cliente_direccion TEXT NOT NULL,
  cliente_barrio TEXT DEFAULT '',
  nota TEXT DEFAULT '',
  negocio_id UUID NOT NULL REFERENCES negocios(id),
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  domicilio NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'recibido',
  repartidor_id UUID REFERENCES repartidores(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS detalle_pedido_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedidos_cliente(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  producto_nombre TEXT NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL
);

-- ============================================================
-- 1.5. TABLA UBICACIONES REPARTIDORES (para GPS en vivo)
-- ============================================================

CREATE TABLE IF NOT EXISTS ubicaciones_repartidores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repartidor_id UUID NOT NULL REFERENCES repartidores(id) ON DELETE CASCADE,
  nombre_repartidor TEXT,
  latitud DOUBLE PRECISION NOT NULL,
  longitud DOUBLE PRECISION NOT NULL,
  estado TEXT DEFAULT 'disponible',
  ultima_actualizacion TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ubicaciones_repartidores ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. COLUMNAS ADICIONALES
-- ============================================================

ALTER TABLE negocios ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen_url TEXT DEFAULT '';

ALTER TABLE pedidos_cliente ADD COLUMN IF NOT EXISTS estado_negocio TEXT DEFAULT 'recibido'
  CHECK (estado_negocio IN ('recibido','en_preparacion','listo_para_recoger'));

ALTER TABLE pedidos_cliente ADD COLUMN IF NOT EXISTS estado_admin TEXT DEFAULT 'recibido'
  CHECK (estado_admin IN ('recibido','en_preparacion','listo_para_recoger','asignado','en_camino','entregado','cancelado'));

ALTER TABLE pedidos_cliente ADD COLUMN IF NOT EXISTS costo_envio NUMERIC(10,2) DEFAULT 0;
ALTER TABLE pedidos_cliente ADD COLUMN IF NOT EXISTS comision_empresa NUMERIC(10,2) DEFAULT 0;
ALTER TABLE pedidos_cliente ADD COLUMN IF NOT EXISTS pago_repartidor NUMERIC(10,2) DEFAULT 0;
ALTER TABLE pedidos_cliente ADD COLUMN IF NOT EXISTS ganancia_empresa NUMERIC(10,2) DEFAULT 0;
ALTER TABLE pedidos_cliente ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ DEFAULT now();

ALTER TABLE pedidos_cliente ADD COLUMN IF NOT EXISTS recogido_en TIMESTAMPTZ;
ALTER TABLE pedidos_cliente ADD COLUMN IF NOT EXISTS entregado_en TIMESTAMPTZ;

-- CHECK de estado: incluye TODOS los estados del flujo completo
ALTER TABLE pedidos_cliente DROP CONSTRAINT IF EXISTS pedidos_cliente_estado_check;
ALTER TABLE pedidos_cliente ADD CONSTRAINT pedidos_cliente_estado_check
  CHECK (estado IN ('recibido','preparacion','en_preparacion','listo_para_recoger','asignado','recogido','camino','en_camino','entregado','cancelado'));

-- ============================================================
-- 3. RLS POLICIES
-- ============================================================

ALTER TABLE negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_pedido_cliente ENABLE ROW LEVEL SECURITY;

-- Negocios
DROP POLICY IF EXISTS "negocios_select_public" ON negocios;
CREATE POLICY "negocios_select_public" ON negocios FOR SELECT USING (true);
DROP POLICY IF EXISTS "negocios_insert_public" ON negocios;
CREATE POLICY "negocios_insert_public" ON negocios FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "negocios_update_public" ON negocios;
CREATE POLICY "negocios_update_public" ON negocios FOR UPDATE USING (true);

-- Productos
DROP POLICY IF EXISTS "productos_select_public" ON productos;
CREATE POLICY "productos_select_public" ON productos FOR SELECT USING (true);
DROP POLICY IF EXISTS "productos_insert_public" ON productos;
CREATE POLICY "productos_insert_public" ON productos FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "productos_update_public" ON productos;
CREATE POLICY "productos_update_public" ON productos FOR UPDATE USING (true);
DROP POLICY IF EXISTS "productos_delete_public" ON productos;
CREATE POLICY "productos_delete_public" ON productos FOR DELETE USING (true);

-- Pedidos cliente (todos pueden todo en desarrollo)
DROP POLICY IF EXISTS "pedidos_cliente_insert" ON pedidos_cliente;
CREATE POLICY "pedidos_cliente_insert" ON pedidos_cliente FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "pedidos_cliente_select" ON pedidos_cliente;
CREATE POLICY "pedidos_cliente_select" ON pedidos_cliente FOR SELECT USING (true);
DROP POLICY IF EXISTS "pedidos_cliente_update" ON pedidos_cliente;
CREATE POLICY "pedidos_cliente_update" ON pedidos_cliente FOR UPDATE USING (true);

-- Detalle
DROP POLICY IF EXISTS "detalle_pedido_insert" ON detalle_pedido_cliente;
CREATE POLICY "detalle_pedido_insert" ON detalle_pedido_cliente FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "detalle_pedido_select" ON detalle_pedido_cliente;
CREATE POLICY "detalle_pedido_select" ON detalle_pedido_cliente FOR SELECT USING (true);

-- RLS especifica para repartidor (Fase 4)
-- Nota: usamos ::text para evitar error de tipos (text vs uuid)
DROP POLICY IF EXISTS "repartidor_select_pedidos" ON pedidos_cliente;
CREATE POLICY "repartidor_select_pedidos" ON pedidos_cliente FOR SELECT
  USING (repartidor_id::text IN (SELECT id::text FROM repartidores WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "repartidor_update_pedidos" ON pedidos_cliente;
CREATE POLICY "repartidor_update_pedidos" ON pedidos_cliente FOR UPDATE
  USING (repartidor_id::text IN (SELECT id::text FROM repartidores WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "repartidor_insert_ubicacion" ON ubicaciones_repartidores;
CREATE POLICY "repartidor_insert_ubicacion" ON ubicaciones_repartidores FOR INSERT
  WITH CHECK (repartidor_id::text IN (SELECT id::text FROM repartidores WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "repartidor_update_ubicacion" ON ubicaciones_repartidores;
CREATE POLICY "repartidor_update_ubicacion" ON ubicaciones_repartidores FOR UPDATE
  USING (repartidor_id::text IN (SELECT id::text FROM repartidores WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "repartidor_select_ubicacion" ON ubicaciones_repartidores;
CREATE POLICY "repartidor_select_ubicacion" ON ubicaciones_repartidores FOR SELECT
  USING (repartidor_id::text IN (SELECT id::text FROM repartidores WHERE user_id = auth.uid()));

-- ============================================================
-- 4. DATOS DE EJEMPLO
-- ============================================================

INSERT INTO negocios (nombre, categoria, descripcion, logo, direccion, telefono, rating, tiempo_estimado, domicilio_cost, abierto, destacado) VALUES
('Pizzeria Napoli', 'Restaurantes', 'Las mejores pizzas artesanales de Magdalena, ingredientes frescos y masa madre.', '', 'Calle Real #123, Magdalena', '3001112233', 4.8, '25-35 min', 3500, true, true),
('Super Tienda Don Pepe', 'Tiendas', 'Todo lo que necesitas para tu hogar: abarrotes, limpieza, bebidas y mas.', '', 'Av. Central #456, Magdalena', '3001113344', 4.3, '20-30 min', 3000, true, true),
('Licores El Buen Gusto', 'Licoreras', 'Amplia seleccion de cervezas, vinos, licores y cocteles preparados.', '', 'Carrera 7 #789, Magdalena', '3001114455', 4.6, '30-40 min', 4000, true, false),
('Drogueria Salud Total', 'Droguerias', 'Medicamentos, productos de cuidado personal y primera necesidad.', '', 'Calle 12 #321, Magdalena', '3001115566', 4.7, '15-25 min', 2500, true, false),
('Sushi Master', 'Restaurantes', 'Sushi fresco, rolls especiales y comida japonesa tradicional.', '', 'Av. del Rio #654, Magdalena', '3001116677', 4.9, '35-50 min', 4500, true, true);

-- Productos Pizzeria Napoli
WITH neg AS (SELECT id FROM negocios WHERE nombre = 'Pizzeria Napoli' LIMIT 1)
INSERT INTO productos (negocio_id, nombre, descripcion, precio, imagen, categoria_producto) VALUES
((SELECT id FROM neg), 'Pizza Margherita', 'Mozzarella fresca, albahaca, salsa de tomate', 22000, '', 'Pizzas'),
((SELECT id FROM neg), 'Pizza Pepperoni', 'Pepperoni, mozzarella, salsa de tomate', 25000, '', 'Pizzas'),
((SELECT id FROM neg), 'Pizza Hawaiana', 'Pina, jamon, mozzarella, salsa de tomate', 24000, '', 'Pizzas'),
((SELECT id FROM neg), 'Pizza Vegetariana', 'Pimientos, cebolla, champiñones, aceitunas', 23000, '', 'Pizzas'),
((SELECT id FROM neg), 'Coca-Cola 1.5L', 'Gaseosa Coca-Cola personal', 5000, '', 'Bebidas');

-- Productos Super Tienda Don Pepe
WITH neg AS (SELECT id FROM negocios WHERE nombre = 'Super Tienda Don Pepe' LIMIT 1)
INSERT INTO productos (negocio_id, nombre, descripcion, precio, imagen, categoria_producto) VALUES
((SELECT id FROM neg), 'Arroz Diana 1kg', 'Arroz blanco de alta calidad', 3500, '', 'Abarrotes'),
((SELECT id FROM neg), 'Aceite Vegetal 1L', 'Aceite vegetal para cocinar', 8500, '', 'Abarrotes'),
((SELECT id FROM neg), 'Leche Entera 1L', 'Leche entera pasteurizada', 4200, '', 'Lacteos'),
((SELECT id FROM neg), 'Pan Bimbo Grande', 'Pan de molde integral', 6800, '', 'Panaderia'),
((SELECT id FROM neg), 'Jabon para Ropa', 'Detergente en polvo 500g', 4500, '', 'Limpieza');

-- Productos Licores El Buen Gusto
WITH neg AS (SELECT id FROM negocios WHERE nombre = 'Licores El Buen Gusto' LIMIT 1)
INSERT INTO productos (negocio_id, nombre, descripcion, precio, imagen, categoria_producto) VALUES
((SELECT id FROM neg), 'Cerveza Aguila x6', 'Pack de 6 cervezas Aguila', 18000, '', 'Cervezas'),
((SELECT id FROM neg), 'Vino Tinto Casillero', 'Vino tinto Casillero del Diablo 750ml', 45000, '', 'Vinos'),
((SELECT id FROM neg), 'Ron Medellin Anejo', 'Ron Medellin Anejo 750ml', 55000, '', 'Licores'),
((SELECT id FROM neg), 'Coctel Margarita', 'Coctel Margarita preparado 500ml', 22000, '', 'Cocteles');

-- Productos Drogueria Salud Total
WITH neg AS (SELECT id FROM negocios WHERE nombre = 'Drogueria Salud Total' LIMIT 1)
INSERT INTO productos (negocio_id, nombre, descripcion, precio, imagen, categoria_producto) VALUES
((SELECT id FROM neg), 'Acetaminofen 500mg x10', 'Analgesico y antipiretico', 2500, '', 'Medicamentos'),
((SELECT id FROM neg), 'Ibuprofeno 400mg x10', 'Antiinflamatorio no esteroideo', 3500, '', 'Medicamentos'),
((SELECT id FROM neg), 'Curitas x20', 'Apósito adhesivo para heridas', 2000, '', 'Cuidado Personal'),
((SELECT id FROM neg), 'Alcohol Antiseptico 500ml', 'Alcohol etilico al 70%', 4500, '', 'Cuidado Personal');

-- Productos Sushi Master
WITH neg AS (SELECT id FROM negocios WHERE nombre = 'Sushi Master' LIMIT 1)
INSERT INTO productos (negocio_id, nombre, descripcion, precio, imagen, categoria_producto) VALUES
((SELECT id FROM neg), 'Roll Salmón Philadelphia', 'Sushi roll con salmon, queso crema y aguacate', 28000, '', 'Rolls'),
((SELECT id FROM neg), 'California Roll', 'Cangrejo, aguacate, pepino y masago', 24000, '', 'Rolls'),
((SELECT id FROM neg), 'Nigiri Mix x8', '8 piezas variadas de nigiri', 32000, '', 'Nigiri');

-- ============================================================
-- HECHO - Pasos manuales restantes:
-- ============================================================
-- 1. Supabase Dashboard → Database → Replication
--    Agrega "pedidos_cliente" y "ubicaciones_repartidores" a supabase_realtime
--
-- 2. Google Cloud Console → APIs & Services → Credentials
--    Edita la API Key de Maps, agrega:
--    https://domiu-app-ultima-version.vercel.app/*
--    https://*.vercel.app/*
