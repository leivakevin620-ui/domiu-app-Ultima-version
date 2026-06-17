-- supabase/examples_and_queries.sql
-- Ejemplos de queries para operaciones comunes

-- ============================================================================
-- ÓRDENES - OPERACIONES COMUNES
-- ============================================================================

-- 1. Crear una nueva orden
INSERT INTO orders (
  order_number,
  customer_id,
  business_id,
  delivery_address_id,
  status,
  payment_status,
  payment_method,
  subtotal,
  delivery_fee,
  discount_amount,
  tax_amount,
  total_amount
) VALUES (
  generate_order_number(),
  'customer-uuid',
  'business-uuid',
  'address-uuid',
  'pending',
  'pending',
  'credit_card',
  50000,
  5000,
  0,
  8000,
  63000
) RETURNING id, order_number;

-- 2. Actualizar estado de orden y registrar en historial
UPDATE orders
SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
WHERE id = 'order-uuid'
  AND status = 'pending';

-- 3. Asignar courier a una orden
UPDATE orders
SET 
  courier_id = 'driver-uuid',
  status = 'in_transit',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'order-uuid'
  AND status = 'ready';

-- 4. Obtener órdenes activas de un cliente
SELECT 
  o.*,
  b.name as business_name,
  d.first_name as driver_first_name,
  d.last_name as driver_last_name
FROM orders o
LEFT JOIN businesses b ON o.business_id = b.id
LEFT JOIN profiles d ON o.courier_id = d.id
WHERE o.customer_id = 'customer-uuid'
  AND o.status IN ('pending', 'confirmed', 'preparing', 'ready', 'in_transit')
  AND o.deleted_at IS NULL
ORDER BY o.created_at DESC;

-- 5. Órdenes completadas hoy
SELECT COUNT(*) as completed_today
FROM orders
WHERE business_id = 'business-uuid'
  AND status = 'delivered'
  AND DATE(completed_at) = CURRENT_DATE
  AND deleted_at IS NULL;

-- ============================================================================
-- UBICACIONES EN TIEMPO REAL - OPERACIONES GPS
-- ============================================================================

-- 6. Registrar ubicación actual del conductor
INSERT INTO driver_locations (
  driver_id,
  latitude,
  longitude,
  accuracy,
  speed,
  heading,
  order_id
) VALUES (
  'driver-uuid',
  40.7128,
  -74.0060,
  15.5,
  0,
  NULL,
  'order-uuid'
);

-- 7. Obtener ubicación más reciente de un conductor
SELECT 
  latitude,
  longitude,
  accuracy,
  speed,
  created_at
FROM driver_locations
WHERE driver_id = 'driver-uuid'
ORDER BY created_at DESC
LIMIT 1;

-- 8. Encontrar repartidores disponibles cercanos al cliente (radio 5km)
SELECT 
  d.id,
  d.rating,
  p.first_name,
  p.last_name,
  p.avatar_url,
  ST_Distance(
    dl.location::geography,
    ST_SetSRID(ST_MakePoint(-74.0060, 40.7128), 4326)::geography
  ) as distance_meters
FROM drivers d
JOIN profiles p ON d.id = p.id
JOIN driver_locations dl ON d.id = dl.driver_id
WHERE d.status = 'available'
  AND d.is_verified = true
  AND d.is_active = true
  AND ST_DWithin(
    dl.location::geography,
    ST_SetSRID(ST_MakePoint(-74.0060, 40.7128), 4326)::geography,
    5000
  )
ORDER BY ST_Distance(
  dl.location::geography,
  ST_SetSRID(ST_MakePoint(-74.0060, 40.7128), 4326)::geography
)
LIMIT 5;

-- 9. Rastrear progreso del repartidor
SELECT 
  d.id,
  p.first_name,
  p.phone,
  dl.latitude,
  dl.longitude,
  dl.speed,
  dl.created_at,
  ST_Distance(
    dl.location::geography,
    a.location::geography
  ) as distance_to_delivery_meters
FROM driver_locations dl
JOIN drivers d ON dl.driver_id = d.id
JOIN profiles p ON d.id = p.id
LEFT JOIN addresses a ON (SELECT delivery_address_id FROM orders WHERE id = dl.order_id)
WHERE dl.order_id = 'order-uuid'
ORDER BY dl.created_at DESC
LIMIT 1;

-- ============================================================================
-- BILLETERAS - OPERACIONES DE PAGO
-- ============================================================================

-- 10. Crear transacción de billetera (usando función segura)
SELECT add_wallet_transaction(
  'wallet-uuid',
  'debit'::transaction_type,
  15000,
  'order-uuid',
  'order',
  'Pago de pedido ORD-20250614-00001'
);

-- 11. Obtener balance actual de billetera
SELECT 
  w.balance,
  w.currency,
  w.total_credited,
  w.total_debited
