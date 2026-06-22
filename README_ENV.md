# DomiU App 1.2 - Environment Guide

Esta guia documenta las variables y verificaciones necesarias para reconstruir y validar el entorno.

## Requisitos

- Node.js 20+
- Git
- Supabase CLI o acceso al SQL Editor de Supabase
- Vercel CLI opcional para verificar variables remotas

## Variables locales minimas

Crear `.env.local` a partir de `.env.example`.

```env
NEXT_PUBLIC_SUPABASE_URL=https://vuwaqmwgvldqmmgkpyjh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<google_maps_key_optional_for_local>
```

## Variables opcionales para verificacion SQL

El checker puede verificar Storage policies y Realtime publication si existe una de estas variables:

```env
DATABASE_URL=<postgres_connection_string>
SUPABASE_DB_URL=<postgres_connection_string>
SUPABASE_DB_PASSWORD=<database_password>
```

Si ninguna existe, `npm run check:env` marca policies y Realtime como no verificables, no como aprobadas.

## Supabase Storage

Buckets esperados:

- `business-logos`
- `business-banners`
- `product-images`
- `promotions`
- `categories`
- `user-avatars`
- `chat-files`
- `ratings-images`

Visibilidad:

- Publicos: `business-logos`, `business-banners`, `product-images`, `promotions`, `categories`, `user-avatars`, `ratings-images`
- Privado: `chat-files`

Migracion de hardening:

```bash
supabase db push
```

O ejecutar en SQL Editor:

```text
supabase/migrations/2025062105_remote_storage_realtime_hardening.sql
```

Alternativa con `psql` si existe `DATABASE_URL`:

```bash
psql "%DATABASE_URL%" -f supabase/migrations/2025062105_remote_storage_realtime_hardening.sql
```

En PowerShell:

```powershell
psql $env:DATABASE_URL -f .\supabase\migrations\2025062105_remote_storage_realtime_hardening.sql
```

## Realtime

Tablas esperadas en publication `supabase_realtime`:

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

## Google Maps

Variable:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<key>
```

Debe configurarse en:

- Local Development si se van a probar mapas localmente
- Vercel Development
- Vercel Preview
- Vercel Production

APIs recomendadas:

- Maps JavaScript API
- Places API
- Directions API
- Geocoding API

## Vercel

Verificar variables remotas si `vercel` CLI esta disponible:

```bash
vercel env ls
```

Variables criticas:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

Si `vercel` CLI no esta instalado:

```bash
npm install -g vercel
vercel login
vercel link
vercel env ls
```

## Validacion local

```bash
npm run lint
npm run build
npm run check:env
npm run test
npm run test:coverage
```

## Estado conocido al 2026-06-21

- Buckets esperados creados/verificados via Storage API.
- Bucket legado `avatars` existe y aparece vacio; no se elimino.
- Policies y Realtime tienen SQL preparado, pero requieren credencial SQL o ejecucion manual en SQL Editor para confirmacion remota.
- Vercel CLI no esta disponible en este entorno; variables remotas deben verificarse manualmente.
