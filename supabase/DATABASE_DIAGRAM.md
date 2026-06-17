# 🗂️ DomiU App 1.0 - Diagrama Visual de Base de Datos

## 📊 Estructura General

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE AUTHENTICATION                          │
│                            (auth.users)                                  │
└───────────────────────────┬──────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │      PROFILES (Usuarios)              │
        │                                       │
        │ id, email, role, first_name, status  │
        │ phone, avatar_url, verified_at       │
        └───────────────────────────────────────┘
                            │
        ┌───────────────────┼──────────────────┐
        │                   │                  │
        ▼                   ▼                  ▼
   ┌─────────┐         ┌──────────┐      ┌─────────┐
   │MERCHANTS │         │CUSTOMERS │      │ COURIERS│
   │(Owners)  │         │(Buyers)  │      │(Drivers)│
   └─────────┘         └──────────┘      └─────────┘
        │                   │                  │
        │                   │                  │
        │                   ▼                  │
        │          ┌─────────────────┐        │
        │          │ WALLETS         │        │
        │          │ & TRANSACTIONS  │        │
        │          │ (Billetera)     │        │
        │          └─────────────────┘        │
        │                                     │
        │                                     ▼
        │                            ┌──────────────┐
        │                            │ DRIVERS PROFILE
        │                            │ - License    │
        │                            │ - Vehicle    │
        │                            │ - Rating     │
        │                            └──────────────┘
        │                                     │
        └───────┐                             │
                │                             ▼
                ▼                  ┌───────────────────────┐
        ┌─────────────────┐        │ DRIVER_LOCATIONS      │
        │   BUSINESSES    │        │ (GPS Real-time)       │
        │  (Restaurants)  │        │                       │
        │                 │        │ lat, lng, accuracy    │
        │ name, slug,     │        │ speed, heading        │
        │ logo, rating    │        └───────────────────────┘
        │                 │
        └────────┬────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌──────────┐ ┌───────────┐ ┌──────────────┐
│ BUSINESS │ │CATEGORIES │ │ADDRESSES     │
│_HOURS    │ │           │ │(Business)    │
│          │ │ name,     │ │              │
│day,time  │ │ slug,     │ │ street,city  │
│is_closed │ │ icon      │ │ lat, lng     │
└──────────┘ └─────┬─────┘ └──────────────┘
                   │
                   ▼
            ┌──────────────────┐
            │    PRODUCTS      │
            │                  │
            │ name, price,     │
            │ sku, rating      │
            │ quantity, status │
            └────────┬─────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
   ┌─────────┐ ┌──────────┐ ┌────────────┐
   │ PRODUCT │ │ PRODUCT  │ │ PRODUCT    │
   │ IMAGES  │ │ VARIANTS │ │ RATINGS    │
   │         │ │          │ │            │
   │ url,    │ │ size,    │ │ 1-5 stars, │
   │ primary │ │ color    │ │ review     │
   └─────────┘ └──────────┘ └────────────┘
```

---

## 🛒 Flujo de ÓRDENES

```
┌─────────────────────────────────────────────────────────────────┐
│                        ORDERS (Pedidos)                         │
│                                                                 │
│ order_number, status, total_amount, estimated_delivery_time   │
│                                                                 │
│ RELACIONES:                                                    │
│ ├─→ customer_id (profiles)                                   │
│ ├─→ business_id (businesses)                                 │
│ ├─→ courier_id (profiles/drivers)                            │
│ └─→ delivery_address_id (addresses)                          │
└─────────────────────────────────────────────────────────────────┘
        │
        ├─────────────────────┬──────────────────────┐
        │                     │                      │
        ▼                     ▼                      ▼
   ┌──────────────┐   ┌───────────────┐   ┌─────────────────┐
   │  ORDER_ITEMS │   │ ORDER_TRACKING│   │    RATINGS      │
   │              │   │               │   │                 │
   │ product_id   │   │ status_change │   │ for_merchant    │
   │ quantity     │   │ timestamp     │   │ for_courier     │
   │ unit_price   │   │ notes         │   │ for_product     │
   └──────────────┘   └───────────────┘   └─────────────────┘
        │
        ▼
   PRODUCT (referencia del ítem)
