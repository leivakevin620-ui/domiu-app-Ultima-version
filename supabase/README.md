# Supabase Database Setup - DomiU App 1.0

## 📌 Estructura del Proyecto

```
supabase/
├── migrations/                           # Migraciones SQL
│   ├── 20250614_01_init_roles_profiles.sql
│   ├── 20250614_02_businesses_categories.sql
│   ├── 20250614_03_products_images.sql
│   ├── 20250614_04_addresses.sql
│   ├── 20250614_05_orders_order_items.sql
│   ├── 20250614_06_drivers_locations.sql
│   ├── 20250614_07_wallets_transactions.sql
│   ├── 20250614_08_chats_messages.sql
│   ├── 20250614_09_notifications.sql
│   ├── 20250614_10_ratings.sql
│   └── 20250614_11_rls_security_policies.sql
│
├── DATABASE_DESIGN.md                    # Documentación completa
├── examples_and_queries.sql              # Queries de referencia
└── README.md                             # Este archivo
```

## 🚀 Guía de Ejecución

### **Opción 1: Supabase Dashboard (Recomendado)**

1. **Accede a Supabase**
   - Ve a [https://app.supabase.com](https://app.supabase.com)
   - Selecciona tu proyecto

2. **SQL Editor**
   - Ve a "SQL Editor"
   - Crea una nueva query

3. **Ejecuta las migraciones en orden:**
   ```
   1. 20250614_01_init_roles_profiles.sql
   2. 20250614_02_businesses_categories.sql
   3. 20250614_03_products_images.sql
   4. 20250614_04_addresses.sql
   5. 20250614_05_orders_order_items.sql
   6. 20250614_06_drivers_locations.sql
   7. 20250614_07_wallets_transactions.sql
   8. 20250614_08_chats_messages.sql
   9. 20250614_09_notifications.sql
   10. 20250614_10_ratings.sql
   11. 20250614_11_rls_security_policies.sql
   ```

4. **Verifica que todas las tablas se crearon**
   - Ve a "Schema Visualizer"
   - Confirma que todas las 31 tablas existen

### **Opción 2: Supabase CLI**

```bash
# 1. Instala Supabase CLI
npm install -g supabase

# 2. Autentícate
supabase login

# 3. Vincula tu proyecto
supabase link --project-ref your-project-ref

# 4. Ejecuta las migraciones
supabase db push

# 5. Verifica el estado
supabase db remote commit
```

### **Opción 3: psql (PostgreSQL CLI)**

```bash
# 1. Obtén la cadena de conexión de Supabase
# Settings > Database > Connection string > URI

# 2. Copia todas las migraciones en un archivo
cat migrations/*.sql > all_migrations.sql

# 3. Ejecuta el archivo
psql "postgresql://user:password@db.xxx.supabase.co:5432/postgres" -f all_migrations.sql
```

---

## ✅ Verificación Post-Instalación

### 1. **Verifica tablas creadas**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Resultado esperado: 31 tablas**

### 2. **Verifica extensiones**
```sql
SELECT * FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto', 'postgis');
```

**Resultado esperado: 3 filas**

### 3. **Verifica enums**
```sql
SELECT t.typname 
FROM pg_type t 
WHERE t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND t.typtype = 'e';
```

**Resultado esperado: 11 ENUMs**

### 4. **Verifica RLS habilitado**
```sql
SELECT schemaname, tablename 
FROM pg_tables 
WHERE rowsecurity = true 
AND schemaname = 'public'
ORDER BY tablename;
```

**Resultado esperado: 31 tablas con RLS**

### 5. **Verifica triggers creados**
```sql
SELECT COUNT(*) as trigger_count
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

**Resultado esperado: >50 triggers**

### 6. **Verifica secuencias**
```sql
SELECT sequence_name 
FROM information_schema.sequences 
WHERE sequence_schema = 'public';
```

**Resultado esperado: order_sequence**

---

## 🔑 Próximos Pasos

### 1. **Habilitar Realtime**
   - Ve a Supabase Dashboard
   - Settings > Realtime
   - Habilita para estas tablas:
     - `messages`
     - `group_messages`
     - `notifications`
     - `driver_locations`
     - `chats`
     - `orders`

### 2. **Crear Storage Buckets**
   ```sql
   -- Via Supabase Dashboard > Storage
   -- Crear buckets:
   - product-images
   - business-logos
   - user-avatars
   - chat-files
   - ratings-images
   ```

### 3. **Configurar políticas de Storage RLS**
   ```sql
   -- Permitir lectura pública
   -- Permitir upload solo a propietario
   ```

### 4. **Crear políticas de Edge Functions** (opcional)
   ```
   - trigger-notifications/
   - calculate-ratings/
   - process-payments/
   - assign-drivers/
   ```

### 5. **Configurar Webhooks**
   ```
   - Cambios de estado de orden → notificaciones
   - Nuevas órdenes → notificación merchant
   - Ubicación de courier → websocket
   ```

---

## 🗄️ Datos de Prueba (Seed)

### Crear usuario admin
```sql
-- Via Supabase Dashboard > Authentication
-- Email: admin@domiu.app
-- Password: 1193042104

-- Luego ejecutar:
INSERT INTO profiles (id, email, first_name, last_name, role, status)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@domiu.app'),
  'admin@domiu.app',
  'Admin',
  'DomiU',
  'admin',
  'active'
);
```

### Crear usuario merchant de prueba
```sql
-- Via Supabase Dashboard > Authentication
-- Email: merchant@example.com
-- Password: test123456

