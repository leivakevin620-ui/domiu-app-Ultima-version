-- Tabla para ubicaciones de repartidores
CREATE TABLE IF NOT EXISTS ubicaciones_repartidores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repartidor_id text NOT NULL,
  nombre_repartidor text,
  latitud double precision NOT NULL,
  longitud double precision NOT NULL,
  estado text DEFAULT 'disponible' CHECK (estado IN ('disponible', 'ocupado', 'desconectado')),
  ultima_actualizacion timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE ubicaciones_repartidores ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para desarrollo (ajustar en producción)
CREATE POLICY IF NOT EXISTS "Permitir select a todos" ON ubicaciones_repartidores
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Permitir insert a todos" ON ubicaciones_repartidores
  FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Permitir update a todos" ON ubicaciones_repartidores
  FOR UPDATE USING (true);

CREATE POLICY IF NOT EXISTS "Permitir delete a todos" ON ubicaciones_repartidores
  FOR DELETE USING (true);

-- Agregar a Realtime (evitar error si ya está)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'ubicaciones_repartidores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ubicaciones_repartidores;
  END IF;
END
$$;

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_ubicaciones_repartidor_id ON ubicaciones_repartidores(repartidor_id);

SELECT 'Tabla ubicaciones_repartidores lista' AS resultado;