```

---

## 💬 Flujo de COMUNICACIÓN

```
┌────────────────────────────────────────┐
│           CHATS (1-a-1)                │
│                                        │
│ participant_1_id, participant_2_id    │
│ order_id, last_message_at             │
└────────────┬───────────────────────────┘
             │
             ▼
      ┌────────────────┐
      │   MESSAGES     │
      │                │
      │ content,       │
      │ is_read,       │
      │ read_at,       │
      │ file_url       │
      │                │
      │ REALTIME ✨    │
      └────────────────┘


┌────────────────────────────────────────┐
│       GROUP_CHATS (Por orden)          │
│                                        │
│ order_id (UNIQUE)                     │
│ created_by (profiles)                 │
└────────────┬───────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌──────────────┐  ┌────────────────┐
│GROUP_MEMBERS │  │GROUP_MESSAGES  │
│              │  │                │
│member_id,    │  │content,        │
│role,         │  │sender_id,      │
│joined_at     │  │REALTIME ✨     │
└──────────────┘  └────────────────┘
```

---

## 🔔 Flujo de NOTIFICACIONES

```
┌──────────────────────────────────────────┐
│        NOTIFICATIONS (Alertas)           │
│                                          │
│ recipient_id, notification_type,         │
│ title, message, is_read                 │
│ channels: in_app, email, sms, push      │
│                                          │
│ REALTIME ✨                              │
└──────┬──────────────────────────────────┘
       │
    ┌──┴──────────────────────────────┬──┐
    │                                 │  │
    ▼                                 ▼  ▼
┌────────────────────┐    ┌──────────────────────┐
│NOTIFICATION_PREFS  │    │DEVICE_TOKENS         │
│                    │    │(Push notifications)  │
│email_enabled,      │    │                      │
│sms_enabled,        │    │token, platform,      │
│push_enabled,       │    │is_active             │
│quiet_hours         │    │                      │
└────────────────────┘    └──────────────────────┘


┌────────────────────────────────────┐
│  NOTIFICATION_TEMPLATES            │
│  (Predefinidas)                    │
│                                    │
│  type: order_placed, order_ready   │
│  title_template: "Pedido {{..}}"  │
│  message_template: "Tu pedido..." │
└────────────────────────────────────┘
```

---

## 💳 Flujo de PAGOS (Billeteras)

```
┌─────────────────────────────────────┐
│         WALLETS (Billetera)         │
│                                     │
│ user_id (UNIQUE)                    │
│ balance, currency (COP)             │
│ total_credited, total_debited       │
│ is_active                           │
└────────────┬────────────────────────┘
             │
    ┌────────┴────────┬────────────────┐
    │                 │                │
    ▼                 ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌────────────┐
│TRANSACTIONS  │  │  TOPUPS      │  │DRIVER_EARN │
│              │  │              │  │            │
│type: credit  │  │amount,       │  │base_amount │
│type: debit   │  │payment_meth  │  │bonus,      │
│type: bonus   │  │status        │  │total_earned│
│              │  │              │  │status      │
│amount,       │  │              │  │            │
│balance_b/a   │  │              │  │            │
│status,       │  │              │  │            │
│reference_id  │  │              │  │            │
│              │  │              │  │            │
│TRANSACCIONES │  │RECARGAS      │  │GANANCIAS   │
│ATÓMICAS ✓    │  │SEGURAS ✓     │  │COURIER ✓   │
└──────────────┘  └──────────────┘  └────────────┘
```

---

## 🗺️ Flujo de UBICACIONES (Real-time GPS)

```
┌────────────────────────────────────┐
│        DRIVERS (Perfil)            │
│                                    │
│ license_number, vehicle_type,      │
│ status (available/busy/offline)    │
│ rating, total_deliveries           │
│ bank_account                       │
└────────────┬───────────────────────┘
             │
    ┌────────┼──────────┐
    │        │          │
    ▼        ▼          ▼
