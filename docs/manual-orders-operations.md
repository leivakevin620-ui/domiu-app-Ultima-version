# Operación y troubleshooting — pedidos manuales

## Variables

El módulo no introduce secretos nuevos. Requiere las variables backend actuales de Supabase y las variables públicas de la aplicación. La función transaccional solo se ejecuta con el cliente de servicio del servidor.

## Health y observabilidad

- `/api/health` valida configuración y conectividad principal.
- `audit_log` registra solicitudes limitadas y creación final.
- `order_tracking` conserva el inicio del pedido manual y cambios posteriores.
- `manual_order_inventory_movements` conserva decrementos y restauraciones.
- Vercel Runtime Logs permite filtrar `/api/manual-orders/*` por estado 4xx/5xx.

## Alertas recomendadas

- Tasa de 5xx en `/api/manual-orders/confirm` superior a 2 % durante cinco minutos.
- Errores de inventario superiores a la línea base.
- Conflictos de idempotencia con cuerpo distinto.
- Fallos de migración o ausencia de `confirm_manual_order`.
- Crecimiento de borradores expirados.

## Problemas frecuentes

### “El comercio está cerrado”

El comercio requiere jornada de plataforma, jornada comercial y estado operativo abierto. Administración puede continuar únicamente con excepción y motivo auditado.

### “Inventario modificado por otro pedido”

Otro proceso consumió stock entre cotización y confirmación. Recalcular; no forzar el total o inventario anterior.

### “La clave de idempotencia ya fue usada”

El navegador reintentó una solicitud con datos diferentes. Generar una nueva clave únicamente después de que el usuario modifique el pedido de forma deliberada.

### Dirección sin coordenadas

Se registra advertencia y se usa tarifa base de respaldo. Para tarifa por distancia se requieren coordenadas o distancia validada.

### Borrador en conflicto

La versión cambió en otra sesión. Recargar el borrador antes de aplicar cambios.

## Rollback

El despliegue de aplicación puede revertirse desde Vercel. Las migraciones son aditivas y no deben eliminarse si ya existen pedidos manuales. Para desactivar temporalmente el módulo, retirar los enlaces y responder 503 en APIs mientras se conserva toda la persistencia.
