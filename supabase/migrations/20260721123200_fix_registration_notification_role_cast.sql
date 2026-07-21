-- Existing registration notification code allowed PostgreSQL to infer the
-- CASE expression as user_role, then attempted to cast the display label
-- "negocio" back into that enum. Cast role to text before building the label.
CREATE OR REPLACE FUNCTION public.notify_new_registration()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_role_label text;
BEGIN
  IF NEW.role::text NOT IN ('merchant', 'courier') THEN
    RETURN NEW;
  END IF;

  v_name := coalesce(
    nullif(btrim(concat_ws(' ', NEW.first_name, NEW.last_name)), ''),
    NEW.email
  );
  v_role_label := CASE NEW.role::text
    WHEN 'merchant' THEN 'negocio'
    WHEN 'courier' THEN 'repartidor'
    ELSE NEW.role::text
  END;

  INSERT INTO public.notifications (
    recipient_id,
    notification_type,
    title,
    message,
    reference_id,
    reference_type
  )
  SELECT
    profile.id,
    'new_registration',
    'Nuevo Registro',
    v_name || ' se ha registrado como ' || v_role_label,
    NEW.id::text,
    'profile'
  FROM public.profiles AS profile
  WHERE profile.role::text IN (
    'admin',
    'super_admin',
    'admin_general',
    'admin_operativo'
  );

  RETURN NEW;
END;
$$;