┌──────────┐ ┌──────────────┐ ┌─────────────┐
│LOCATIONS │ │AVAILABILITY  │ │EARNINGS     │
│          │ │              │ │             │
│lat, lng  │ │day_of_week   │ │order_id     │
│accuracy  │ │starts_at,    │ │total_earned │
│speed,    │ │ends_at       │ │paid_at      │
│heading,  │ │is_working    │ │             │
│altitude  │ │              │ │PAGOS ✓      │
│          │ │              │ │             │
│order_id  │ │              │ │             │
│          │ │              │ │             │
│PostGIS   │ │HORARIO LABOR │ │INGRESOS     │
│GIST IDX  │ │              │ │             │
│REALTIME  │ │              │ │             │
│✨ 1000   │ │              │ │             │
│últimas   │ │              │ │             │
└──────────┘ └──────────────┘ └─────────────┘
```

---

## ⭐ Flujo de CALIFICACIONES

```
┌──────────────────────────────────┐
│          RATINGS                 │
│                                  │
│ rater_id → profiles              │
│ order_id → orders                │
│ rated_entity_id → (variable)     │
│ rating_type: merchant/courier    │
│              /order              │
│                                  │
│ rating (1-5 stars)               │
│ review, images[]                 │
│ verified_purchase                │
│ is_public, is_featured           │
│                                  │
│ response (merchant reply)        │
│ response_by, response_at         │
└──────────┬───────────────────────┘
           │
    ┌──────┴──────────┐
    │                 │
    ▼                 ▼
┌──────────────┐  ┌─────────────┐
│RATING_COMMENT│  │REACTIONS    │
│              │  │             │
│author_id,    │  │user_id,     │
│content,      │  │reaction_typ │
│created_at    │  │helpful/     │
│              │  │unhelpful    │
│COMENTARIOS ✓ │  │VOTOS ✓      │
└──────────────┘  └─────────────┘

ACTUALIZACIÓN AUTOMÁTICA:
├─→ Cuando se crea rating
├─→ Recalcula business.rating
├─→ Recalcula driver.rating
├─→ Recalcula product.rating
└─→ Actualiza counters automáticamente
```

---

## 🔐 Arquitectura de Seguridad (RLS)

```
┌────────────────────────────────────────────────┐
│        ROW LEVEL SECURITY (RLS)                │
│                                                │
│ Habilitado en las 31 tablas                   │
│ 35+ políticas de control de acceso            │
└────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                    ADMIN (*)                        │
│  ├─ Acceso total: READ, WRITE, DELETE              │
│  └─ manage_*, view_analytics                       │
│                                                     │
│              👤 can read/modify all                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                  MERCHANT                          │
│  ├─ own_businesses: READ, WRITE, UPDATE            │
│  ├─ own_products: READ, WRITE, UPDATE              │
│  ├─ own_orders: READ, UPDATE_STATUS                │
│  ├─ own_earnings: READ                             │
│  └─ own_ratings: READ, RESPOND                     │
│                                                     │
│          👤 can manage own business                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                  CUSTOMER                          │
│  ├─ own_profile: READ, UPDATE                      │
│  ├─ own_addresses: READ, WRITE, UPDATE, DELETE     │
│  ├─ own_orders: READ, CREATE                       │
│  ├─ own_wallet: READ (no direct update)            │
│  ├─ own_chats: READ, WRITE                         │
│  ├─ own_ratings: READ, CREATE                      │
│  └─ own_notifications: READ, UPDATE_READ           │
│                                                     │
│          👤 can browse & order                     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                   COURIER                          │
│  ├─ own_profile: READ, UPDATE                      │
│  ├─ own_availability: READ, WRITE                  │
│  ├─ assigned_orders: READ, UPDATE_STATUS           │
│  ├─ own_locations: WRITE (GPS updates)             │
│  ├─ own_earnings: READ                             │
│  ├─ own_wallet: READ (payouts)                     │
│  ├─ order_chats: READ, WRITE                       │
│  └─ own_notifications: READ, UPDATE_READ           │
│                                                     │
│          👤 can deliver orders                     │
└─────────────────────────────────────────────────────┘

POLÍTICAS ESPECIALES:
┌─────────────────────────────────────────────────────┐
│ WALLETS: No direct access                          │
│ ├─ Solo a través de add_wallet_transaction()       │
│ ├─ Transacciones atómicas garantizadas             │
│ └─ Previene race conditions                        │
│                                                     │
│ DRIVER_LOCATIONS: Visibility limitada              │
│ ├─ Propio conductor: WRITE                         │
│ ├─ Cliente de orden: READ                          │
│ ├─ Propietario de negocio: READ                    │
│ └─ Admin: READ                                     │
│                                                     │
│ RATINGS: Públicas + control                        │
│ ├─ Público: READ (is_public=true)                  │
│ ├─ Autor: READ all own                             │
│ ├─ Merchant: RESPOND                               │
│ └─ Dueño: MODERATE                                 │
└─────────────────────────────────────────────────────┘
```

---

## 🔄 Ciclo de Vida de una ORDEN

```
CUSTOMER crea orden:
1. ✅ INSERT en orders (status='pending', payment_status='pending')
2. ✅ INSERT items en order_items
3. ✅ Crear notification para MERCHANT
4. ✅ Crear group_chat con participantes

