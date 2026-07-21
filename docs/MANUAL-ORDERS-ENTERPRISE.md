# Pedidos manuales Enterprise

## Alcance

Este módulo registra pedidos recibidos fuera de la aplicación del cliente desde:

- Panel administrativo: `/admin/pedidos/crear`.
- Panel del negocio: `/negocio/pedidos/crear`.

Los pedidos creados por WhatsApp, llamada, atención presencial o redes sociales entran a la misma tabla `orders`, usan `order_items`, participan en el flujo normal de estados y conservan trazabilidad completa de su origen.

## Flujo funcional

1. Seleccionar el negocio autorizado.
2. Seleccionar un cliente registrado o registrar un invitado mediante snapshot.
3. Resolver una sucursal activa del negocio.
4. Seleccionar domicilio o recogida en el local.
5. Agregar productos del catálogo autorizado o artículos personalizados permitidos.
6. Calcular la tarifa automática o registrar una sobrescritura manual con motivo.
7. Registrar forma y estado de pago.
8. Revisar el resumen y confirmar explícitamente.
9. Revalidar actor, negocio, sucursal, catálogo, precios, inventario y valores en backend.
10. Crear el pedido y sus artículos dentro de una transacción PostgreSQL.
11. Registrar seguimiento, auditoría y notificaciones tolerantes a fallos.
12. Eliminar el borrador convertido.

## Arquitectura

### Interfaz compartida

`src/components/manual-orders/ManualOrderWorkspace.tsx`

La misma interfaz atiende administración y negocios. El parámetro `panel` controla las capacidades visibles, mientras que las autorizaciones definitivas se ejecutan en servidor.

### Dominio y validación

`src/lib/orders/manual-order-domain.ts`

Contiene:

- Esquemas Zod del pedido.
- Reglas para invitados y clientes registrados.
- Restricciones de domicilio y recogida.
- Regla que impide asignar repartidor a una recogida.
- Reglas para tarifa manual y canal `other`.
- Validación de artículos personalizados.
- Cálculo entero de valores en COP.
- Traducción segura de errores de dominio y PostgreSQL.

### Acciones de servidor

`src/app/actions/manual-orders.ts`

Responsabilidades:

- Resolver el actor autenticado.
- Comprobar rol y permiso `manage_orders`.
- Aislar negocios por propietario para el panel de comercio.
- Consultar catálogo y clientes autorizados.
- Guardar, recuperar y eliminar borradores.
- Recalcular precios, tarifa y total.
- Invocar la creación SQL transaccional.
- Registrar auditoría sin exponer trazas internas.

`src/app/actions/order-panel.ts`

Responsabilidades:

- Construir listados compatibles con snapshots e invitados.
- Mostrar artículos personalizados aunque no tengan `product_id`.
- Aplicar transiciones de estado permitidas en servidor.
- Evitar cambios directos de estado desde el navegador.

### Persistencia

Migraciones principales:

- `20260721120000_manual_orders_enterprise.sql`.
- `20260721120500_manual_order_idempotency_fingerprint.sql`.
- `20260721121000_restore_manual_order_inventory.sql`.
- `20260721121500_manual_order_notifications.sql`.
- `20260721122000_manual_order_rls_hardening.sql`.
- `20260721122500_manual_order_delivery_compatibility.sql`.
- `20260721123000_manual_order_final_amounts.sql`.
- `20260721123500_manual_guest_payment_transactions.sql`.
- `20260721124000_guest_safe_order_status_notifications.sql`.
- `20260721124500_private_manual_order_rls_helper.sql`.

La función `create_manual_order_atomic(jsonb, jsonb)`:

- Solo concede ejecución a `service_role`.
- Serializa solicitudes con la misma clave de idempotencia.
- Rechaza una misma clave usada con contenido diferente.
- Bloquea productos mediante `FOR UPDATE`.
- Valida que todos los productos pertenezcan al negocio.
- Usa el precio vigente de la base de datos.
- Verifica stock antes de insertar.
- Descuenta inventario en la misma transacción.
- Inserta snapshots de producto y valores históricos.
- Revierte toda la operación ante cualquier error.

