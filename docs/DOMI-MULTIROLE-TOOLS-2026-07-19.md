# Domi — herramientas seguras para todos los perfiles

Fecha: 2026-07-19

## Diagnóstico

La infraestructura de identidad, contexto, memoria, seguridad, auditoría y conversaciones ya estaba implementada. Sin embargo, el orquestador ejecutaba herramientas reales únicamente para el perfil cliente. Los mensajes para negocio, repartidor y administrador eran principalmente respuestas de conocimiento y no consultas operativas verificadas.

## Alcance de este bloque

Se incorpora un registro controlado y herramientas de lectura reales para los cuatro perfiles.

### Cliente

- Buscar catálogo.
- Validar y resumir carrito.
- Consultar historial de pedidos.
- Consultar seguimiento de un pedido propio.

### Negocio

- Consultar pedidos del negocio autenticado.
- Resumir inventario y detectar existencias bajas.
- Consultar ventas verificadas y productos más vendidos.
- Resumir reseñas públicas del negocio.

Todas las consultas se limitan a `context.tenantId`, obtenido desde un negocio cuyo propietario coincide con el usuario autenticado.

### Repartidor

- Consultar pedidos disponibles sin revelar datos del cliente.
- Consultar únicamente pedidos asignados al repartidor autenticado.
- Consultar ganancias propias.
- Consultar historial propio de entregas.

Las direcciones de entrega solo se consultan para pedidos cuyo `courier_id` coincide con `context.userId`.

### Administrador

- Consultar métricas agregadas de la plataforma.
- Resumir pedidos recientes y detectar pedidos detenidos.
- Consultar estado de negocios.
- Consultar estado operativo de repartidores.
- Consultar auditoría reciente con correos enmascarados.

Este bloque no exporta información personal ni ejecuta cambios sensibles.

## Registro de herramientas

Cada herramienta define:

- Nombre.
- Descripción.
- Roles autorizados.
- Permisos obligatorios.
- Riesgo.
- Requisito de confirmación.
- Tiempo máximo.
- Idempotencia.

Las herramientas de esta fase son lecturas de bajo riesgo, idempotentes y con tiempo máximo de ocho segundos.

## Seguridad

- Autorización por rol y por todos los permisos requeridos.
- Aislamiento del negocio mediante tenant.
- Aislamiento del repartidor mediante su identidad autenticada.
- Pedidos disponibles sin dirección de entrega ni teléfono del cliente.
- Auditorías administrativas con correos enmascarados.
- Sin operaciones `insert`, `update`, `delete` o `upsert` en las herramientas de esta fase.
- Registro de cada ejecución mediante la auditoría existente de Domi.
- Protección contra llamadas repetidas mediante el `requestId` idempotente ya implementado.

## Pruebas

Se agregaron pruebas para:

- Planificación de herramientas para cliente, negocio, repartidor y administrador.
- Denegación cuando falta un permiso.
- Denegación de herramientas administrativas a otros roles.
- Aislamiento de consultas por `tenantId` y `userId`.
- Ausencia de datos sensibles en pedidos disponibles.
- Enmascaramiento de correos en auditorías.
- Confirmación de que este bloque es exclusivamente de lectura.
- Build completo de Next.js y TypeScript.

## Límites todavía vigentes

Este bloque no habilita automáticamente acciones de riesgo medio o alto. Agregar al carrito, modificar inventario, cambiar estados, crear pedidos, suspender cuentas, reembolsar, cambiar permisos o enviar mensajes requieren un sistema de confirmaciones y validaciones reforzadas. Esas acciones deben implementarse en un bloque separado para no convertir una conversación en acceso directo e irrestricto a la base de datos.

## Rollback

- El ejecutor original de cliente se conserva en `customer-read-base.ts`.
- `customer-read.ts` actúa como adaptador compatible hacia el nuevo ejecutor multirrol.
- Para rollback se puede restaurar el blob anterior de `customer-read.ts` y el planificador anterior sin afectar tablas, conversaciones, memoria o migraciones.
