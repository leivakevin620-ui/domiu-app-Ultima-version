# Notificaciones de pedidos manuales

La creación inserta en `orders`; los triggers existentes `notify_new_order_trigger`, sincronización de chats, pagos y liquidaciones reciben el pedido igual que cualquier otro pedido de producto.

La creación no llama proveedores externos directamente. Un fallo de notificación no debe deshacer una transacción de pedido válida. Los proveedores no configurados no se simulan.

Cuando el pedido se asigna a un repartidor, las notificaciones y el chat siguen el flujo logístico existente. Un pedido pickup no asigna repartidor.
