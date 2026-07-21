-- Defensive database validation for the operational options selected by
-- administration or the business. The server actions already validate these
-- values, but the database remains the final authority.

CREATE OR REPLACE FUNCTION public.validate_manual_order_operational_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_branch public.business_addresses%rowtype;
  v_driver public.drivers%rowtype;
BEGIN
  IF NEW.created_manually IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  IF NEW.branch_id IS NOT NULL THEN
    SELECT * INTO v_branch
    FROM public.business_addresses
    WHERE id = NEW.branch_id
      AND business_id = NEW.business_id
      AND is_active = true
      AND deleted_at IS NULL
    LIMIT 1;
  ELSE
    SELECT * INTO v_branch
    FROM public.business_addresses
    WHERE business_id = NEW.business_id
      AND is_active = true
      AND deleted_at IS NULL
    ORDER BY is_primary DESC NULLS LAST, updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_branch.id IS NULL THEN
    RAISE EXCEPTION 'manual_order_active_branch_required' USING ERRCODE = '22023';
  END IF;

  IF NEW.delivery_type = 'delivery'
     AND v_branch.delivery_available IS DISTINCT FROM true
     AND NOT (
       NEW.created_from_panel = 'admin'
       AND nullif(btrim(NEW.admin_reason), '') IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'manual_order_branch_delivery_disabled' USING ERRCODE = '22023';
  END IF;

  IF NEW.courier_id IS NOT NULL THEN
    IF NEW.delivery_type = 'pickup' THEN
      RAISE EXCEPTION 'manual_order_pickup_cannot_have_courier' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_driver
    FROM public.drivers
    WHERE id = NEW.courier_id
      AND is_active = true
      AND is_verified = true
      AND is_available = true
      AND status::text = 'available'
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_driver.id IS NULL THEN
      RAISE EXCEPTION 'manual_order_courier_not_eligible' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_validate_manual_order_operational_context_trigger ON public.orders;
CREATE TRIGGER aa_validate_manual_order_operational_context_trigger
BEFORE INSERT OR UPDATE OF branch_id, business_id, courier_id, delivery_type ON public.orders
FOR EACH ROW
WHEN (NEW.created_manually = true)
EXECUTE FUNCTION public.validate_manual_order_operational_context();

CREATE OR REPLACE FUNCTION public.record_manual_order_initial_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.created_manually = true AND NEW.courier_id IS NOT NULL THEN
    INSERT INTO public.order_events(
      order_id,
      event_type,
      actor_id,
      actor_role,
      description,
      metadata
    ) VALUES (
      NEW.id,
      'courier_assigned',
      NEW.created_by_user_id,
      NEW.created_by_role,
      'Repartidor asignado durante la creación manual del pedido',
      jsonb_build_object(
        'courier_id', NEW.courier_id,
        'created_from_panel', NEW.created_from_panel,
        'assignment_source', 'manual_order_creation'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_manual_order_initial_assignment_trigger ON public.orders;
CREATE TRIGGER record_manual_order_initial_assignment_trigger
AFTER INSERT ON public.orders
FOR EACH ROW
WHEN (NEW.created_manually = true AND NEW.courier_id IS NOT NULL)
EXECUTE FUNCTION public.record_manual_order_initial_assignment();

REVOKE ALL ON FUNCTION public.validate_manual_order_operational_context() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_manual_order_initial_assignment() FROM PUBLIC, anon, authenticated;
