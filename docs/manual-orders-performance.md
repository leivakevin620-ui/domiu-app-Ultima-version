# Rendimiento y costos

- Bootstrap carga únicamente el negocio seleccionado, máximo 150 negocios y catálogo ordenado.
- Búsqueda de clientes requiere al menos dos caracteres y limita 20 resultados.
- Cotización y confirmación usan lotes para productos y variantes.
- Borradores se limitan a 50 y 100 KB por payload.
- Pedidos se limitan a 50 tipos de artículo y cantidades de 1 a 99.
- Rate limiting reduce abuso y costo de Supabase.
- La confirmación usa una única transacción PostgreSQL; no ejecuta llamadas externas.
- Notificaciones se delegan a triggers existentes y no condicionan la respuesta HTTP.

Índices parciales cubren idempotencia, listados manuales, borradores y movimientos de inventario.
