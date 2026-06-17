-- MIGRATION EXECUTION ORDER & SUMMARY
-- Execute these in exact order to maintain referential integrity

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ FASE 1: INICIALIZACIÓN Y TIPOS BASE (Debe ejecutarse primero)      │
-- └─────────────────────────────────────────────────────────────────────┘

-- 1️⃣  20250614_01_init_roles_profiles.sql
--     ├─ Extensiones: uuid-ossp, pgcrypto
--     ├─ ENUMs: user_role, user_status, order_status, payment_status, payment_method, rating_type
--     ├─ Tablas:
--     │  ├─ roles (4 roles predefinidos: admin, merchant, customer, courier)
--     │  └─ profiles (extends auth.users)
--     ├─ Triggers: update_updated_at para ambas tablas
--     ├─ Índices: 5 índices de búsqueda en profiles
--     └─ Secuencias: Ninguna
--
--     Tablas: 2
--     Enums: 6
--     Funciones: 1 (update_updated_at_column)
--     Triggers: 2

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ FASE 2: CATÁLOGO DE NEGOCIOS (Depende de profiles)                 │
-- └─────────────────────────────────────────────────────────────────────┘

-- 2️⃣  20250614_02_businesses_categories.sql
--     ├─ Tablas:
--     │  ├─ businesses (owner_id → profiles)
--     │  ├─ business_hours (business_id → businesses)
--     │  └─ categories (business_id → businesses)
--     ├─ Triggers: update_updated_at para las 3 tablas
--     ├─ Índices: 9 índices compuestos
--     └─ Secuencias: Ninguna
--
--     Tablas: 3
--     Enums: 0
--     Funciones: 0
--     Triggers: 3

-- 3️⃣  20250614_03_products_images.sql
--     ├─ ENUMs: product_status
--     ├─ Tablas:
--     │  ├─ products (business_id → businesses, category_id → categories)
--     │  ├─ product_images (product_id → products)
--     │  └─ product_variants (product_id → products)
--     ├─ Triggers: update_updated_at para las 3 tablas
--     ├─ Índices: 10 índices
--     └─ Secuencias: Ninguna
--
--     Tablas: 3
--     Enums: 1
--     Funciones: 0
--     Triggers: 3

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ FASE 3: UBICACIONES Y GEOGRAFÍA (Requiere PostGIS)                 │
-- └─────────────────────────────────────────────────────────────────────┘

-- 4️⃣  20250614_04_addresses.sql
--     ├─ Extensiones: postgis
--     ├─ ENUMs: address_type
--     ├─ Tablas:
--     │  ├─ addresses (user_id → profiles)
--     │  └─ business_addresses (business_id → businesses)
--     ├─ Funciones: update_address_location() para GPS
--     ├─ Triggers: Triggers de ubicación + updated_at
--     ├─ Índices: 7 índices incluyendo GIST
--     └─ Secuencias: Ninguna
--
--     Tablas: 2
--     Enums: 1
--     Funciones: 1
--     Triggers: 4

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ FASE 4: PEDIDOS Y ENTREGAS (Core del sistema)                      │
-- └─────────────────────────────────────────────────────────────────────┘

-- 5️⃣  20250614_05_orders_order_items.sql
--     ├─ Tablas:
--     │  ├─ orders (customer_id → profiles, business_id → businesses, 
--     │  │          courier_id → profiles, delivery_address_id → addresses)
--     │  ├─ order_items (order_id → orders, product_id → products)
--     │  └─ order_tracking (order_id → orders)
--     ├─ Funciones:
--     │  ├─ generate_order_number()
--     │  ├─ auto_generate_order_number()
--     │  └─ log_order_status_change()
--     ├─ Secuencias: order_sequence (para order_number)
--     ├─ Triggers: Triggers de número automático, logging, updated_at
--     ├─ Índices: 10 índices
--     └─ ENUMs: Ninguno (usa tipos definidos anteriormente)
--
--     Tablas: 3
--     Enums: 0
--     Funciones: 3
--     Triggers: 4

-- 6️⃣  20250614_06_drivers_locations.sql
--     ├─ ENUMs: driver_status, vehicle_type
--     ├─ Tablas:
--     │  ├─ drivers (id → profiles)
--     │  ├─ driver_locations (driver_id → drivers, order_id → orders) [REAL-TIME]
--     │  ├─ driver_availability (driver_id → drivers)
--     │  └─ driver_earnings (driver_id → drivers, order_id → orders)
--     ├─ Funciones: cleanup_old_driver_locations() [limpia 1000 últimas]
--     ├─ Triggers: Limpieza automática + updated_at + GPS sync
--     ├─ Índices: 8 índices incluyendo GIST
--     └─ Secuencias: Ninguna
--
--     Tablas: 4
--     Enums: 2
--     Funciones: 1
--     Triggers: 4

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ FASE 5: PAGOS Y DINERO (Sistema de billeteras)                     │
-- └─────────────────────────────────────────────────────────────────────┘

