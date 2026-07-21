# Índices

- `idx_orders_manual_idempotency`: creador y clave, parcial para manuales.
- `idx_orders_manual_business_created`: listados manuales por negocio/fecha.
- `idx_orders_manual_guest_phone`: soporte operativo por teléfono invitado.
- `idx_manual_order_drafts_actor`: borradores del actor.
- `idx_manual_order_drafts_business`: borradores por negocio.
- `idx_manual_inventory_order`: movimientos por pedido.

La clave única de movimientos evita repetir decrementos o restauraciones por artículo.
