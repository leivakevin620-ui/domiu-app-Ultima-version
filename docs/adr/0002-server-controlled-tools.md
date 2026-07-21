# ADR-0002: herramientas y autorización controladas por backend

- Estado: aceptado
- Fecha: 2026-07-21

## Contexto

Domi ejecuta consultas y prepara acciones para cuatro perfiles con límites diferentes. Confiar en rol, tenant, identificadores o precios enviados por el navegador permitiría acceso cruzado, manipulación financiera y escalamiento de privilegios.

## Decisión

Toda herramienta se registra y ejecuta en el servidor. El backend:

1. valida el JWT mediante Supabase Auth;
2. carga el perfil actual;
3. deriva rol, capacidades y tenant;
4. valida propiedad y estado de recursos;
5. vuelve a consultar precios, inventario y relaciones;
6. aplica confirmación, idempotencia y nivel de riesgo;
7. persiste resultado y auditoría.

Las herramientas son específicas por perfil. No aceptan SQL, nombres de tabla, filtros arbitrarios ni URLs. Los identificadores del cliente se consideran referencias no confiables hasta comprobarse contra el usuario o tenant autenticado.

Las mutaciones de Domi exigen JSON del mismo origen. RLS permanece activo como segunda barrera incluso cuando un servicio backend aplica filtros de propietario.

## Consecuencias

- El modelo y el navegador no pueden concederse permisos.
- Las consultas quedan limitadas y auditables.
- Las acciones sensibles pueden ser reintentadas sin duplicarse.
- Agregar una herramienta exige contrato, permiso, riesgo y pruebas de aislamiento.

## Alternativas rechazadas

- Un agente con acceso directo a Supabase.
- Autorización basada en rutas o componentes ocultos.
- Usar únicamente la clave de servicio sin filtros de propietario.
- Confirmaciones conservadas solo en memoria del proceso.
