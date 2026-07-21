# Consultas de monitoreo

Consultas operativas deben ejecutarse con acceso administrativo y sin exportar PII:

- conteo de `created_manually` por fecha y canal;
- conflictos o fallos en `audit_log` por acción;
- movimientos decrement sin restore en pedidos cancelados;
- borradores expirados;
- claves idempotentes repetidas;
- inventario negativo, cuyo resultado esperado es cero.