MERCHANT confirma:
5. ✅ UPDATE orders status='confirmed'
6. ✅ Crear notification para CUSTOMER
7. ✅ Agregar tracking entry

MERCHANT prepara:
8. ✅ UPDATE orders status='preparing'
9. ✅ Crear notification para CUSTOMER

MERCHANT lista:
10. ✅ UPDATE orders status='ready'
11. ✅ Crear notification para COURIER (assignment)

SISTEMA asigna COURIER:
12. ✅ UPDATE orders courier_id=XXX, status='in_transit'
13. ✅ COURIER ve locations
14. ✅ Crear notification para CUSTOMER

COURIER en entrega:
15. ✅ INSERT driver_locations (GPS real-time)
16. ✅ CUSTOMER puede rastrear (REALTIME)

COURIER entrega:
17. ✅ UPDATE orders status='delivered', actual_delivery_time=NOW()
18. ✅ Crear notification para CUSTOMER
19. ✅ Crear driver_earnings entry

CUSTOMER califica:
20. ✅ INSERT ratings (merchant, courier, products)
21. ✅ UPDATE orders rating_by_customer=X
22. ✅ Recalcular business.rating automáticamente
23. ✅ Recalcular driver.rating automáticamente
24. ✅ Crear notification para MERCHANT (review)

MERCHANT responde review:
25. ✅ UPDATE ratings response=XXX
26. ✅ Crear notification para CUSTOMER

FIN: Orden completada, ratings finales registrados
```

---

## 📈 Índices Optimizados

```
BÚSQUEDA POR USUARIO
├─ profiles: email, phone, role, status
├─ businesses: owner_id, slug, is_active
├─ products: business_id, category_id, sku, slug
├─ orders: customer_id, business_id, courier_id
└─ wallets: user_id (UNIQUE)

BÚSQUEDA POR FECHA
├─ orders: (customer_id, status, created_at DESC)
├─ orders: (business_id, status, created_at DESC)
├─ messages: (chat_id, created_at DESC)
├─ notifications: (recipient_id, created_at DESC)
└─ driver_locations: created_at DESC

BÚSQUEDA GEOGRÁFICA (PostGIS GIST)
├─ addresses: location (GIST index)
├─ business_addresses: location (GIST index)
└─ driver_locations: location (GIST index)

SOFT DELETE
├─ profiles: deleted_at
├─ businesses: deleted_at
├─ products: deleted_at
├─ orders: deleted_at
├─ ratings: deleted_at
└─ messages: deleted_at

COMPOSITE PERFORMANCE
├─ (category_id, status) para productos
├─ (business_id, status) para órdenes
├─ (role, status) para profiles
└─ (group_chat_id, created_at DESC) para mensajes
```

---

## 🚀 Capacidades Habilitadas

```
✅ REALTIME (Supabase Realtime)
   ├─ driver_locations (GPS live)
   ├─ messages (chat live)
   ├─ group_messages (group chat)
   ├─ notifications (alerts live)
   ├─ chats (conversación state)
   └─ orders (order status updates)

✅ GEOLOCALIZACIÓN (PostGIS)
   ├─ ST_Distance (distancia entre puntos)
   ├─ ST_DWithin (radio queries)
   ├─ Nearest neighbor búsquedas
   └─ Índices GIST para performance

✅ TRANSACCIONES ATÓMICAS
   ├─ add_wallet_transaction()
   ├─ Lock en fila para consistency
   ├─ Validación de balance
   └─ Recalculate ratings auto

✅ AUTOMATIZACIÓN
   ├─ Triggers en 30+ eventos
   ├─ Número de orden auto-generado
   ├─ Timestamps automáticos
   ├─ Wallet creada automáticamente
   ├─ Ratings recalculados
   └─ Status tracking automático

✅ SEGURIDAD
   ├─ RLS en 31 tablas
   ├─ 35+ políticas de control
   ├─ Funciones solo via grant
   ├─ Validación en base de datos
   └─ Encryption en Supabase
```

---

**Diagrama completo basado en 31 tablas normalizadas para DomiU App 1.0**
**Última actualización: 2025-06-14**
