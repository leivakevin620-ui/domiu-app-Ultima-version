# Invariantes de dominio

- Un pedido pertenece a un solo negocio.
- Cada producto de catálogo pertenece al negocio del pedido.
- Un invitado no tiene `customer_id`.
- Un pickup no tiene domicilio ni repartidor.
- Un artículo personalizado no tiene `product_id`.
- Ningún valor monetario es negativo.
- Una clave idempotente identifica un solo contenido.
- El inventario nunca queda negativo.
- Una restauración ocurre una sola vez por artículo.
