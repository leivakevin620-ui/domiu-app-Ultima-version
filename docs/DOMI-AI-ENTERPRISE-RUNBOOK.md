# Runbook de producción — Domi AI Enterprise

## Objetivo

Procedimiento operativo para desplegar, vigilar, diagnosticar y revertir Domi sin comprometer pedidos, datos personales, permisos ni disponibilidad de DomiU.

## Puertas de lanzamiento

Un release solo puede avanzar cuando se cumplan simultáneamente:

- PR fusionable y sin conflictos.
- GitHub Actions verde: secretos, lint, auditoría npm, pruebas, TypeScript, Next.js y Docker.
- Migraciones aplicadas con éxito sobre una base temporal limpia.
- Vercel Preview en `READY` y sin errores `fatal` o `error`.
- `/api/health` en 200 con base de datos `ok`.
- `SUPABASE_SECRET_KEY` nueva configurada y clave legado revocada.
- Google Maps restringida por dominio y APIs permitidas.
- OpenAI configurado o fallback determinista verificado.

## Variables por entorno

Configurar las variables de `.env.example` en Development, Preview y Production. Los secretos no se copian entre entornos mediante archivos.

Obligatorias en producción:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

Mejora generativa:

- `DOMI_GENERATIVE_PROVIDER=openai`
- `DOMI_OPENAI_MODEL=gpt-5-mini`
- `OPENAI_API_KEY`
- `DOMI_SAFETY_SALT`

## Despliegue

1. Crear respaldo lógico o punto de restauración de Supabase.
2. Aplicar migraciones pendientes en orden cronológico.
3. Consultar que todas las tablas `domi_*` tengan RLS activo.
4. Confirmar ausencia de privilegios `anon` sobre tablas privadas.
5. Desplegar Preview desde el commit exacto del PR.
6. Ejecutar pruebas de humo autenticadas por cada rol.
7. Fusionar mediante squash usando el SHA validado.
8. Esperar `READY` en Vercel Production.
9. Consultar `/api/health`.
10. Revisar logs de runtime durante al menos 15 minutos.

## Pruebas de humo

### Cliente

- Abrir una conversación.
- Buscar un producto real.
- Consultar carrito y pedidos propios.
- Solicitar recomendación con presupuesto.
- Guardar y eliminar una preferencia.
- Activar voz, interrumpir y cerrar sesión.
- Evaluar una respuesta.

### Negocio

- Consultar pedidos, productos, inventario y métricas del negocio propio.
- Confirmar que no se accede a otro tenant.

### Repartidor

- Consultar asignaciones, jornada, ganancias y liquidaciones propias.
- Confirmar ausencia de pedidos ajenos.

### Administrador

- Abrir `/admin/domi`.
- Revisar métricas y candidato de aprendizaje.
- Aprobar, rechazar y publicar solo conocimiento no privado.

### Seguridad

- Enviar mutación desde origen distinto: debe responder 403.
- Enviar mutación no JSON: debe responder 415.
- Solicitar conversación de otro usuario: debe responder 404.
- Enviar prompt injection: debe bloquearse o ignorarse.
- Desactivar proveedor generativo: Domi debe continuar con fallback determinista.

## Observabilidad

Señales mínimas:

- Estado y latencia de `/api/health`.
- HTTP 5xx por ruta Domi.
- HTTP 429 de rate limiting.
- Errores de `domi.chat` en `audit_log`.
- Duración de solicitudes y herramientas.
- Proveedor generativo configurado/desactivado.
- Tokens de entrada, salida, caché y razonamiento en metadatos internos.
- Satisfacción positiva/negativa en `/admin/domi`.

Umbrales recomendados:

- Disponibilidad mensual: 99.9% para el núcleo determinista.
- p95 de herramientas de lectura: menor a 2.5 s.
- p95 de respuesta generativa: menor a 7 s; después aplica fallback.
- Errores 5xx: alerta al superar 1% durante 5 minutos.
- Fallos de autenticación anómalos: alerta por crecimiento de 3 veces la línea base.
- Auditorías bloqueadas por prompt injection: alerta si existe una concentración por IP o usuario.

## Incidentes

### Proveedor OpenAI degradado

1. Confirmar errores o timeouts en logs.
2. Mantener el fallback determinista; no desactivar Domi.
3. Cambiar `DOMI_GENERATIVE_PROVIDER` a `disabled` si el proveedor genera latencia sostenida.
4. Redesplegar y comprobar `domi.generativeEnhancement=disabled` en health.

### Supabase degradado

1. Confirmar `/api/health` 503.
2. Revisar estado de Supabase y conexiones.
3. Bloquear temporalmente mutaciones operativas si existe riesgo de inconsistencia.
4. Restaurar desde respaldo solo con evidencia de corrupción o pérdida.

### Secreto expuesto

1. Considerar la credencial comprometida inmediatamente.
2. Crear una nueva clave.
3. Actualizar Vercel y servicios backend.
4. Redesplegar y probar.
5. Revocar la clave anterior.
6. Buscar el secreto en historial, logs, artefactos y documentación.
7. Registrar el incidente y reforzar el escáner CI.

### Regresión de permisos

1. Desactivar el deployment afectado o revertir.
2. Conservar evidencias de auditoría.
3. Revisar RLS, filtros de propietario, tenant y rol.
4. Añadir una prueba que reproduzca el acceso indebido antes del nuevo despliegue.

## Rollback

Rollback de aplicación:

1. Promover el deployment de producción anterior en Vercel.
2. Verificar `/api/health` y los cuatro perfiles.
3. No revertir una migración destructiva automáticamente.

Rollback de base de datos:

- Las migraciones Enterprise deben ser aditivas e idempotentes.
- Para retirar una función, primero desplegar código compatible con ambos esquemas.
- Ejecutar una migración de reversión revisada; nunca editar una migración ya aplicada en producción.

## Cierre de release

Registrar:

- commit y deployment IDs;
- migración máxima aplicada;
- resultado de CI;
- resultado de pruebas de humo;
- incidencias conocidas;
- responsable y hora del despliegue;
- deployment de rollback.
