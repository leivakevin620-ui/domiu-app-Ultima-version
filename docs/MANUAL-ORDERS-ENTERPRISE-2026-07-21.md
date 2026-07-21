# Pedidos manuales Enterprise — DomiU

## Propósito

El módulo registra pedidos recibidos por WhatsApp, llamada, atención presencial, Instagram, Facebook, mensajes directos u otros canales autorizados. El pedido entra a la tabla `orders`, a la máquina de estados existente, al seguimiento, las notificaciones, la asignación logística y los cálculos financieros normales.

## Accesos

- Administración: `/admin/pedidos/crear`.
- Negocio: `/negocio/pedidos/crear`.

Ambos paneles utilizan `ManualOrderWizard` y las mismas APIs y servicios de dominio. El modo de interfaz no concede permisos; el backend reconstruye actor, rol y tenant desde la sesión autenticada.

## Flujo

1. Selección del negocio y la sucursal autorizada.
2. Vinculación opcional de cliente registrado o captura de cliente invitado.
3. Selección de domicilio o recogida en local.
4. Selección de productos del catálogo o artículo personalizado autorizado.
5. Cotización en backend con precio, descuento, stock, tarifa y tarifa de servicio actuales.
6. Revisión de advertencias y resumen.
7. Confirmación explícita con clave de idempotencia.
8. Transacción PostgreSQL: validación, bloqueo de inventario, creación de pedido, artículos, movimientos, seguimiento y auditoría.
9. Integración automática con triggers de notificación, pagos, liquidaciones y logística existentes.

## Dominio compartido

- `src/lib/manual-orders/schema.ts`: contratos Zod estrictos.
- `src/lib/manual-orders/security.ts`: autenticación, rol, tenant, CSRF por origen y rate limiting.
- `src/lib/manual-orders/service.ts`: bootstrap, búsqueda, cotización, borradores y confirmación.
- `src/components/manual-orders/ManualOrderWizard.tsx`: experiencia compartida admin/comercio.
- `src/services/admin-orders.ts`: lectura administrativa con snapshots.
- `src/services/business-orders.ts`: lectura comercial con snapshots sin notas internas.

## Persistencia

### Extensiones de `orders`

Se registran origen manual, creador, rol, panel, sucursal, snapshots, canal, tipo de entrega, fuente de tarifa, notas por visibilidad, moneda, idempotencia, motivo administrativo, valor pagado, recargo y propina.

`customer_id` puede ser nulo exclusivamente para permitir clientes invitados. La identidad se conserva en `guest_customer` y `customer_snapshot`; no se crea una cuenta de autenticación.

### Extensiones de `order_items`

Los artículos conservan nombre, SKU, precio, variante, modificadores y snapshot. Un artículo personalizado tiene `product_id` nulo y `is_custom_product=true`; nunca se inserta en el catálogo.

### Borradores

`manual_order_drafts` guarda formularios incompletos. No descuenta inventario, no crea pagos, no asigna repartidor y no aparece como venta. Tiene expiración, versión optimista y creador.

### Inventario

`manual_order_inventory_movements` registra decrementos y restauraciones. La confirmación bloquea producto o variante con `FOR UPDATE`, verifica nuevamente stock y descuenta mediante condición atómica. Al cancelar, un trigger restaura una sola vez gracias a la clave única `(order_item_id, movement_type)`.

## API

- `GET /api/manual-orders/bootstrap`
- `GET /api/manual-orders/customers?q=&businessId=`
- `POST /api/manual-orders/quote`
- `POST /api/manual-orders/confirm` — requiere `Idempotency-Key`.
- `GET /api/manual-orders/drafts`
- `POST /api/manual-orders/drafts`
- `DELETE /api/manual-orders/drafts/:id`

Todas las respuestas usan `Cache-Control: no-store`; las escrituras validan origen, sesión, rol y entrada. Ninguna API acepta totales del navegador como fuente de verdad.

## Permisos

### Comercio

- Solo negocios cuyo `owner_id` coincide con la sesión.
- Solo sucursales y productos del negocio.
- No puede asignar repartidores.
- No puede aplicar descuentos o recargos administrativos.
- Artículos personalizados y tarifa manual dependen de configuración del negocio.
- Búsqueda de clientes limitada a clientes previamente vinculados a pedidos de ese negocio.

### Administración

- Puede seleccionar negocio, repartidor y estado inicial permitido.
- Puede continuar ante restricciones operativas únicamente con `adminOverride` y motivo.
- Puede aplicar ajustes monetarios con motivo.
- No puede mezclar productos de negocios distintos.

### Cliente y repartidor

No obtienen permisos de creación. Compartir un teléfono no vincula un pedido a un cliente. El repartidor usa las vistas operativas existentes y no recibe `internal_notes`.

## Tarifas y dinero

La tarifa de domicilio se suma al total del cliente. Pickup fuerza tarifa cero. La cotización y la función SQL usan la configuración vigente; cuando no hay coordenadas se informa la advertencia y se usa la tarifa base de respaldo. La tarifa manual exige permiso y motivo.

Los valores se normalizan a enteros COP en la API. PostgreSQL recalcula el desglose financiero mediante los triggers existentes. Crear el pedido nunca marca el pago como completado sin un estado y referencia válidos.

## Idempotencia

El navegador conserva una clave durante todos los reintentos. El índice único `(created_by_user_id, idempotency_key)` impide duplicados. La función compara además el hash de la solicitud; una misma clave con contenido diferente se rechaza.

## Auditoría

La operación registra actor, rol, negocio, sucursal, canal, entrega, totales, tarifa modificada, repartidor, estado, motivo y clave de idempotencia. No registra secretos ni datos completos de pago.

## Pruebas

- `src/test/manual-orders-schema.test.ts`
- `src/test/manual-orders-architecture.test.ts`
- `.github/workflows/manual-orders-ci.yml`

CI ejecuta escaneo de secretos, `npm audit --audit-level=high`, pruebas Vitest, validación estructural de migraciones y build completo de Next.js/TypeScript.

## Despliegue y rollback

1. Ejecutar CI y preview de Vercel.
2. Reconstruir una rama limpia de Supabase con todas las migraciones.
3. Aplicar las tres migraciones en orden.
4. Desplegar aplicación.
5. Verificar `/api/health`, rutas administrativas y comerciales, logs y una creación controlada.
6. Ante fallo de aplicación, revertir el despliegue de Vercel. Las migraciones son aditivas; mantener columnas y tablas evita pérdida de datos. Deshabilitar los accesos de interfaz mientras se corrige el código.

No se recomienda revertir físicamente pedidos, movimientos o snapshots ya creados.
