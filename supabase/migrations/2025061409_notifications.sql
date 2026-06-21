-- Migration: 20250614_09_notifications.sql
-- Description: Create notifications table for real-time alerts

DO $$ BEGIN CREATE TYPE notification_type AS ENUM (
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
  'review_reminder'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'sms', 'push'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notification_type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  action_url VARCHAR(500),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  reference_id VARCHAR(255),
  reference_type VARCHAR(100),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  channels notification_channel[] DEFAULT '{in_app}',
  metadata JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sender_id ON notifications(sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_order_id ON notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_deleted_at ON notifications(deleted_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON notifications(recipient_id, created_at DESC);

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT TRUE,
  sms_enabled BOOLEAN DEFAULT FALSE,
  push_enabled BOOLEAN DEFAULT TRUE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  order_notifications BOOLEAN DEFAULT TRUE,
  promotion_notifications BOOLEAN DEFAULT TRUE,
  message_notifications BOOLEAN DEFAULT TRUE,
  payment_notifications BOOLEAN DEFAULT TRUE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Create notification templates table
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type notification_type NOT NULL UNIQUE,
  title_template VARCHAR(255) NOT NULL,
  message_template TEXT NOT NULL,
  description_template TEXT,
  icon TEXT,
  color VARCHAR(7), -- hex color
  action_text VARCHAR(100),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default notification templates
INSERT INTO notification_templates (
  type,
  title_template,
  message_template,
  description_template,
  action_text
) VALUES
('order_placed', 'Pedido Creado', 'Tu pedido {{order_number}} ha sido creado exitosamente', 'Está siendo procesado por el restaurante', 'Ver Pedido'),
('order_confirmed', 'Pedido Confirmado', 'El restaurante ha confirmado tu pedido {{order_number}}', 'Será preparado pronto', 'Ver Pedido'),
('order_preparing', 'Preparando', 'Tu pedido {{order_number}} está siendo preparado', 'Tiempo estimado: {{time}} minutos', 'Ver Pedido'),
('order_ready', 'Listo para Recoger', 'Tu pedido {{order_number}} está listo', 'Un repartidor lo recogerá pronto', 'Ver Pedido'),
('order_in_transit', 'En Camino', 'Tu pedido está en camino', 'Tiempo estimado de entrega: {{time}} minutos', 'Seguir'),
('order_delivered', 'Entregado', 'Tu pedido {{order_number}} ha sido entregado', 'Gracias por tu compra', 'Calificar'),
('order_cancelled', 'Pedido Cancelado', 'Tu pedido {{order_number}} ha sido cancelado', '{{reason}}', 'Ver Detalles'),
('payment_received', 'Pago Recibido', 'Hemos recibido tu pago', 'Tu pedido será procesado pronto', 'Ver Pedido'),
('driver_assigned', 'Repartidor Asignado', 'Se ha asignado un repartidor a tu pedido', 'Calificación: {{rating}}', 'Ver Detalles'),
('new_message', 'Nuevo Mensaje', '{{sender}} te ha enviado un mensaje', '{{preview}}', 'Ver Mensaje'),
('promotion', 'Oferta Especial', '{{promotion_title}}', '{{promotion_description}}', 'Ver Oferta')
ON CONFLICT (type) DO NOTHING;

-- Create device tokens table for push notifications
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL UNIQUE,
  platform VARCHAR(50), -- ios, android, web
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(token);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON notification_preferences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_templates_updated_at ON notification_templates;
CREATE TRIGGER update_notification_templates_updated_at
BEFORE UPDATE ON notification_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_device_tokens_updated_at ON device_tokens;
CREATE TRIGGER update_device_tokens_updated_at
BEFORE UPDATE ON device_tokens
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_as_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE notifications
  SET 
    is_read = TRUE,
    read_at = CURRENT_TIMESTAMP
  WHERE id = p_notification_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to create notification for user
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

-- Create automatic notification preferences for new users
CREATE OR REPLACE FUNCTION create_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS create_notification_prefs_on_profile_creation ON profiles;
CREATE TRIGGER create_notification_prefs_on_profile_creation
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION create_notification_preferences();