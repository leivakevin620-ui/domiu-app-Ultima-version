# Changelog

## [Unreleased] — Domi AI Enterprise

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

### Changed

- Autenticación server-side basada exclusivamente en `supabase.auth.getUser()`.
- Backend compatible con `SUPABASE_SECRET_KEY` moderna.
- Proxy elimina encabezados internos enviados por clientes.
- Health check minimiza información pública y reduce costo de consulta.
- CI valida lint, secretos, dependencias, pruebas, build y Docker.
- `shadcn` permanece como dependencia de desarrollo y las dependencias transitivas vulnerables fueron corregidas.

### Security

- Eliminados archivos de entorno versionados.
- Añadido escáner de secretos al repositorio.
- Reconstrucción limpia de Supabase con RLS para todas las tablas Domi.
- Retirados privilegios `anon` de las tablas privadas.
- Bloqueadas respuestas generativas con secretos, enlaces, instrucciones internas o cifras inventadas.
- Endurecidas actualizaciones concurrentes del aprendizaje supervisado y sesiones de voz.

### Deployment blocker

La clave legado `service_role` expuesta históricamente debe ser reemplazada por una nueva `SUPABASE_SECRET_KEY`, verificada en Vercel y revocada antes de fusionar a producción.
