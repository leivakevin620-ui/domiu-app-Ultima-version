# API de pedidos manuales

Todas las rutas requieren sesión autenticada con rol `admin` o `merchant`. Las escrituras aceptan únicamente solicitudes same-origin y responden con `Cache-Control: no-store`.

## GET `/api/manual-orders/bootstrap`

Parámetros opcionales:

- `businessId`: UUID. Administración puede seleccionar cualquier negocio permitido; comercio solo su negocio.

Devuelve actor, negocios, negocio seleccionado, sucursales, productos, variantes y repartidores elegibles cuando el actor es administrador.

## GET `/api/manual-orders/customers`

Parámetros:

- `q`: texto de búsqueda.
- `businessId`: UUID.

Un comercio solo recibe clientes previamente vinculados a pedidos de su negocio. Administración puede buscar clientes de la plataforma. El teléfono por sí solo no concede acceso a pedidos.

## POST `/api/manual-orders/quote`

Cuerpo validado por `manualOrderPayloadSchema`. Reconsulta productos, variantes, precios, descuentos, inventario y configuración financiera. Devuelve artículos normalizados, subtotal, domicilio, servicio, total, tiempo y advertencias.

No recibe ni utiliza `subtotal` o `totalAmount` del navegador.

## POST `/api/manual-orders/confirm`

Header obligatorio:

```text
Idempotency-Key: manual:<uuid>
```

Confirma mediante `confirm_manual_order(...)`. La función ejecuta validaciones y cambios dentro de una transacción PostgreSQL. Repetir la misma clave y contenido devuelve el pedido existente. La misma clave con contenido diferente devuelve conflicto.

## GET `/api/manual-orders/drafts`

Lista únicamente borradores propios no expirados. Puede filtrarse por `businessId`.

## POST `/api/manual-orders/drafts`

Crea o actualiza un borrador. La actualización usa `version` como control optimista. Un conflicto requiere recargar antes de sobrescribir.

## DELETE `/api/manual-orders/drafts/:id`

Marca un borrador propio como eliminado.

## Errores

Formato:

```json
{
  "error": "Mensaje comprensible",
  "code": "identificador_estable",
  "issues": [{ "path": "campo", "message": "Corrección" }]
}
```

No se exponen trazas, consultas SQL ni secretos.
