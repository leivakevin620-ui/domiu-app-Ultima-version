# DomiU App 1.0 - Database Design Documentation

## 📋 Tabla de Contenidos
1. [Estructura de Migraciones](#estructura-de-migraciones)
2. [Diagrama de Relaciones](#diagrama-de-relaciones)
3. [Tabla de Entidades](#tabla-de-entidades)
4. [Políticas de Seguridad RLS](#políticas-de-seguridad-rls)
5. [Funciones SQL Personalizadas](#funciones-sql-personalizadas)
6. [Triggers del Sistema](#triggers-del-sistema)
7. [Extensiones Habilitadas](#extensiones-habilitadas)
8. [Estrategia de Índices](#estrategia-de-índices)
9. [Consideraciones de Performance](#consideraciones-de-performance)
10. [Plan de Ejecución](#plan-de-ejecución)

---

## Estructura de Migraciones

Las migraciones están organizadas secuencialmente para mantener la integridad referencial:

```
supabase/migrations/
├── 20250614_01_init_roles_profiles.sql
│   ├── Extensiones PostgreSQL (uuid, pgcrypto)
│   ├── ENUMs base
│   ├── Tabla: roles
│   ├── Tabla: profiles
│   └── Triggers de updated_at
│
├── 20250614_02_businesses_categories.sql
│   ├── Tabla: businesses
│   ├── Tabla: business_hours
│   ├── Tabla: categories
│   └── Índices y triggers
│
├── 20250614_03_products_images.sql
│   ├── Tabla: products
│   ├── Tabla: product_images
│   ├── Tabla: product_variants
│   └── Índices de búsqueda
│
├── 20250614_04_addresses.sql
│   ├── Extensión PostGIS (geolocalización)
│   ├── Tabla: addresses
│   ├── Tabla: business_addresses
│   └── Soporte GPS/Coordenadas
│
├── 20250614_05_orders_order_items.sql
│   ├── Tabla: orders
│   ├── Tabla: order_items
│   ├── Tabla: order_tracking
│   ├── Función: generate_order_number()
│   └── Secuencia: order_sequence
│
├── 20250614_06_drivers_locations.sql
│   ├── Tabla: drivers
│   ├── Tabla: driver_locations (real-time)
│   ├── Tabla: driver_availability
│   ├── Tabla: driver_earnings
│   └── Limpieza automática de ubicaciones
│
├── 20250614_07_wallets_transactions.sql
│   ├── Tabla: wallets
│   ├── Tabla: wallet_transactions
│   ├── Tabla: wallet_topups
│   ├── Función: add_wallet_transaction()
│   └── Transacciones atómicas
│
├── 20250614_08_chats_messages.sql
│   ├── Tabla: chats
│   ├── Tabla: messages
│   ├── Tabla: group_chats
│   ├── Tabla: group_chat_members
│   ├── Tabla: group_messages
│   ├── Vista: unread_messages
│   ├── Función: mark_messages_as_read()
│   └── Soporte Realtime
│
├── 20250614_09_notifications.sql
│   ├── Tabla: notifications
│   ├── Tabla: notification_preferences
│   ├── Tabla: notification_templates
│   ├── Tabla: device_tokens
│   ├── Función: create_notification()
│   └── Templates para notificaciones
│
├── 20250614_10_ratings.sql
│   ├── Tabla: ratings
│   ├── Tabla: rating_comments
│   ├── Tabla: rating_reactions
│   ├── Funciones: recalculate_*_rating()
│   ├── Triggers de recálculo
│   └── Actualización automática de ratings
│
└── 20250614_11_rls_security_policies.sql
    ├── Habilitar RLS en todas las tablas
    ├── Políticas de lectura (SELECT)
    ├── Políticas de escritura (INSERT/UPDATE)
    ├── Permisos granulares por rol
    └── Índices de performance
```

---

## Diagrama de Relaciones

### Árbol de Dependencias:

```
auth.users (Supabase)
    │
    ├─→ profiles
    │   ├─→ businesses (owner_id)
    │   │   ├─→ business_hours
    │   │   ├─→ business_addresses
    │   │   ├─→ categories
    │   │   │   └─→ products
    │   │   │       ├─→ product_images
    │   │   │       └─→ product_variants
    │   │   └─→ orders (business_id)
    │   │       ├─→ order_items (product_id)
    │   │       ├─→ order_tracking
    │   │       └─→ ratings
    │   │
    │   ├─→ addresses
    │   │
    │   ├─→ drivers (extends profile)
    │   │   ├─→ driver_locations (real-time)
    │   │   ├─→ driver_availability
    │   │   ├─→ driver_earnings
    │   │   └─→ orders (courier_id)
    │   │
    │   ├─→ wallets
    │   │   ├─→ wallet_transactions
    │   │   └─→ wallet_topups
    │   │
    │   ├─→ chats
    │   │   └─→ messages
    │   │
    │   ├─→ group_chats
    │   │   ├─→ group_chat_members
    │   │   └─→ group_messages
    │   │
    │   ├─→ notifications
    │   │   └─→ notification_preferences
    │   │
    │   ├─→ device_tokens
    │   │
    │   └─→ rating_*

└─→ roles
```

---

## Tabla de Entidades

### 1. PROFILES & ROLES
| Tabla | Descripción | Claves Primarias | Claves Foráneas |
|-------|-------------|------------------|-----------------|
| **roles** | Definición de roles del sistema | id (UUID) | - |
| **profiles** | Datos de usuario extendidos | id (UUID) | auth.users.id |

### 2. BUSINESSES
| Tabla | Descripción | Claves Primarias | Claves Foráneas |
|-------|-------------|------------------|-----------------|
| **businesses** | Restaurantes/Tiendas | id (UUID) | profiles.id |
| **business_hours** | Horario de atención | id (UUID) | businesses.id |
| **business_addresses** | Ubicaciones del negocio | id (UUID) | businesses.id |

### 3. CATALOG
| Tabla | Descripción | Claves Primarias | Claves Foráneas |
|-------|-------------|------------------|-----------------|
| **categories** | Categorías de productos | id (UUID) | businesses.id |
| **products** | Productos disponibles | id (UUID) | businesses.id, categories.id |
| **product_images** | Imágenes de productos | id (UUID) | products.id |
| **product_variants** | Variantes (talla, color) | id (UUID) | products.id |

### 4. DELIVERY
| Tabla | Descripción | Claves Primarias | Claves Foráneas |
|-------|-------------|------------------|-----------------|
| **addresses** | Direcciones de clientes | id (UUID) | profiles.id |
| **drivers** | Información de repartidores | id (UUID) | profiles.id |
| **driver_locations** | Ubicación GPS real-time | id (UUID) | drivers.id, orders.id |
| **driver_availability** | Disponibilidad de repartidor | id (UUID) | drivers.id |
| **driver_earnings** | Ganancias de repartidor | id (UUID) | drivers.id, orders.id |

### 5. ORDERS
| Tabla | Descripción | Claves Primarias | Claves Foráneas |
|-------|-------------|------------------|-----------------|
| **orders** | Pedidos del sistema | id (UUID) | profiles.id, businesses.id, drivers.id |
| **order_items** | Items dentro de un pedido | id (UUID) | orders.id, products.id |
| **order_tracking** | Historial de estado | id (UUID) | orders.id |

### 6. PAYMENTS
| Tabla | Descripción | Claves Primarias | Claves Foráneas |
|-------|-------------|------------------|-----------------|
| **wallets** | Billetera digital | id (UUID) | profiles.id |
| **wallet_transactions** | Transacciones de billetera | id (UUID) | wallets.id |
| **wallet_topups** | Recargas de billetera | id (UUID) | wallets.id |

### 7. COMMUNICATION
| Tabla | Descripción | Claves Primarias | Claves Foráneas |
|-------|-------------|------------------|-----------------|
| **chats** | Conversaciones 1-a-1 | id (UUID) | profiles.id (x2), orders.id |
| **messages** | Mensajes individuales | id (UUID) | chats.id, profiles.id (x2) |
| **group_chats** | Chats de grupo por orden | id (UUID) | orders.id, profiles.id |
| **group_chat_members** | Miembros de chat grupal | id (UUID) | group_chats.id, profiles.id |
| **group_messages** | Mensajes en grupo | id (UUID) | group_chats.id, profiles.id |

### 8. NOTIFICATIONS
| Tabla | Descripción | Claves Primarias | Claves Foráneas |
|-------|-------------|------------------|-----------------|
| **notifications** | Alertas del sistema | id (UUID) | profiles.id (x2), orders.id |
| **notification_preferences** | Preferencias de notificación | id (UUID) | profiles.id |
| **notification_templates** | Templates de notificaciones | id (UUID) | - |
| **device_tokens** | Tokens para push notifications | id (UUID) | profiles.id |

### 9. RATINGS
| Tabla | Descripción | Claves Primarias | Claves Foráneas |
|-------|-------------|------------------|-----------------|
| **ratings** | Calificaciones y reviews | id (UUID) | orders.id, profiles.id |
| **rating_comments** | Comentarios en reviews | id (UUID) | ratings.id, profiles.id |
| **rating_reactions** | Reacciones a reviews | id (UUID) | ratings.id, profiles.id |

---

## Políticas de Seguridad RLS

### Principios de Seguridad

```
┌─────────────────────────────────────┐
│       NIVEL DE ACCESO POR ROL       │
├─────────────────────────────────────┤
│ ADMIN: Acceso total                 │
│ MERCHANT: Solo sus negocios y datos │
│ CUSTOMER: Solo sus datos            │
│ COURIER: Solo sus entregas          │
└─────────────────────────────────────┘
```

### Políticas por Tabla

#### **PROFILES**
```sql
-- Lectura: Cada usuario puede ver su perfil + perfiles públicos
-- Escritura: Solo su propio perfil
-- Admin: Acceso total
```

#### **BUSINESSES**
```sql
-- Lectura: Negocios activos públicos + propios
-- Escritura: Solo propietario
-- Admin: Acceso total
```

#### **PRODUCTS**
```sql
-- Lectura: Productos disponibles + productos del propietario
-- Escritura: Solo propietario del negocio
-- Actualización: Propietario del negocio
```

#### **ORDERS**
```sql
-- Lectura: 
│   - Clientes ven sus órdenes
│   - Propietarios ven órdenes de su negocio
│   - Couriers ven órdenes asignadas
│   - Admins ven todas
-- Escritura: Clientes crean, sistema actualiza estado
```

#### **WALLETS**
```sql
-- Lectura: Solo usuario propietario
-- Escritura: NO directa (solo via funciones SQL)
-- Actualización: Funciones SQL atómicas
```

#### **CHATS & MESSAGES**
```sql
-- Lectura: Participantes solo
-- Escritura: Participantes pueden crear mensajes
```

#### **DRIVER_LOCATIONS**
```sql
-- Lectura: 
│   - Propio conductor
│   - Clientes de sus órdenes
│   - Propietarios de sus órdenes
│   - Admins
-- Escritura: Solo el conductor
```

#### **NOTIFICATIONS**
```sql
-- Lectura: Solo destinatario
-- Escritura: Sistema
-- Actualización: Destinatario puede marcar como leído
```

---

## Funciones SQL Personalizadas

### 1. **update_updated_at_column()**
```sql
TRIGGERS: Todas las tablas con updated_at
PROPÓSITO: Actualizar automáticamente timestamp de modificación
```

### 2. **generate_order_number()**
```sql
FORMATO: ORD-YYYYMMDD-NNNNN
EJEMPLO: ORD-20250614-00001
PROPÓSITO: Generar número único de pedido
```

### 3. **add_wallet_transaction()**
```sql
PARÁMETROS:
  - wallet_id: UUID
  - transaction_type: credit|debit|refund|bonus|adjustment
  - amount: DECIMAL
  - reference_id: VARCHAR (orden, reembolso, etc)
  - reference_type: VARCHAR (order, refund, bonus, etc)
  - description: TEXT
  - metadata: JSONB

CARACTERÍSTICAS:
  ✓ Transacción atómica
  ✓ Lock de fila en billetera
  ✓ Validación de balance
  ✓ Cálculo automático de balance_after
  ✓ Registro de historial
```

### 4. **mark_messages_as_read()**
```sql
PARÁMETROS:
  - chat_id: UUID
  - reader_id: UUID

RETORNA: { updated_count: INT }

PROPÓSITO: Marcar múltiples mensajes como leídos
```

### 5. **mark_notification_as_read()**
```sql
PARÁMETROS: notification_id UUID
RETORNA: BOOLEAN

PROPÓSITO: Marcar notificación individual como leída
```

### 6. **create_notification()**
```sql
PARÁMETROS:
  - recipient_id: UUID
  - notification_type: NotificationType
  - title: VARCHAR
  - message: TEXT
  - order_id: UUID (opcional)
  - reference_id: VARCHAR (opcional)
  - reference_type: VARCHAR (opcional)
  - metadata: JSONB (opcional)

RETORNA: notifications row

PROPÓSITO: Crear notificación con validaciones
```

### 7. **recalculate_business_rating()**
```sql
CÁLCULO: AVG(ratings) WHERE rating_type='merchant' AND is_public=true
ACTUALIZA: businesses.rating, businesses.total_ratings
PROPÓSITO: Mantener rating actualizado
```

### 8. **recalculate_driver_rating()**
```sql
CÁLCULO: AVG(ratings) WHERE rating_type='courier' AND is_public=true
ACTUALIZA: drivers.rating, drivers.total_ratings, drivers.avg_rating
```

### 9. **recalculate_product_rating()**
```sql
CÁLCULO: AVG(ratings) WHERE rating_type='order' AND is_public=true
ACTUALIZA: products.rating, products.total_ratings
```

### 10. **create_wallet_for_user()**
```sql
TRIGGER: AFTER INSERT ON profiles
CONDICIÓN: role IN ('customer', 'courier')
ACCIÓN: Crear billetera automáticamente
```

### 11. **create_notification_preferences()**
```sql
TRIGGER: AFTER INSERT ON profiles
ACCIÓN: Crear preferencias de notificación automáticas
```

### 12. **update_address_location()**
```sql
TRIGGER: BEFORE INSERT/UPDATE ON addresses
FUNCIÓN: Convertir lat/lng a PostGIS GEOGRAPHY(POINT)
PROPÓSITO: Soporte para queries de distancia
```

### 13. **cleanup_old_driver_locations()**
```sql
TRIGGER: AFTER INSERT ON driver_locations
LÍMITE: Mantener solo últimas 1000 ubicaciones por conductor
PROPÓSITO: Optimizar storage en locations real-time
```

### 14. **update_order_tracking()**
```sql
TRIGGER: AFTER UPDATE ON orders (status changes)
ACCIÓN: Log en tabla order_tracking
```

---

## Triggers del Sistema

| Trigger | Evento | Tabla | Función | Propósito |
|---------|--------|-------|---------|-----------|
| `update_*_updated_at` | BEFORE UPDATE | Todas | `update_updated_at_column()` | Mantener timestamps |
| `create_wallet_on_profile_creation` | AFTER INSERT | profiles | `create_wallet_for_user()` | Wallet automática |
| `create_notification_prefs_on_profile_creation` | AFTER INSERT | profiles | `create_notification_preferences()` | Prefs automáticas |
| `update_*_location_trigger` | BEFORE INSERT/UPDATE | addresses | `update_address_location()` | PostGIS sync |
| `cleanup_driver_locations_trigger` | AFTER INSERT | driver_locations | `cleanup_old_driver_locations()` | Limpieza automática |
| `update_cart_last_message_trigger` | AFTER INSERT | messages | `update_chat_last_message()` | Timestamp actualizado |
| `recalculate_rating_on_insert` | AFTER INSERT | ratings | `trigger_recalculate_rating()` | Rating actualizado |
| `recalculate_rating_on_update` | AFTER UPDATE | ratings | `trigger_recalculate_rating()` | Rating actualizado |
| `update_order_rating_trigger` | AFTER INSERT | ratings | `update_order_rating()` | Order rating sync |
| `log_order_status_trigger` | AFTER UPDATE | orders | `log_order_status_change()` | Historial de estado |

---

## Extensiones Habilitadas

```sql
-- UUID Support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"
→ Genera UUIDs v4 automáticamente

-- Cryptography
CREATE EXTENSION IF NOT EXISTS "pgcrypto"
→ Para hashing y generación de números aleatorios

-- PostGIS (Geolocalización)
CREATE EXTENSION IF NOT EXISTS "postgis"
→ Queries de distancia entre ubicaciones
→ Cálculos de georeferencia
→ Índices espaciales (GIST)
```

---

## Estrategia de Índices

### Índices Simples (Búsqueda)
```sql
-- Usuarios
idx_profiles_email
idx_profiles_phone
idx_profiles_role
idx_profiles_status

-- Negocios
idx_businesses_slug
idx_businesses_owner_id
idx_businesses_is_active

-- Productos
idx_products_sku
idx_products_slug
idx_products_status
idx_products_is_featured
idx_products_rating

-- Órdenes
idx_orders_order_number
idx_orders_customer_id
idx_orders_status
idx_orders_payment_status

-- Ubicaciones
idx_addresses_user_id
idx_driver_locations_driver_id
```

### Índices Compuestos (Queries complejas)
```sql
-- Soft delete
idx_profiles_deleted_at
idx_businesses_deleted_at
idx_products_deleted_at

-- Búsquedas frecuentes
idx_products_category_status ON (category_id, status)
idx_orders_customer_status_date ON (customer_id, status, created_at DESC)
idx_orders_business_status_date ON (business_id, status, created_at DESC)
idx_messages_chat_created ON (chat_id, created_at DESC)
```

### Índices Espaciales (GPS)
```sql
-- PostGIS GIST para distancias
idx_addresses_location USING GIST
idx_business_addresses_location USING GIST
idx_driver_locations_location USING GIST
```

---

## Consideraciones de Performance

### 1. **Soft Delete Performance**
```
✓ Agregar índice en deleted_at
✓ Incluir en WHERE clauses: WHERE deleted_at IS NULL
✓ Vacío periódico con archivar histórico
```

### 2. **Real-time Locations**
```
⚠ driver_locations puede crecer rápido
✓ Límite automático: 1000 últimas por conductor
✓ Considerar tabla de histórico separada
✓ Índice GIST para queries de distancia
```

### 3. **Mensajes**
```
✓ Índice en (chat_id, created_at DESC)
✓ Considerar particionamiento por date
✓ Realtime subscription optimizada
```

### 4. **Ratings**
```
✓ Recálculo eficiente (solo public + no deleted)
✓ Caché en businesses/drivers/products
✓ Actualización asíncrona considerada
```

### 5. **Wallets**
```
✓ Lock en transacciones para atomicidad
✓ Total debited/credited como caché
✓ Evitar queries de suma en transacciones
```

---

## Plan de Ejecución

### **Fase 1: Setup Inicial** ✅
```
1. Crear extensiones (uuid-ossp, pgcrypto, postgis)
2. Ejecutar 20250614_01_init_roles_profiles.sql
3. Ejecutar 20250614_02_businesses_categories.sql
4. Ejecutar 20250614_03_products_images.sql
```

### **Fase 2: Ubicaciones y Entregas** ✅
```
5. Ejecutar 20250614_04_addresses.sql
6. Ejecutar 20250614_05_orders_order_items.sql
7. Ejecutar 20250614_06_drivers_locations.sql
```

### **Fase 3: Pagos y Comunicación** ✅
```
8. Ejecutar 20250614_07_wallets_transactions.sql
9. Ejecutar 20250614_08_chats_messages.sql
10. Ejecutar 20250614_09_notifications.sql
```

### **Fase 4: Ratings y Seguridad** ✅
```
11. Ejecutar 20250614_10_ratings.sql
12. Ejecutar 20250614_11_rls_security_policies.sql
```

### **Fase 5: Validación** ⏳
```
- Verificar todas las relaciones
- Probar políticas RLS
- Validar triggers funcionando
- Confirmar Realtime habilitado
```

---

## Consideraciones para Desarrollo

### **TypeScript Types**
✓ Tipos derivados en: `src/types/database.ts`
✓ Incluyen todos los enums, interfaces y composites
✓ Listos para usar con Supabase client

### **Supabase Realtime**
✓ Todas las tablas soportan Realtime
✓ Tabla `driver_locations` optimizada para actualizaciones frecuentes
✓ Tabla `messages` lista para chat en tiempo real

### **Búsquedas Geográficas**
✓ Función PostGIS: `ST_Distance(location, ST_SetSRID(ST_MakePoint(lon, lat), 4326))`
✓ Radio queries: `ST_DWithin(location, point, distance_meters)`
✓ Nearest neighbor: Usar GIST index

### **Ejemplo: Encontrar repartidores cercanos**
```sql
SELECT * FROM drivers
WHERE status = 'available'
  AND ST_DWithin(
    current_location.location,
    ST_SetSRID(ST_MakePoint(-74.0059, 40.7128), 4326),
    5000 -- 5km
  )
ORDER BY ST_Distance(current_location.location, customer_location)
LIMIT 5;
```

---

## Próximos Pasos

1. ✅ Ejecutar migraciones en orden
2. ⏳ Crear seed data (usuarios de prueba, negocios, productos)
3. ⏳ Configurar Supabase Realtime en tablas críticas
4. ⏳ Crear funciones de API (Next.js)
5. ⏳ Implementar UI/Components
6. ⏳ Testing de seguridad RLS
7. ⏳ Performance testing y optimización

---

**Documento generado:** 2025-06-14
**Base de datos:** Supabase PostgreSQL
**Estado:** Diseño Completo ✅