FROM wallets w
WHERE w.user_id = 'user-uuid'
  AND w.is_active = true;

-- 12. Historial de transacciones de billetera
SELECT 
  transaction_type,
  amount,
  balance_before,
  balance_after,
  status,
  reference_type,
  description,
  created_at
FROM wallet_transactions
WHERE wallet_id = 'wallet-uuid'
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- 13. Resumen de ingresos diarios (para repartidores)
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_deliveries,
  SUM(total_earned) as total_earned,
  AVG(total_earned) as avg_per_delivery
FROM driver_earnings
WHERE driver_id = 'driver-uuid'
  AND status = 'completed'
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================================================
-- MENSAJES Y CHATS
-- ============================================================================

-- 14. Obtener o crear chat entre dos usuarios
SELECT * FROM chats
WHERE (
  (participant_1_id = 'user1-uuid' AND participant_2_id = 'user2-uuid')
  OR (participant_1_id = 'user2-uuid' AND participant_2_id = 'user1-uuid')
)
AND deleted_at IS NULL;

-- 15. Obtener mensajes no leídos
SELECT 
  m.id,
  m.content,
  p.first_name,
  p.last_name,
  m.created_at
FROM messages m
JOIN profiles p ON m.sender_id = p.id
WHERE m.receiver_id = 'user-uuid'
  AND m.is_read = false
  AND m.deleted_at IS NULL
ORDER BY m.created_at DESC;

-- 16. Marcar mensajes como leídos
SELECT mark_messages_as_read('chat-uuid', 'user-uuid');

-- 17. Obtener historial de chat
SELECT 
  m.*,
  p_sender.first_name as sender_name,
  p_receiver.first_name as receiver_name
FROM messages m
JOIN profiles p_sender ON m.sender_id = p_sender.id
JOIN profiles p_receiver ON m.receiver_id = p_receiver.id
WHERE m.chat_id = 'chat-uuid'
  AND m.deleted_at IS NULL
ORDER BY m.created_at DESC
LIMIT 50;

-- ============================================================================
-- NOTIFICACIONES
-- ============================================================================

-- 18. Crear notificación (usando función segura)
SELECT create_notification(
  'user-uuid',
  'order_placed'::notification_type,
  'Pedido Creado',
  'Tu pedido ha sido creado exitosamente',
  'order-uuid'
);

-- 19. Obtener notificaciones no leídas
SELECT 
  id,
  title,
  message,
  notification_type,
  created_at
FROM notifications
WHERE recipient_id = 'user-uuid'
  AND is_read = false
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- 20. Marcar notificación como leída
SELECT mark_notification_as_read('notification-uuid');

-- 21. Obtener preferencias de notificación
SELECT * FROM notification_preferences
WHERE user_id = 'user-uuid';

-- 22. Actualizar preferencias de notificación
UPDATE notification_preferences
SET 
  email_enabled = true,
  push_enabled = true,
  promotion_notifications = false,
  quiet_hours_start = '22:00',
  quiet_hours_end = '08:00'
WHERE user_id = 'user-uuid';

-- ============================================================================
-- CALIFICACIONES Y REVIEWS
-- ============================================================================

-- 23. Crear una calificación
INSERT INTO ratings (
  order_id,
  rater_id,
  rated_entity_id,
  rating_type,
  rating,
  title,
  review,
  images,
  verified_purchase,
  is_public
) VALUES (
  'order-uuid',
  'customer-uuid',
  'business-uuid',
  'merchant',
  4.5,
  'Excelente servicio',
  'Comida fresca y rápida entrega',
  ARRAY['https://...', 'https://...'],
  true,
  true
) RETURNING *;

-- 24. Obtener calificaciones públicas de un negocio
SELECT 
  r.*,
  p.first_name,
  p.avatar_url,
  COUNT(CASE WHEN rr.reaction_type = 'helpful' THEN 1 END) as helpful_count
FROM ratings r
JOIN profiles p ON r.rater_id = p.id
LEFT JOIN rating_reactions rr ON r.id = rr.rating_id
WHERE r.rated_entity_id = 'business-uuid'
  AND r.rating_type = 'merchant'
  AND r.is_public = true
  AND r.deleted_at IS NULL
GROUP BY r.id, p.first_name, p.avatar_url
ORDER BY r.created_at DESC;

-- 25. Estadísticas de rating
SELECT 
  CEIL(rating) as rating_stars,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
FROM ratings
WHERE rated_entity_id = 'business-uuid'
  AND rating_type = 'merchant'
  AND is_public = true
  AND deleted_at IS NULL
GROUP BY CEIL(rating)
ORDER BY rating_stars DESC;

-- ============================================================================
-- CATÁLOGO DE PRODUCTOS
-- ============================================================================