-- Luego ejecutar:
INSERT INTO profiles (id, email, first_name, last_name, role, phone)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'merchant@example.com'),
  'merchant@example.com',
  'Restaurante',
  'Prueba',
  'merchant',
  '3001234567'
);

-- Crear negocio
INSERT INTO businesses (owner_id, name, slug, cuisine_type, business_type, is_verified)
VALUES (
  (SELECT id FROM profiles WHERE email = 'merchant@example.com'),
  'Restaurante Prueba',
  'restaurante-prueba',
  'Comida Rápida',
  'restaurant',
  true
);
```

### Crear usuario customer de prueba
```sql
-- Via Supabase Dashboard > Authentication
-- Email: customer@example.com
-- Password: test123456

-- Luego ejecutar:
INSERT INTO profiles (id, email, first_name, last_name, role, phone)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'customer@example.com'),
  'customer@example.com',
  'Cliente',
  'Prueba',
  'customer',
  '3009876543'
);
```

---

## 🔐 Seguridad

### RLS Habilitado
✅ Row Level Security activo en todas las tablas
✅ Políticas por rol (admin, merchant, customer, courier)
✅ Validación de datos en funciones SQL

### Mejores Prácticas
- ✅ UUIDs como claves primarias
- ✅ Soft delete en datos sensibles
- ✅ Timestamps automáticos (created_at, updated_at)
- ✅ Transacciones atómicas en billeteras
- ✅ Encriptación en Supabase (campos sensibles)

### Secrets y Configuración
```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxxx
SUPABASE_DB_PASSWORD=xxxxxx
```

---

## 📊 Performance

### Índices Creados
- ✅ 40+ índices simples y compuestos
- ✅ Índices GIST para PostGIS (ubicaciones)
- ✅ Índices en claves foráneas frecuentes

### Optimizaciones
- ✅ Límite automático: 1000 ubicaciones/conductor
- ✅ Soft delete con índices
- ✅ Tablas normalizadas (3NF)
- ✅ Queries optimizadas

---

## 🧪 Testing de Seguridad RLS

### Script de prueba
```bash
# Verificar que usuarios no pueden ver datos de otros
curl -X GET 'https://xxxxx.supabase.co/rest/v1/profiles' \
  -H 'Authorization: Bearer eyJ...' \
  -H 'Range: 0-10'

# Debería retornar solo el perfil del usuario autenticado
```

---

## 📖 Documentación Relacionada

- [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) - Diseño completo
- [examples_and_queries.sql](./examples_and_queries.sql) - Queries de ejemplo
- [src/types/database.ts](../src/types/database.ts) - Tipos TypeScript
- [Supabase Docs](https://supabase.com/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

---

## 🆘 Troubleshooting

### Error: "ExtensionNotFound: extension postgis"
```
Solución: Habilitar PostGIS en Supabase Dashboard
Settings > Extensions > Buscar "postgis" > Habilitar
```

### Error: "relation does not exist"
```
Solución: Verificar que todas las migraciones ejecutaron en orden
Ejecutar verificación post-instalación
```

### Error: "permission denied"
```
Solución: Verificar que RLS está correctamente configurado
Revisar politicas en 20250614_11_rls_security_policies.sql
```

### Slow queries
```
Solución: Ejecutar ANALYZE TABLE
Verificar índices con: SELECT * FROM pg_stat_user_indexes;
```

---

## 📝 Checklist de Implementación

- [ ] Ejecutar todas las 11 migraciones
- [ ] Verificar 31 tablas creadas
- [ ] Verificar RLS en todas las tablas
- [ ] Habilitar Realtime para tablas críticas
- [ ] Crear Storage buckets
- [ ] Seed data de prueba
- [ ] Probar políticas de seguridad
- [ ] Configurar backups automáticos
- [ ] Crear índices de análisis
- [ ] Documentar extensiones personalizadas

---

## 🎯 Estado del Proyecto

**Fase:** ✅ Diseño de Base de Datos Completado

**Próximas Fases:**
- ⏳ Crear API endpoints (Next.js)
- ⏳ Implementar autenticación
- ⏳ Crear servicios de negocio
- ⏳ Construir UI/Components
- ⏳ Testing e2e
- ⏳ Deployment

---

**Última actualización:** 2025-06-14
**Versión:** 1.0
**Base de Datos:** Supabase PostgreSQL
**Estado:** Listo para Desarrollo ✅
