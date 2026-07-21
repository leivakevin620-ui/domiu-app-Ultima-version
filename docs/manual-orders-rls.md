# Seguridad y RLS — pedidos manuales

## Principio

La interfaz nunca determina actor, rol, tenant o creador. Las APIs reconstruyen la sesión y la función SQL vuelve a verificar el actor y la propiedad del negocio.

## Tablas existentes

Los pedidos y artículos siguen las políticas actuales de participantes. Los pedidos invitados no son visibles para una cuenta solo por compartir teléfono; `customer_id` permanece nulo hasta una vinculación autorizada.

## Tablas nuevas

### `manual_order_drafts`

- RLS activo.
- Lectura para el creador o administrador.
- Escrituras mediante backend de servicio después de comprobar actor y tenant.
- No se conceden INSERT, UPDATE o DELETE directos a `authenticated`.

### `manual_order_inventory_movements`

- RLS activo.
- Lectura para administrador o propietario del negocio del pedido.
- Escrituras solo desde la transacción y trigger de servicio.

## Función privilegiada

`confirm_manual_order(uuid,jsonb,text)`:

- `SECURITY DEFINER`.
- `search_path` fijado a `public, pg_temp`.
- Sin permiso para `public`, `anon` o `authenticated`.
- `EXECUTE` únicamente para `service_role`.
- Valida actor activo, rol, negocio, sucursal, cliente, producto, variante, inventario, repartidor y ajustes.

## CSRF

Todas las escrituras validan `Origin`, `Host` y `Sec-Fetch-Site`. La autenticación depende de cookies Supabase SameSite y verificación server-side.

## Información sensible

Los snapshots incluyen solo datos operativos necesarios. No guardan contraseña, PIN, CVV, número de tarjeta, token o clave privada. Las notas internas no se incluyen en los servicios de lectura para repartidores.