-- 7️⃣  20250614_07_wallets_transactions.sql
--     ├─ ENUMs: transaction_type, wallet_transaction_status
--     ├─ Tablas:
--     │  ├─ wallets (user_id → profiles)
--     │  ├─ wallet_transactions (wallet_id → wallets)
--     │  └─ wallet_topups (wallet_id → wallets)
--     ├─ Funciones:
--     │  ├─ add_wallet_transaction() [TRANSACCIÓN ATÓMICA]
--     │  └─ create_wallet_for_user()
--     ├─ Triggers: Creación automática de wallet + updated_at
--     ├─ Índices: 7 índices
--     └─ Secuencias: Ninguna
--
--     Tablas: 3
--     Enums: 2
--     Funciones: 2
--     Triggers: 3

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ FASE 6: COMUNICACIÓN EN TIEMPO REAL (Chat & Mensajes)              │
-- └─────────────────────────────────────────────────────────────────────┘

-- 8️⃣  20250614_08_chats_messages.sql
--     ├─ ENUMs: message_type
--     ├─ Tablas:
--     │  ├─ chats (participant_1_id, participant_2_id → profiles, order_id → orders)
--     │  ├─ messages (chat_id → chats, sender_id/receiver_id → profiles) [REAL-TIME]
--     │  ├─ group_chats (order_id → orders, created_by → profiles)
--     │  ├─ group_chat_members (group_chat_id → group_chats, member_id → profiles)
--     │  └─ group_messages (group_chat_id → group_chats, sender_id → profiles) [REAL-TIME]
--     ├─ Vistas: unread_messages
--     ├─ Funciones:
--     │  ├─ update_chat_last_message()
--     │  └─ mark_messages_as_read()
--     ├─ Triggers: Actualización de last_message_at + updated_at
--     ├─ Índices: 10 índices
--     └─ Secuencias: Ninguna
--
--     Tablas: 5
--     Enums: 1
--     Funciones: 2
--     Triggers: 2
--     Vistas: 1

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ FASE 7: NOTIFICACIONES Y ALERTAS (Sistema de avisos)               │
-- └─────────────────────────────────────────────────────────────────────┘

-- 9️⃣  20250614_09_notifications.sql
--     ├─ ENUMs: notification_type (11 tipos), notification_channel
--     ├─ Tablas:
--     │  ├─ notifications (recipient_id/sender_id → profiles, order_id → orders) [REAL-TIME]
--     │  ├─ notification_preferences (user_id → profiles)
--     │  ├─ notification_templates (relación con notification_type)
--     │  └─ device_tokens (user_id → profiles)
--     ├─ Funciones:
--     │  ├─ mark_notification_as_read()
--     │  ├─ create_notification()
--     │  └─ create_notification_preferences()
--     ├─ Triggers: Creación automática de preferencias + updated_at
--     ├─ Datos: 11 templates predefinidas
--     ├─ Índices: 8 índices
--     └─ Secuencias: Ninguna
--
--     Tablas: 4
--     Enums: 2
--     Funciones: 3
--     Triggers: 2

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ FASE 8: CALIFICACIONES Y REVIEWS (Sistema de ratings)              │
-- └─────────────────────────────────────────────────────────────────────┘

-- 🔟  20250614_10_ratings.sql
--     ├─ Tablas:
--     │  ├─ ratings (order_id → orders, rater_id/response_by → profiles)
--     │  ├─ rating_comments (rating_id → ratings, author_id → profiles)
--     │  └─ rating_reactions (rating_id → ratings, user_id → profiles)
--     ├─ Funciones:
--     │  ├─ recalculate_business_rating()
--     │  ├─ recalculate_driver_rating()
--     │  ├─ recalculate_product_rating()
--     │  └─ trigger_recalculate_rating()
--     ├─ Triggers: Recálculo automático en insert/update
--     ├─ Índices: 9 índices
--     └─ Secuencias: Ninguna
--
--     Tablas: 3
--     Enums: 0
--     Funciones: 4
--     Triggers: 3

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ FASE 9: SEGURIDAD (Row Level Security - RLS)                       │
-- └─────────────────────────────────────────────────────────────────────┘

