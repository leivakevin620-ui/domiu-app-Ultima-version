-- Migration: 2025061700_add_enum_values
-- Description: Add enum values for notification_type, separate from other operations to avoid PostgreSQL transaction limitation

-- Add new notification types
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_order';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_order_available';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_registration';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'incident';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'report';

-- Cannot insert notification_templates here because they reference the new enum values in the same transaction
-- This is done in 2025061705_notifications_triggers.sql instead
