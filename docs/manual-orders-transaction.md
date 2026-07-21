# Transacción de confirmación

La función `confirm_manual_order` se ejecuta como una sola transacción implícita de PostgreSQL. Cualquier excepción revierte direcciones invitadas, stock, pedido, artículos, movimientos, tracking y auditoría creados por el intento.

Las llamadas externas no forman parte de la transacción. Los triggers existentes operan sobre el mismo INSERT/UPDATE y deben fallar de forma explícita cuando falta configuración obligatoria.