## Clientes invitados

Un invitado no crea un usuario en Supabase Auth ni un perfil artificial. El pedido conserva en `guest_customer_snapshot`:

- Nombre.
- Teléfono.
- Correo opcional.
- Notas autorizadas.

La transacción de pago conserva una copia inmutable en `payment_transactions.customer_snapshot`; `customer_id` permanece nulo. El número telefónico por sí solo no concede acceso al pedido ni a la transacción. La vinculación posterior con un cliente registrado debe ser una operación administrativa independiente y auditada.

## Sucursales, entrega y cobertura

Todo pedido manual resuelve una fila activa de `business_addresses` perteneciente al negocio. Cuando `branch_id` no se envía, PostgreSQL usa primero la sede principal activa.

Para domicilio:

- La tarifa automática usa la configuración activa en `delivery_pricing_settings`.
- La base de datos vuelve a calcular la tarifa y el total final.
- La cobertura se contrasta con `service_radius_km` cuando existe distancia.
- Un administrador puede continuar fuera de cobertura únicamente con motivo administrativo.
- Una tarifa manual exige motivo y queda marcada como sobrescrita.

Para recogida:

- La tarifa se fuerza a cero.
- No se permite repartidor.
- La dirección de entrega se reemplaza por el snapshot de la sucursal.
- El tiempo estimado usa la preparación del negocio.

## Snapshots históricos

El pedido congela información que podría cambiar después:

- Cliente.
- Dirección.
- Negocio y sucursal.
- Nombre, SKU y precio de cada producto.
- Variantes y modificadores.
- Canal de venta.
- Fuente y motivo de la tarifa de domicilio.

Los listados del panel priorizan el snapshot y usan las relaciones actuales solo como respaldo.

## Inventario

La confirmación bloquea cada producto, comprueba disponibilidad y descuenta existencias atómicamente. Cuando un pedido manual cambia por primera vez a `cancelled`, un trigger restaura el inventario y registra `manual_inventory_restored_at` en los metadatos para impedir restauraciones duplicadas.

Los borradores no descuentan ni reservan inventario.

## Idempotencia

Cada confirmación usa un UUID de idempotencia y una huella SHA-256 de la carga validada.

- Misma clave y misma carga: devuelve el pedido existente.
- Misma clave y carga distinta: rechaza la operación.
- Doble clic o reintento concurrente: se serializa mediante advisory lock.

## Pagos y distribución

Crear un pedido no lo marca como pagado automáticamente. Los estados admitidos en este primer flujo son:

- `pending`.
- `completed`, únicamente cuando `paid_amount` coincide con el total final calculado por la base de datos.

Un pago parcial permanece `pending` y se identifica mediante `paid_amount`, `outstanding_amount` y metadatos operativos.

Para domicilio, el valor final de la tarifa se distribuye en PostgreSQL:

- 80 % para el repartidor.
- 20 % para DomiU.

Para recogida, ambas ganancias logísticas se fuerzan a cero.

## Seguridad

- Autenticación validada mediante `supabase.auth.getUser()`.
- Operaciones privilegiadas server-side.
- El navegador nunca recibe `SUPABASE_SECRET_KEY` ni `service_role`.
- El comercio queda limitado a negocios cuyo `owner_id` coincide con el actor.
- Administración requiere un rol administrativo con `manage_orders`.
- Los productos se consultan nuevamente en backend.
- Los totales y precios enviados por frontend se ignoran.
- Un trigger rechaza inserciones directas de pedidos manuales realizadas por `authenticated`.
- Los campos de actor, tenant, snapshots, tarifa, totales e idempotencia quedan administrados por servidor.
- Los borradores tienen RLS por actor y negocio autorizado.
- El helper RLS vive en el esquema `private`, no como RPC público.
- Las transiciones se validan con estado actual y actualización condicional.
- Los errores devueltos al usuario no incluyen trazas internas.
- Las notificaciones para invitados no crean identidad ni acceso por teléfono.