-- 26. Obtener categorías de un negocio con productos
SELECT 
  c.id,
  c.name,
  c.display_order,
  COUNT(p.id) as product_count,
  json_agg(
    json_build_object(
      'id', p.id,
      'name', p.name,
      'price', p.price,
      'discount_price', p.discount_price,
      'rating', p.rating,
      'image', (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = true LIMIT 1)
    )
  ) as products
FROM categories c
LEFT JOIN products p ON c.id = p.category_id AND p.status = 'available' AND p.deleted_at IS NULL
WHERE c.business_id = 'business-uuid'
  AND c.is_active = true
  AND c.deleted_at IS NULL
GROUP BY c.id, c.name, c.display_order
ORDER BY c.display_order;

-- 27. Búsqueda de productos
SELECT 
  p.*,
  c.name as category_name,
  b.name as business_name,
  array_agg(pi.image_url) as images
FROM products p
JOIN categories c ON p.category_id = c.id
JOIN businesses b ON p.business_id = b.id
LEFT JOIN product_images pi ON p.id = pi.product_id
WHERE (
  p.name ILIKE '%pizza%'
  OR p.description ILIKE '%pizza%'
  OR c.name ILIKE '%pizza%'
)
AND p.status = 'available'
AND p.deleted_at IS NULL
AND b.is_active = true
GROUP BY p.id, c.name, b.name
ORDER BY p.rating DESC
LIMIT 20;

-- 28. Productos destacados
SELECT * FROM products
WHERE is_featured = true
  AND is_special = true
  AND status = 'available'
  AND deleted_at IS NULL
ORDER BY rating DESC
LIMIT 10;

-- ============================================================================
-- ANALYTICS & REPORTES
-- ============================================================================

-- 29. Resumen de negocio (hoy)
SELECT 
  COUNT(DISTINCT o.id) as total_orders,
  SUM(o.total_amount) as total_sales,
  AVG(o.total_amount) as avg_order_value,
  COUNT(DISTINCT o.customer_id) as unique_customers,
  COALESCE(b.rating, 0) as business_rating
FROM orders o
JOIN businesses b ON o.business_id = b.id
WHERE o.business_id = 'business-uuid'
  AND DATE(o.created_at) = CURRENT_DATE
  AND o.status NOT IN ('cancelled', 'refunded')
  AND o.deleted_at IS NULL
GROUP BY b.rating;

-- 30. Top productos por ventas
SELECT 
  p.id,
  p.name,
  COUNT(oi.id) as times_ordered,
  SUM(oi.quantity) as total_quantity,
  SUM(oi.item_total) as total_revenue
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
WHERE p.business_id = 'business-uuid'
  AND p.deleted_at IS NULL
GROUP BY p.id, p.name
ORDER BY total_revenue DESC
LIMIT 10;

-- ============================================================================
-- MANTENIMIENTO
-- ============================================================================

-- 31. Limpiar notificaciones antiguas (>90 días y leídas)
DELETE FROM notifications
WHERE recipient_id = 'user-uuid'
  AND is_read = true
  AND created_at < CURRENT_DATE - INTERVAL '90 days';

-- 32. Archivar órdenes completadas antiguas (>365 días)
UPDATE orders
SET deleted_at = CURRENT_TIMESTAMP
WHERE status IN ('delivered', 'cancelled', 'refunded')
  AND created_at < CURRENT_DATE - INTERVAL '365 days'
  AND deleted_at IS NULL;

-- 33. Recalcular rating de un negocio (para sincronización)
SELECT recalculate_business_rating('business-uuid');

-- ============================================================================
-- QUERIES DE DESARROLLO
-- ============================================================================

-- 34. Ver estructura de tabla
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;

-- 35. Ver triggers de una tabla
SELECT trigger_name, event_manipulation, trigger_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public' AND event_object_table = 'orders';

-- 36. Ver índices
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'orders';

-- 37. Ver tamaño de tablas
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- SEED DATA (PARA PRUEBAS)
-- ============================================================================

-- 38. Insertar roles (si no existen)
INSERT INTO roles (name, description, permissions)
VALUES 
  ('admin', 'Administrator', '["*"]'),
  ('merchant', 'Business Owner', '["manage_products", "manage_orders"]'),
  ('customer', 'Customer', '["browse", "order"]'),
  ('courier', 'Delivery Driver', '["deliver"])
ON CONFLICT (name) DO NOTHING;

-- 39. Insertar templates de notificación
INSERT INTO notification_templates (
  type,
  title_template,
  message_template,
  description_template,
  action_text
) VALUES 
  ('order_placed', 'Pedido Creado', 'Tu pedido {{order_number}} ha sido creado', 'Espera confirmación', 'Ver Pedido'),
  ('order_delivered', 'Entregado', 'Tu pedido {{order_number}} ha sido entregado', 'Gracias por tu compra', 'Calificar')
ON CONFLICT (type) DO NOTHING;
