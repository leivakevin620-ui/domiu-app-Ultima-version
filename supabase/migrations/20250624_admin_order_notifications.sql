ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'manual_order_created';

INSERT INTO notification_templates (type, title_template, message_template, action_text)
VALUES ('manual_order_created', 'Pedido Manual Creado', 'El administrador ha creado un pedido manual #{{order_number}} para tu negocio', 'Ver Pedido')
ON CONFLICT (type) DO NOTHING;
