-- Migration: 20250617_notifications_triggers.sql
-- Description: Add notification types, triggers, and default templates for Phase 16

-- Enum values added via separate migration (2025061700) to avoid PostgreSQL transaction limitations

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

DROP TRIGGER IF EXISTS notify_new_order_trigger ON orders;
CREATE TRIGGER notify_new_order_trigger
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION notify_new_order();

DROP TRIGGER IF EXISTS notify_order_status_change_trigger ON orders;
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

DROP TRIGGER IF EXISTS notify_new_message_trigger ON messages;
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

DROP TRIGGER IF EXISTS notify_new_registration_trigger ON profiles;
CREATE TRIGGER notify_new_registration_trigger
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION notify_new_registration();