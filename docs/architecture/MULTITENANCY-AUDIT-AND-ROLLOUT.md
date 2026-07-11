# Auditoría e implementación multi-tenant de DomiU

**Estado:** Fase 2 de aplicación preparada  
**Fecha:** 2026-07-11  
**Rama:** `docs/arquitectura-oficial-domiu`

## 1. Objetivo

Introducir una base multi-tenant sin romper el funcionamiento actual de DomiU App 1.2 Release Candidate.

La primera fase crea las entidades estructurales, registra un tenant predeterminado para la operación existente y agrega `tenant_id` de forma compatible a tablas operativas que ya existan.

## 2. Implementación incorporada

### Foundation SQL

- `tenants`
- `tenant_memberships`
- `cities`
- `zones`
- tenant predeterminado `domiu-magdalena`
- ciudad inicial `Ciénaga`
- funciones auxiliares de tenant
- backfill de `tenant_id`
- RLS para entidades nuevas

### Tenant Context de servidor

Archivo: `src/lib/tenancy/server-tenant.ts`

- Resuelve tenant desde el negocio, membresía o tenant predeterminado.
- Nunca acepta `tenant_id` directamente desde el navegador.
- Comprueba estado del tenant.
- Expone el origen de la resolución para trazabilidad.

### Creación segura de pedidos

Archivo: `src/app/actions/create-order.ts`

- Requiere sesión autenticada.
- Usa el usuario de la sesión como cliente real.
- Resuelve el tenant desde el negocio.
- Valida que negocio y productos pertenezcan al mismo tenant.
- Impide productos de varios negocios en un mismo pedido.
- Revalida precios, disponibilidad, subtotal y total en servidor.
- Propaga `tenant_id` a dirección, pedido, items y tracking.

`OrderContext` ahora utiliza esta Server Action en lugar de insertar el pedido directamente desde el navegador.

### Integridad en PostgreSQL

Migración: `2026071002_tenant_order_propagation.sql`

- Agrega `tenant_id` a `order_tracking`.
- Deriva el tenant del pedido desde el negocio.
- Deriva el tenant de items y tracking desde el pedido.
- Rechaza discrepancias de tenant.
- Rechaza productos pertenecientes a otro negocio.

## 3. Reglas de seguridad

1. `tenant_id` nunca se confía desde el frontend.
2. El servidor lo resuelve desde datos persistidos.
3. PostgreSQL vuelve a validar las relaciones mediante triggers.
4. Un pedido solo contiene productos de un negocio.
5. Los precios enviados por el navegador se revalidan.
6. Las membresías suspendidas o revocadas no conceden acceso.
7. Esta fase no reemplaza todavía todas las políticas RLS heredadas.

## 4. Orden de aplicación en staging

```bash
supabase db push
npm run lint
npm run test
npm run build
```

Después ejecutar:

```sql
select slug, name, status from public.tenants;
select count(*) from public.tenant_memberships;

select count(*) from public.orders where tenant_id is null;
select count(*) from public.order_items where tenant_id is null;
select count(*) from public.order_tracking where tenant_id is null;

select o.id
from public.orders o
join public.businesses b on b.id = o.business_id
where o.tenant_id is distinct from b.tenant_id;
```

## 5. Criterios de aprobación

- Ambas migraciones se aplican sin errores en staging.
- Los datos existentes conservan su funcionamiento.
- No hay pedidos, items ni tracking con tenant incorrecto.
- La creación de pedidos funciona desde checkout.
- Un producto de otro negocio es rechazado.
- Precios alterados desde el navegador son rechazados.
- Lint, pruebas y build pasan.
- Las políticas RLS actuales no bloquean el flujo existente.

## 6. Pendiente antes de producción

- Aplicar las migraciones en Supabase staging.
- Actualizar los tipos generados de Supabase.
- Añadir pruebas automatizadas para `createTenantOrderAction`.
- Implementar RLS multi-tenant estricta tabla por tabla.
- Adaptar creación de negocios, productos, promociones y wallets.
- Incluir tenant en caché, auditoría y notificaciones.
- Resolver transacción atómica de pedido + items mediante RPC para eliminar compensación manual.
