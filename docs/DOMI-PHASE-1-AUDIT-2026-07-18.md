# Domi — Fase 1: identidad, contexto, permisos y seguridad

Fecha: 18 de julio de 2026

## 1. Diagnóstico técnico

La implementación inicial de Domi ya contaba con autenticación, conversaciones por usuario, mensajes, memoria y artículos de conocimiento. Sin embargo, el endpoint solo utilizaba el rol básico, no construía un contexto seguro completo, no registraba auditoría por interacción, no tenía límite de solicitudes ni idempotencia y guardaba frases como «me gusta» o «prefiero» sin solicitar una confirmación adicional.

También se detectó que el cliente podía enviar una ruta o pantalla sin validación por perfil. Aunque esos valores no otorgaban permisos, era necesario sanearlos para impedir que una cuenta de cliente presentara contexto de administrador. Los errores internos de Supabase podían llegar a mostrarse de forma demasiado directa.

## 2. Arquitectura aplicada

La Fase 1 queda dividida en cuatro capas:

1. `src/lib/domi/security.ts`: normalización de roles, capacidades, validación del contexto del navegador, detección de intención, memoria y solicitudes maliciosas.
2. `src/lib/domi/server-context.ts`: construcción del contexto desde la sesión autenticada, perfil, tenant, cookies, IP y agente del navegador.
3. `src/lib/domi/server-security.ts`: rate limiting, idempotencia, confirmaciones de memoria y auditoría.
4. `src/app/api/domi/chat/route.ts`: orquestación segura de la conversación y formato estructurado de respuesta.

La interfaz `DomiAssistant` solo envía información contextual no autoritativa. La identidad, el rol, los permisos, el tenant, el estado de cuenta, el `sessionId` y el `requestId` se validan o generan en el servidor.

## 3. Modelo de permisos

Roles normalizados para Domi:

- `admin`: administración, operación, pedidos, negocios, repartidores, reportes, finanzas y auditoría.
- `merchant`: comercio, pedidos, catálogo, inventario, reportes y reseñas.
- `courier`: asignaciones, entregas, rutas, ganancias y soporte.
- `customer`: búsqueda, productos, carrito, pedidos, cupones y soporte.

Los roles administrativos especializados se normalizan como `admin` únicamente para el contexto conversacional. Esto no cambia el rol real ni amplía permisos en la base de datos.

La ruta enviada por el navegador se acepta únicamente cuando coincide con el perfil autenticado:

- Administrador: `/admin`
- Comercio: `/negocio`
- Repartidor: `/repartidor`
- Cliente: `/cliente`

## 4. Modelo de contexto

Cada solicitud genera un contexto con:

- `requestId`
- `sessionId` derivado de sesión autenticada y agente del navegador, sin almacenar el token original
- `userId`
- correo y nombre
- rol real y rol normalizado
- capacidades permitidas
- tenant de plataforma, comercio o cuenta personal
- estado de la cuenta
- ruta, módulo, pantalla, idioma y zona horaria saneados
- IP y agente del navegador para auditoría

Para comercios, el tenant se resuelve desde el negocio cuyo `owner_id` coincide con el usuario autenticado. Para administradores se utiliza el tenant de plataforma. Para clientes y repartidores se mantiene aislamiento por usuario.

## 5. Modelo de memoria

Reglas aplicadas:

- «Recuerda que…», «guarda…» o «memoriza…» se consideran autorización explícita.
- «Me gusta…» o «prefiero…» crean un candidato, pero no se guarda todavía.
- Domi solicita confirmación con opciones «Sí, recuérdalo» y «No lo guardes».
- La confirmación pendiente expira después de 30 minutos.
- La memoria se guarda únicamente con `user_id` del usuario autenticado.
- Las conversaciones no pueden confirmar recuerdos de otra cuenta.

## 6. Seguridad implementada

- Validación estricta con Zod y rechazo de campos desconocidos.
- Verificación de cuenta activa.
- Propiedad estricta de la conversación.
- Rate limit de 12 solicitudes por minuto y usuario.
- Idempotencia mediante `requestId` guardado en los metadatos del mensaje.
- Respuestas con `Cache-Control: no-store`.
- Protección contra prompt injection.
- Protección contra extracción de secretos.
- Protección contra escalamiento de privilegios por conversación.
- Protección contra solicitudes de datos de otros usuarios.
- Redacción del mensaje almacenado cuando la solicitud se bloquea por seguridad.
- Errores internos no expuestos al usuario.
- Auditoría en `audit_log` sin guardar el texto completo de la consulta.

## 7. Formato estructurado

Además del campo compatible `answer`, el endpoint entrega:

- `message`
- `intent`
- `role`
- `requiresTool`
- `tool`
- `toolArguments`
- `requiresConfirmation`
- `riskLevel`
- `memoryCandidate`
- `suggestedActions`
- `escalateToHuman`

Esto prepara el orquestador para las próximas fases sin permitir todavía herramientas de escritura.

## 8. Pruebas añadidas

Archivo: `src/lib/domi/security.test.ts`

Casos cubiertos:

- Normalización de roles administrativos y comerciales.
- Cliente intentando enviar una ruta administrativa.
- Validación de rutas permitidas por perfil.
- Prompt injection.
- Extracción de secretos.
- Escalamiento de privilegios.
- Diferencia entre preferencia y consentimiento explícito.
- Confirmación y rechazo natural de memoria.

## 9. Errores encontrados y correcciones

| Hallazgo | Corrección |
|---|---|
| Memoria automática sin confirmación suficiente | Flujo de candidato, confirmación y expiración |
| Contexto limitado al rol | Contexto seguro de sesión, tenant, pantalla e idioma |
| Sin rate limiting | 12 solicitudes por minuto por usuario |
| Sin idempotencia | `requestId` y recuperación de respuesta previa |
| Sin auditoría por mensaje | Registro en `audit_log` |
| Conversación ajena reemplazada silenciosamente | Respuesta 404 y auditoría de bloqueo |
| Mensajes maliciosos almacenados completos | Contenido redactado y motivo registrado |
| Errores internos visibles | Mensaje genérico y detalle solo en servidor |
| Cliente podía enviar cualquier ruta como contexto | Ruta limitada al prefijo del rol autenticado |

## 10. Próximo bloque

La Fase 2 debe implementar el catálogo de herramientas de cliente mediante servicios autorizados, comenzando por búsquedas de negocios y productos, lectura del carrito y consulta de pedidos. Cada herramienta deberá validar rol, permiso, tenant, entrada Zod, idempotencia, auditoría y nivel de riesgo antes de ejecutarse.