-- 1️⃣1️⃣  20250614_11_rls_security_policies.sql
--     ├─ Habilitar RLS: En las 31 tablas
--     ├─ Políticas: ~35 políticas de seguridad
--     │  ├─ Lectura (SELECT): Basada en rol y ownership
--     │  ├─ Escritura (INSERT): Validaciones de rol
--     │  └─ Actualización (UPDATE): Restricciones por rol
--     ├─ Permisos: GRANT en funciones
--     ├─ Índices: Índices de performance final
--     └─ Secuencias: Ninguna
--
--     Políticas: 35+
--     Índices: 6 índices finales

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │                      RESUMEN FINAL                                  │
-- └─────────────────────────────────────────────────────────────────────┘

TOTAL TABLAS:              31
TOTAL ENUMS:              11
TOTAL FUNCIONES SQL:      18
TOTAL TRIGGERS:           30+
TOTAL ÍNDICES:            50+
TOTAL POLÍTICAS RLS:      35+
TOTAL VISTAS:              1

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │                    DEPENDENCIAS VISUALES                            │
-- └─────────────────────────────────────────────────────────────────────┘

-- auth.users (Supabase Auth)
--     │
--     ├─→ profiles [1]
--     │   ├─→ businesses [2]
--     │   │   ├─→ business_hours [2]
--     │   │   ├─→ business_addresses [4]
--     │   │   └─→ categories [2]
--     │   │       └─→ products [3]
--     │   │           ├─→ product_images [3]
--     │   │           ├─→ product_variants [3]
--     │   │           └─→ order_items [5] ←─┐
--     │   │                                  │
--     │   ├─→ addresses [4]                  │
--     │   │                                  │
--     │   ├─→ orders [5] ←──────────────────┘
--     │   │   ├─→ order_items [5]
--     │   │   ├─→ order_tracking [5]
--     │   │   ├─→ group_chats [8]
--     │   │   ├─→ driver_earnings [6]
--     │   │   ├─→ ratings [10]
--     │   │   └─→ chats [8]
--     │   │
--     │   ├─→ drivers [6]
--     │   │   ├─→ driver_locations [6]
--     │   │   ├─→ driver_availability [6]
--     │   │   └─→ driver_earnings [6]
--     │   │
--     │   ├─→ wallets [7]
--     │   │   ├─→ wallet_transactions [7]
--     │   │   └─→ wallet_topups [7]
--     │   │
--     │   ├─→ chats [8]
--     │   │   └─→ messages [8]
--     │   │
--     │   ├─→ group_chats [8]
--     │   │   ├─→ group_chat_members [8]
--     │   │   └─→ group_messages [8]
--     │   │
--     │   ├─→ notifications [9]
--     │   │   ├─→ notification_preferences [9]
--     │   │   └─→ device_tokens [9]
--     │   │
--     │   ├─→ ratings [10]
--     │   │   ├─→ rating_comments [10]
--     │   │   └─→ rating_reactions [10]
--     │   │
--     │   └─→ notification_templates [9]
--     │
--     └─→ roles [1]

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │              TABLAS CRÍTICAS PARA REALTIME                         │
-- └─────────────────────────────────────────────────────────────────────┘

-- Habilitar realtime en Supabase Dashboard para:
-- 1. driver_locations (GPS en vivo)
-- 2. messages (Chat en vivo)
-- 3. group_messages (Chat grupal en vivo)
-- 4. notifications (Alertas en vivo)
-- 5. chats (Estado de conversación)
-- 6. orders (Cambios de estado)

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │                    INSTRUCCIONES DE EJECUCIÓN                      │
-- └─────────────────────────────────────────────────────────────────────┘

-- OPCIÓN 1: Ejecutar archivo por archivo en SQL Editor
-- OPCIÓN 2: Concatenar todos en un archivo y ejecutar con psql
-- OPCIÓN 3: Usar Supabase CLI con: supabase db push

-- ORDEN CRÍTICO: Ejecutar EXACTAMENTE en el orden 1-11
-- NO ejecutar en paralelo, esperar a que cada una complete

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │               VERIFICACIÓN POST-INSTALACIÓN                        │
-- └─────────────────────────────────────────────────────────────────────┘

-- Ejecutar después de completar todas las migraciones:

SELECT 'VERIFICACIÓN DE INSTALACIÓN' as check;

-- 1. Contar tablas (debe ser 31)
SELECT COUNT(*) as tabla_count FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- 2. Contar funciones (debe ser 18+)
SELECT COUNT(*) as function_count FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';

-- 3. Contar triggers (debe ser 30+)
SELECT COUNT(*) as trigger_count FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- 4. Verificar RLS en todas las tablas
SELECT COUNT(*) as rls_count FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE' 
AND rowsecurity = true;

-- 5. Verificar extensiones
SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto', 'postgis');

-- Si los números coinciden: ✅ INSTALACIÓN EXITOSA
-- Si hay discrepancias: ❌ Revisar logs de errores
