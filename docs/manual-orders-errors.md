# Política de errores

- Validación: 400 con `issues` por campo.
- Autenticación: 401.
- Rol o tenant: 403.
- Recurso inexistente: 404.
- Conflicto de versión, inventario o idempotencia: 409.
- Rate limiting: 429.
- Configuración faltante: 503.
- Error interno: 500 con mensaje genérico.

Las respuestas no incluyen `DETAIL`, `CONTEXT`, SQL, stack traces o secretos. Los errores operativos de PostgreSQL se recortan antes de enviarse.
