-- Migration: 20250617_notifications_triggers.sql
-- Description: Add notification types, triggers, and default templates for Phase 16

-- PostgreSQL no permite utilizar un valor agregado con ALTER TYPE antes de
-- confirmar la transacción. Para mantener esta migración completamente
-- atómica, se reconstruye el enum conservando sus valores y declarando los
-- tipos posteriores que forman parte del esquema actual.
DROP FUNCTION IF EXISTS create_notification(UUID, notification_type, VARCHAR, TEXT, UUID, VARCHAR, VARCHAR, JSONB);

ALTER TABLE notifications
  ALTER COLUMN notification_type TYPE TEXT
  USING notification_type::TEXT;

ALTER TABLE notification_templates
  ALTER COLUMN type TYPE TEXT
  USING type::TEXT;

DROP TYPE notification_type;

CREATE TYPE notification_type AS ENUM (
  'order_placed',
  'order_confirmed',
  'order_preparing',
  'order_ready',
  'order_in_transit',
  'order_delivered',
  'order_cancelled',
  'payment_received',
  'payment_failed',
  'new_message',
  'promotion',
  'rate_request',
  'driver_assigned',
  'courier_nearby',
  'system_alert',
  'review_reminder',
  'new_order',
  'new_order_available',
  'new_registration',
  'incident',
  'report',
  'manual_order_created',
  'order_assigned',
  'admin_alert',
  'order_update'
);

ALTER TABLE notifications
  ALTER COLUMN notification_type TYPE notification_type
  USING notification_type::notification_type;

ALTER TABLE notification_templates
  ALTER COLUMN type TYPE notification_type
  USING type::notification_type;

CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_id UUID,
  p_notification_type notification_type,
  p_title VARCHAR,
  p_message TEXT,
  p_order_id UUID DEFAULT NULL,
  p_reference_id VARCHAR DEFAULT NULL,
  p_reference_type VARCHAR DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS notifications AS $$
DECLARE
  v_notification notifications;
BEGIN
  INSERT INTO notifications (
    recipient_id,
    notification_type,
    title,
    message,
    order_id,
    reference_id,
    reference_type,
    metadata
  ) VALUES (
    p_recipient_id,
    p_notification_type,
    p_title,
    p_message,
    p_order_id,
    p_reference_id,
    p_reference_type,
    p_metadata
  ) RETURNING * INTO v_notification;

  RETURN v_notification;
END;
$$ LANGUAGE plpgsql;

INSERT INTO notification_templates (type, title_template, message_template, action_text) VALUES
('new_order', 'Nuevo Pedido', 'Has recibido un nuevo pedido #{{order_number}}', 'Ver Pedido'),
('new_order_available', 'Nuevo Pedido Disponible', 'Hay un nuevo pedido disponible en {{business_name}}', 'Ver Pedido'),
('new_registration', 'Nuevo Registro', '{{name}} se ha registrado como {{role}}', 'Ver Usuario'),
('incident', 'Incidencia Reportada', 'Se ha reportado una incidencia en el pedido #{{order_number}}', 'Ver Pedido'),
('report', 'Reporte Recibido', 'Se ha recibido un nuevo reporte de {{type}}', 'Ver Reporte')
ON CONFLICT (type) DO NOTHING;

CREATE OR REPLACE FUNCTION notify_new_order()
RETURNS TRIGGER AS $$
DECLARE
  v_order_number VARCHAR;
BEGIN
  SELECT order_number INTO v_order_number FROM orders WHERE id = NEW.id;
  PERFORM create_notification(
    (SELECT owner_id FROM businesses WHERE id = NEW.business_id),
    'new_order',
    'Nuevo Pedido',
    'Has recibido un nuevo pedido #' || v_order_number,
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_notif_type notification_type;
  v_title VARCHAR;
  v_message VARCHAR;
  v_order_number VARCHAR;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  SELECT order_number INTO v_order_number FROM orders WHERE id = NEW.id;
  CASE NEW.status
    WHEN 'confirmed' THEN
      PERFORM create_notification(NEW.customer_id, 'order_confirmed', 'Pedido Confirmado', 'Tu pedido #' || v_order_number || ' ha sido confirmado', NEW.id);
    WHEN 'preparing' THEN
      PERFORM create_notification(NEW.customer_id, 'order_preparing', 'Preparando tu Pedido', 'Tu pedido #' || v_order_number || ' está siendo preparado', NEW.id);
    WHEN 'ready' THEN
      PERFORM create_notification(NEW.customer_id, 'order_ready', 'Pedido Listo', 'Tu pedido #' || v_order_number || ' está listo para recoger', NEW.id);
    WHEN 'assigned' THEN
      PERFORM create_notification(NEW.customer_id, 'driver_assigned', 'Repartidor Asignado', 'Se ha asignado un repartidor a tu pedido #' || v_order_number, NEW.id);
      IF NEW.courier_id IS NOT NULL THEN
        PERFORM create_notification(NEW.courier_id, 'order_assigned', 'Pedido Asignado', 'Se te ha asignado el pedido #' || v_order_number, NEW.id);
      END IF;
    WHEN 'in_transit' THEN
      PERFORM create_notification(NEW.customer_id, 'order_in_transit', 'Pedido en Camino', 'Tu pedido #' || v_order_number || ' está en camino', NEW.id);
    WHEN 'delivered' THEN
      PERFORM create_notification(NEW.customer_id, 'order_delivered', 'Pedido Entregado', 'Tu pedido #' || v_order_number || ' ha sido entregado', NEW.id);
    WHEN 'cancelled' THEN
      PERFORM create_notification(NEW.customer_id, 'order_cancelled', 'Pedido Cancelado', 'El pedido #' || v_order_number || ' ha sido cancelado', NEW.id);
      PERFORM create_notification(
        (SELECT owner_id FROM businesses WHERE id = NEW.business_id),
        'order_cancelled', 'Pedido Cancelado', 'El pedido #' || v_order_number || ' ha sido cancelado por el cliente', NEW.id
      );
    ELSE
      RETURN NEW;
  END CASE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_new_order_trigger
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION notify_new_order();

CREATE TRIGGER notify_order_status_change_trigger
AFTER UPDATE OF status ON orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION notify_order_status_change();

CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  v_sender_name VARCHAR;
BEGIN
  SELECT COALESCE(first_name || ' ' || last_name, email) INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
  PERFORM create_notification(
    NEW.receiver_id,
    'new_message',
    'Nuevo Mensaje',
    v_sender_name || ' te ha enviado un mensaje',
    NULL,
    NEW.chat_id::VARCHAR,
    'chat'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_new_message_trigger
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION notify_new_message();

CREATE OR REPLACE FUNCTION notify_new_registration()
RETURNS TRIGGER AS $$
DECLARE
  v_name VARCHAR;
  v_role VARCHAR;
BEGIN
  IF NEW.role NOT IN ('merchant', 'courier') THEN RETURN NEW; END IF;
  v_name := COALESCE(NEW.first_name || ' ' || NEW.last_name, NEW.email);
  v_role := CASE WHEN NEW.role = 'merchant' THEN 'negocio' WHEN NEW.role = 'courier' THEN 'repartidor' ELSE NEW.role END;
  INSERT INTO notifications (recipient_id, notification_type, title, message, reference_id, reference_type)
  SELECT id, 'new_registration', 'Nuevo Registro', v_name || ' se ha registrado como ' || v_role, NEW.id::VARCHAR, 'profile'
  FROM profiles WHERE role = 'admin';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_new_registration_trigger
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION notify_new_registration();