## Pruebas automatizadas

`src/lib/orders/manual-order-domain.test.ts` cubre:

- Invitado sin identidad de autenticación.
- Motivo administrativo obligatorio.
- Motivo obligatorio al sobrescribir tarifa.
- Recogida sin tarifa de domicilio.
- Recogida sin repartidor.
- Descripción del canal `other`.
- Cálculos enteros en COP.
- Normalización de teléfono.

`src/lib/orders/delivery-pricing.test.ts` comprueba que la vista previa coincida con la fórmula activa de PostgreSQL: tarifa base de 5.000 COP hasta 2 km, 1.200 COP por kilómetro adicional y redondeo ascendente a 500 COP.

Los workflows `.github/workflows/manual-orders-ci.yml` y `.github/workflows/domi-ci.yml` ejecutan pruebas, escaneo de secretos, lint, auditoría npm, build de Next.js y, en la suite completa, construcción Docker.

## Validación real en Supabase Preview

Las migraciones se aplicaron en la rama preview del PR #34. Las verificaciones SQL se ejecutaron dentro de transacciones con `BEGIN` y `ROLLBACK`, por lo que no dejaron datos de prueba.

### Pedido con domicilio y producto de catálogo

Validado:

- Precio manipulado desde la solicitud ignorado.
- Dos productos de 10.000 COP: subtotal final de 20.000 COP.
- Distancia de 3,2 km: tarifa final de 6.500 COP.
- Total y saldo pendiente de 26.500 COP.
- Ganancia repartidor de 5.200 COP y DomiU de 1.300 COP.
- Cliente invitado sin `customer_id`.
- Snapshot de pago invitado y monto final correcto.
- Inventario de 10 a 8 unidades.
- Repetición idempotente sin segundo descuento.
- Misma clave con contenido diferente rechazada.
- Cancelación restaura stock de 8 a 10 una sola vez.

### Recogida y artículo personalizado

Validado:

- Tarifa manipulada forzada a cero.
- Sin repartidor ni ganancias logísticas.
- Artículo personalizado sin `product_id` y con snapshot histórico.
- Subtotal de 21.000 COP y total de 22.500 COP incluyendo propina y recargo.

### Seguridad y RLS

Validado:

- Inserción directa autenticada con actor, negocio y totales falsificados rechazada.
- Borrador permitido para negocio propio.
- Borrador de otro negocio rechazado.
- Un comercio solo visualiza su borrador autorizado.
- La advertencia del asesor causada por el helper RLS público fue eliminada al moverlo al esquema `private`.

El asesor de seguridad aún reporta problemas históricos fuera de este módulo, entre ellos una vista `SECURITY DEFINER`, funciones antiguas con `search_path` mutable, funciones antiguas ejecutables por roles amplios y políticas preexistentes demasiado permisivas. El estado de este módulo no implica que toda la base heredada esté libre de hallazgos.

## Despliegue

1. Rotar la credencial histórica comprometida antes de fusionar.
2. Configurar `SUPABASE_SECRET_KEY` únicamente en servidor y Vercel.
3. Aplicar las migraciones en preview.
4. Ejecutar reconstrucción limpia de Supabase.
5. Probar un invitado, un cliente registrado, domicilio, recogida y cancelación desde la interfaz.
6. Confirmar que el inventario se descuenta y restaura exactamente una vez.
7. Revisar auditoría y listados en ambos paneles.
8. Promover a producción solo después de que CI y la verificación de preview sean satisfactorios.

## Estado de implementación

El dominio y la persistencia están validados en la base preview. El PR debe permanecer en borrador hasta que lint, TypeScript, build, suite completa, preview web y rotación de la credencial histórica estén verificados. No debe declararse desplegado ni 100 % funcional antes de esas evidencias.
