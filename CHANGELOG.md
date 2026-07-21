# Changelog

## [Unreleased] — Domi AI Enterprise y pedidos manuales

### Added

- Orquestador conversacional modular y motor de intenciones con presupuestos en COP.
- Herramientas controladas para cliente, negocio, repartidor y administrador.
- Conversaciones, contexto, objetivos, memoria y resúmenes persistentes.
- Recomendaciones con inventario, operación del negocio, precios, descuentos y favoritos.
- Borradores reversibles de carrito y pedido sin ejecutar pagos.
- Voz mediante Web Speech API sin almacenamiento de audio.
- Proactividad consentida y aprendizaje supervisado desde `/admin/domi`.
- Capa generativa opcional con Responses API y fallback determinista.
- Validación de respuestas generativas contra hechos verificados.
- Reintentos transitorios, deadline, prompt cache y métricas de uso.
- Protección CSRF por mismo origen para todas las mutaciones de Domi.
- CSP, HSTS, Permissions Policy y headers de aislamiento.
- Docker multi-stage standalone con usuario no privilegiado.
- Runbook de producción, ADRs, documentación de APIs y variables.
- Pruebas de proveedor, fallback, CSRF, autenticación, proxy, headers, health y Docker.
- Creación manual de pedidos desde administración y desde el panel del negocio.
- Clientes invitados mediante snapshots históricos, sin crear cuentas artificiales de autenticación.
- Productos de catálogo y artículos personalizados autorizados por configuración o rol.
- Borradores de pedidos manuales persistentes, recuperables y con expiración.
- Creación SQL transaccional con validación de catálogo, bloqueo de inventario e idempotencia.
- Restauración automática y única del inventario cuando un pedido manual se cancela.
- Vistas de pedidos compatibles con invitados, direcciones congeladas y artículos personalizados.

### Changed

- Autenticación server-side basada exclusivamente en `supabase.auth.getUser()`.
- Backend compatible con `SUPABASE_SECRET_KEY` moderna.
- Proxy elimina encabezados internos enviados por clientes.
- Health check minimiza información pública y reduce costo de consulta.
- CI valida lint, secretos, dependencias, pruebas, build y Docker.
- `shadcn` permanece como dependencia de desarrollo y las dependencias transitivas vulnerables fueron corregidas.
- Los cambios de estado de pedidos desde negocio y administración se validan ahora en servidor mediante una matriz de transiciones.
- Los totales, precios vigentes y tarifa automática de los pedidos manuales se recalculan en backend antes de confirmar.

### Security

- Eliminados archivos de entorno versionados.
- Añadido escáner de secretos al repositorio.
- Reconstrucción limpia de Supabase con RLS para todas las tablas Domi.
- Retirados privilegios `anon` de las tablas privadas.
- Bloqueadas respuestas generativas con secretos, enlaces, instrucciones internas o cifras inventadas.
- Endurecidas actualizaciones concurrentes del aprendizaje supervisado y sesiones de voz.
- La función transaccional de pedidos manuales solo puede ejecutarse con `service_role` desde acciones de servidor autorizadas.
- El comercio solo puede crear, consultar y cambiar pedidos pertenecientes a sus propios negocios.
- Las claves de idempotencia se serializan y rechazan reutilizaciones con una carga diferente.

### Deployment blocker

La clave legado `service_role` expuesta históricamente debe ser reemplazada por una nueva `SUPABASE_SECRET_KEY`, verificada en Vercel y revocada antes de fusionar a producción.
