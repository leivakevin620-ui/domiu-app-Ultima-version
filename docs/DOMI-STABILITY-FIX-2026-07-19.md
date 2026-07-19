# Domi — corrección definitiva de estabilidad

Fecha: 2026-07-19

## Problema encontrado

La interfaz anterior de Domi ejecutaba `useMemo` después de una salida condicional basada en `mounted`, `isLoading` y `profile`. El primer render no ejecutaba ese hook y el siguiente sí, provocando el error de React por cambio en el orden o cantidad de hooks. Como Domi estaba montada dentro de los proveedores raíz, el fallo podía activar la pantalla global de error y bloquear el acceso a toda la aplicación.

## Correcciones aplicadas

1. Se creó `DomiAssistantStable`, con todos los hooks ejecutados de forma incondicional antes de cualquier salida anticipada.
2. Se creó `DomiAssistantHost`, con un Error Boundary exclusivo para Domi. Un fallo futuro del asistente queda aislado y no derriba DomiU.
3. Se reactivó Domi desde `RootProviders` mediante el host seguro.
4. Se añadió navegación segura por perfil:
   - Cliente: `/cliente`.
   - Negocio: `/negocio`.
   - Repartidor: `/repartidor`.
   - Administrador: `/admin`.
5. Se bloquearon enlaces externos, rutas escapadas, barras inversas, duplicados y navegación hacia áreas de otros perfiles.
6. Se validan UUID y cantidades del carrito antes de enviar contexto al servidor, evitando rechazos por datos demo o corruptos.
7. Se añadió lectura resistente de respuestas HTTP, mensajes claros para sesión expirada, falta de permisos, límite de solicitudes y errores temporales.
8. Se evitó el envío duplicado mediante un bloqueo en memoria mientras una solicitud está activa.
9. Se restablece de forma segura el estado de Domi al cambiar de usuario o cerrar sesión.
10. Se conservaron historial, renombrado, búsqueda, archivado, eliminación, restauración, continuidad y nueva conversación.

## Pruebas añadidas

- Aislamiento de navegación por rol.
- Bloqueo de URLs externas y rutas escapadas.
- Normalización segura de mensajes y acciones.
- Filtrado de contexto inválido del carrito.
- Regresión de hooks durante los estados cargar → autenticar → cerrar sesión.

## Rollback

La interfaz anterior permanece en `src/components/domi/DomiAssistant.tsx`, pero ya no se monta. Para volver temporalmente al estado de mitigación, se puede retirar `<DomiAssistantHost />` de `RootProviders`. No se modificaron ni eliminaron tablas, APIs, conversaciones, mensajes ni memoria persistente.

## Validaciones obligatorias antes de producción

- Domi CI en verde.
- Vercel Preview en estado READY.
- `npm run build` sin errores TypeScript.
- Pruebas nuevas y existentes aprobadas.
- Verificación HTTP de `/login` y `/api/health`.
- Prueba manual autenticada: abrir Domi, enviar mensaje, recuperar historial, crear conversación, archivar y restaurar.
