# Domi — Fase 3: conversaciones persistentes

Fecha: 18 de julio de 2026

## Objetivo

Convertir el chat de Domi en un sistema de conversaciones persistentes por usuario, con continuidad entre sesiones y dispositivos, sin mezclar el historial del hilo con la memoria personal autorizada.

## Alcance implementado

- Crear una conversación nueva y limpia.
- Recuperar automáticamente la conversación activa más reciente.
- Listar conversaciones activas, pausadas, completadas y archivadas.
- Buscar por título o resumen.
- Abrir conversaciones anteriores y recuperar sus mensajes.
- Renombrar conversaciones.
- Archivar y restaurar conversaciones.
- Eliminar una conversación y sus mensajes mediante confirmación explícita.
- Mantener resumen, objetivo activo, contexto de pantalla y fecha del último mensaje.
- Conservar la memoria personal en `domi_user_memory`, separada del historial de `domi_messages`.

## API

### `GET /api/domi/conversations`

Lista únicamente conversaciones del usuario autenticado. Admite `status`, `q` y `limit`.

### `POST /api/domi/conversations`

Crea un hilo vacío vinculado al usuario, rol y tenant resueltos por el servidor.

### `GET /api/domi/conversations/:id`

Devuelve la conversación y hasta 250 mensajes, siempre que pertenezca a la cuenta autenticada.

### `PATCH /api/domi/conversations/:id`

Permite renombrar o cambiar el estado a `active`, `paused`, `completed` o `archived`.

### `DELETE /api/domi/conversations/:id`

Elimina el hilo propio. Los mensajes se eliminan por la relación `ON DELETE CASCADE`.

## Seguridad

- Autenticación obligatoria en todos los endpoints.
- Filtro simultáneo por `id` y `user_id` en lectura, edición y eliminación.
- El rol y tenant se resuelven desde la sesión del servidor.
- Los títulos se limpian y limitan.
- No se acepta un `user_id` enviado por el navegador.
- Los enlaces recuperados de mensajes se vuelven a validar en la interfaz.
- Las respuestas usan `Cache-Control: no-store`.

## Base de datos

La migración agrega a `domi_conversations`:

- `tenant_id`
- `summary`
- `active_goal`
- `current_context`
- `last_message_at`
- `archived_at`

Un trigger actualiza automáticamente el resumen, objetivo, contexto y fecha del último mensaje después de cada inserción en `domi_messages`. También se amplía el estado permitido a:

- `active`
- `paused`
- `completed`
- `archived`

## Interfaz

El panel de Domi incorpora:

- Botón de historial.
- Botón de nueva conversación.
- Buscador de conversaciones.
- Indicador de estado y última actividad.
- Acciones para renombrar, archivar, restaurar y eliminar.
- Recuperación automática del hilo reciente.
- Compositor bloqueado para hilos no activos hasta que el usuario confirme su restauración.

## Exclusiones conscientes

Esta fase no incorpora todavía voz, notificaciones proactivas ni acciones de escritura sobre carrito o pedidos. Esas capacidades deben construirse sobre la continuidad y seguridad entregadas aquí.
