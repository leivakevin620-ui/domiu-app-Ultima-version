# DomiU App 1.2 - Production Checklist

Fecha: 2026-06-21

## Validaciones locales

```bash
npm run lint
npm run build
npm run check:env
npm run test
npm run test:coverage
```

## Storage

| Bucket | Esperado | Estado |
|---|---|---|
| `business-logos` | Publico, 2 MB, imagenes | Verificado |
| `business-banners` | Publico, 5 MB, imagenes | Verificado |
| `product-images` | Publico, 5 MB, imagenes | Verificado |
| `promotions` | Publico, 5 MB, imagenes | Verificado |
| `categories` | Publico, 5 MB, imagenes | Verificado |
| `user-avatars` | Publico, 2 MB, imagenes | Creado y verificado |
| `chat-files` | Privado, 10 MB, imagenes/PDF | Creado y verificado |
| `ratings-images` | Publico, 5 MB, imagenes | Creado y verificado |

MIME esperados:

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`
- `application/pdf` solo para `chat-files`

## Bucket legado

- `avatars` existe y aparece vacio.
- No se elimino automaticamente.
- Eliminacion segura sugerida: confirmar en Dashboard que no tiene objetos ni referencias historicas, luego eliminar manualmente.

## Storage policies

SQL preparado:

- `supabase/migrations/2025062105_remote_storage_realtime_hardening.sql`

Debe aplicarse con Supabase CLI o SQL Editor antes de produccion tecnica.

Opciones de aplicacion:

```bash
supabase db push
```

```powershell
psql $env:DATABASE_URL -f .\supabase\migrations\2025062105_remote_storage_realtime_hardening.sql
```

O copiar el contenido completo de `supabase/migrations/2025062105_remote_storage_realtime_hardening.sql` en Supabase Dashboard > SQL Editor y ejecutarlo una vez.

Verificacion SQL:

```sql
select policyname
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;
```

## Realtime

SQL preparado:

- `supabase/migrations/2025062105_remote_storage_realtime_hardening.sql`

Tablas esperadas en `supabase_realtime`:

- `notifications`
- `messages`
- `orders`
- `driver_locations`

Verificacion SQL:

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
order by tablename;
```

Uso actual de frontend:

- `notifications`: Realtime real.
- `messages`: memoria local.
- `orders`: memoria local/polling.
- `driver_locations`: upsert/memoria local.

## Google Maps

Variable:

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

Estado:

- `.env.example`: documentada.
- `.env.local`: pendiente si esta vacia.
- `.env.production`: pendiente si no esta definida.
- Vercel Production: confirmar manualmente.
- Vercel Preview: confirmar manualmente.
- Vercel Development: confirmar manualmente.

APIs a habilitar/restringir:

- Maps JavaScript API
- Places API
- Directions API
- Geocoding API

## Auth

- Confirmar `NEXT_PUBLIC_SUPABASE_URL`.
- Confirmar `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Confirmar `SUPABASE_SERVICE_ROLE_KEY` solo en server/secretos.
- Confirmar Redirect URLs para dominio final.
- Probar login, registro y reset password.

## RLS

- Confirmar RLS en tablas publicas criticas.
- Probar perfiles customer, business, courier y admin.
- Confirmar que service role no se expone al cliente.

## RBAC

- Confirmar redirecciones por rol en `src/proxy.ts`.
- Confirmar acceso a `/admin`, `/negocio`, `/repartidor`, `/cliente`.

## Payments

- Confirmar build limpio.
- Ejecutar smoke tests disponibles.
- Validar webhooks/secrets por provider en staging antes de produccion comercial.

## SEO

- Confirmar `/robots.txt`.
- Confirmar `/sitemap.xml`.
- Ejecutar Lighthouse SEO.

## PWA

- Confirmar `public/manifest.json`.
- Confirmar `public/sw.js`.
- Validar installability y offline basico.

## Vercel

- Confirmar variables Production, Preview y Development.
- Confirmar dominio final.
- Confirmar build command `npm run build`.
- Confirmar Node.js compatible.

Comando esperado:

```bash
vercel env ls
```

## Supabase

- Aplicar migraciones pendientes.
- Verificar Storage policies.
- Verificar Realtime publication.
- Confirmar backups y logs.

## Bloqueantes actuales

- SQL remoto de policies y Realtime no aplicado/verificado desde este entorno por falta de credencial SQL.
- Google Maps no verificado en Vercel.
- Lighthouse final pendiente.
- Payments: providers son stubs — conectar SDKs reales antes de produccion comercial.
- Idempotency store en memoria — migrar a Supabase/Redis antes de produccion.
