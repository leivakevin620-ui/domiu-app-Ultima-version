# DomiU Magdalena — Bitácora Oficial de Desarrollo

> Documento vivo y fuente oficial del proceso de construcción de DomiU Magdalena.

## 1. Propósito

Registrar de forma continua y verificable:

- avances funcionales y técnicos;
- decisiones de arquitectura;
- cambios y migraciones de base de datos;
- errores encontrados y correcciones;
- pruebas ejecutadas y resultados;
- pendientes, riesgos y próximos pasos.

## 2. Estado confirmado del proyecto

**Última actualización:** 14 de julio de 2026.

- Repositorio oficial: `leivakevin620-ui/domiu-app-Ultima-version`.
- Rama de integración: `release/jueves-2026-07-16`.
- Next.js 16.2.9, React 19 y TypeScript.
- Supabase oficial: `DomiU App 1.0`.
- Build de producción aprobado.
- TypeScript aprobado.
- 82 rutas generadas por el build actual.
- 161 pruebas automatizadas aprobadas en la validación base.
- Perfiles verificados: `admin`, `merchant`, `customer` y `courier`.
- Inicio de sesión, redirección por rol y `/api/profile` verificados en la validación base.
- Vercel preview de la rama de lanzamiento en estado `READY`.

## 3. Seguridad y base de datos

### Controles existentes

- Políticas RLS para perfiles, negocios, solicitudes, pedidos, repartidores, wallets, chats y notificaciones.
- Protección frente a escalamiento de privilegios.
- Restricción de funciones internas.
- Auditoría administrativa y operativa.
- Optimización de políticas mediante `(SELECT auth.uid())`.

### Migraciones aplicadas el 14 de julio de 2026

#### `business_application_approval_guard`

- Índice único parcial para impedir que una misma solicitud cree más de un negocio activo.
- Protección frente a aprobaciones administrativas concurrentes.

#### `secure_order_acceptance_and_internal_functions`

- Trigger que impide que un segundo repartidor sobrescriba al primero después de aceptar un pedido.
- Bloqueo de aceptaciones desde estados no disponibles.
- Retiro de ejecución `PUBLIC`, `anon` y `authenticated` de:
  - `accept_available_order`;
  - `auto_create_commission`;
  - `log_order_status_change`.
- Acceso reservado para `service_role`.

### Prueba de concurrencia ejecutada

Se simuló una primera aceptación y un segundo intento sobre el mismo pedido dentro de una transacción controlada. El segundo intento fue bloqueado y el rollback dejó el pedido original intacto en estado `ready` y sin repartidor.

## 4. Fase 1 — Gestión completa de negocios

**Estado:** Completada técnicamente.

### Funcionalidad terminada

1. Solicitud de registro de negocio.
2. Captura y validación de información comercial.
3. Carga y revisión de documentos.
4. Revisión administrativa.
5. Aprobación o rechazo con motivo.
6. Creación automática e idempotente del negocio aprobado.
7. Asignación y reasignación segura del propietario.
8. Configuración inicial del negocio.
9. Activación, suspensión y reactivación.
10. Auditoría de acciones administrativas.
11. Protección RLS y validaciones de servidor.
12. Conservación de metadatos existentes.
13. Rollback de negocio, dirección, horarios y perfil ante errores parciales.
14. Prevención de aprobaciones duplicadas o simultáneas.

### Correcciones críticas realizadas

- Las acciones administrativas ya no reemplazan por completo los metadatos existentes.
- La aprobación bloquea la solicitud antes de crear recursos.
- El rechazo confirma que realmente modificó una solicitud pendiente.
- La creación y reasignación de negocios restauran el estado anterior cuando ocurre un error.
- Las solicitudes incompletas no pueden crear un negocio.

## 5. Domicilios manuales creados por negocios

**Estado:** Completado e integrado.

### Nueva ruta

`/negocio/domicilios/crear`

### Capacidades

- Registro de cliente y teléfono.
- Reutilización del cliente cuando el teléfono ya existe.
- Creación controlada de perfil temporal cuando el cliente es nuevo.
- Registro de dirección de entrega.
- Cálculo de ruta, distancia, tiempo y tarifa.
- Fallback para ingresar distancia y tarifa manualmente.
- Creación de pedido `manual_delivery` en estado `pending`.
- Publicación automática para repartidores disponibles.
- Cálculo de ganancias del repartidor y de DomiU.
- Registro de tracking inicial.
- Notificación a administradores.
- Auditoría del creador.
- Limpieza automática de pedido, dirección y usuario temporal ante fallos.

### Correcciones del listado `/negocio/domicilios`

- La dirección se obtiene desde `addresses`, no desde una columna inexistente de `orders`.
- El nombre del repartidor se obtiene desde `profiles`, no desde `drivers`.
- Se añadió actualización automática cada 15 segundos.
- Se añadieron manejo de errores, detalle expandible y acceso directo a `Nuevo domicilio`.

## 6. Validaciones del 14 de julio de 2026

- Vercel build: aprobado.
- Compilación Next.js: aprobada.
- TypeScript: aprobado.
- Generación de 82 rutas: aprobada.
- Migraciones Supabase: aplicadas correctamente.
- Permisos de funciones internas: verificados.
- Trigger de aceptación concurrente: verificado con rollback.
- Errores de runtime en la ventana revisada: ninguno.

## 7. Deuda técnica y controles no bloqueantes

- `npm install` informa dos vulnerabilidades moderadas; deben revisarse con `npm audit` antes de una auditoría formal de seguridad. No impidieron el build.
- Supabase recomienda habilitar protección contra contraseñas filtradas desde la configuración de Auth.
- Las advertencias sobre `spatial_ref_sys` y PostGIS corresponden a la extensión geoespacial y deben tratarse siguiendo la guía oficial de Supabase, sin modificar tablas internas a ciegas.
- La arquitectura multitenant propuesta permanece diferida hasta contar con staging, inventario de filas sin tenant y pruebas de migración.

## 8. Cierre antes de producción pública

Antes de abrir la app a usuarios reales se debe completar un smoke test manual con las cuatro cuentas de prueba:

1. Cliente crea pedido de productos.
2. Negocio confirma, prepara y publica el pedido.
3. Repartidor acepta, recoge, transporta y entrega.
4. Administrador verifica estados, auditoría y finanzas.
5. Negocio crea un domicilio manual y el repartidor lo acepta.
6. Se comprueba Google Maps/geocodificación con variables de producción.
7. Se confirma correo, notificaciones y políticas legales visibles.

Este smoke test es el último control operativo; el código de la Fase 1 y el módulo de domicilios manuales ya están integrados y compilando correctamente.

## 9. Registro cronológico

### 13 de julio de 2026

- Creación de la bitácora oficial.
- Inicio formal de la Fase 1.
- Validación base de build, pruebas, Supabase y roles.

### 14 de julio de 2026

- Auditoría de GitHub, Vercel y Supabase.
- Identificación de la rama de lanzamiento con cambios posteriores a `master`.
- Corrección de concurrencia e idempotencia en solicitudes de negocio.
- Conservación de metadatos y rollback en gestión de negocios.
- Aplicación del índice único por solicitud aprobada.
- Cierre de funciones internas expuestas a usuarios anónimos.
- Protección de aceptación concurrente de pedidos.
- Implementación del flujo de domicilios manuales desde el negocio.
- Reparación del listado de domicilios.
- Build final de la rama de lanzamiento aprobado.
