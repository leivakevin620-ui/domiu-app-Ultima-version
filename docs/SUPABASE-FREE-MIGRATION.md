# Migración de DomiU al Supabase gratuito

## Proyectos

- Origen: `vuwaqmwgvldqmmgkpyjh`
- Destino: `muikwpyjaojeolwcuvqf`
- Organización destino: `DomiU Magdalena Nueva`
- Proyecto destino: `domiu-magdalena-prod`

## Seguridad

Las credenciales nunca se almacenan en el repositorio. GitHub Actions las consume desde Repository Secrets y las elimina del runner al terminar.

Secretos requeridos:

- `SOURCE_DB_URL`
- `TARGET_DB_URL`
- `SOURCE_SERVICE_ROLE_KEY`
- `TARGET_SERVICE_ROLE_KEY`

Las URLs públicas de ambos proyectos se encuentran declaradas en el workflow. No se reutiliza el JWT secret anterior; por seguridad, las sesiones activas deberán iniciar sesión nuevamente después del cambio.

## Operaciones del workflow

- `preflight`: prueba conexiones y cuenta tablas, usuarios y objetos.
- `database`: copia roles compatibles, esquema, datos, Auth y metadatos de Storage.
- `storage`: copia los objetos físicos de todos los buckets.
- `verify`: compara usuarios, buckets, archivos y conteos de base de datos.
- `all`: ejecuta la migración completa y la verificación.

## Orden de ejecución

1. Configurar los cuatro Repository Secrets.
2. Ejecutar `preflight`.
3. Revisar el resultado antes de escribir en el destino.
4. Ejecutar `all`.
5. Corregir cualquier diferencia reportada.
6. Configurar Auth, Realtime y Edge Functions.
7. Actualizar variables de Vercel solamente después de la validación.
8. Realizar pruebas E2E de cliente, negocio, repartidor y administrador.

## Protección contra pérdida de datos

- El workflow no elimina el proyecto antiguo.
- Los respaldos SQL solo existen temporalmente dentro del runner.
- Los respaldos SQL no se publican como artefactos.
- Los archivos de Storage se cargan con `upsert`, haciendo que la tarea sea repetible.
- Vercel no cambia hasta que `verify` finalice correctamente.
