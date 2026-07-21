-- Harden manual-order direct access. Privileged order fields can only be
-- written through the authorized server-side service flow.

DROP POLICY IF EXISTS manual_order_drafts_owner_select ON public.manual_order_drafts;
DROP POLICY IF EXISTS manual_order_drafts_owner_insert ON public.manual_order_drafts;
DROP POLICY IF EXISTS manual_order_drafts_owner_update ON public.manual_order_drafts;
DROP POLICY IF EXISTS manual_order_drafts_owner_delete ON public.manual_order_drafts;

CREATE OR REPLACE FUNCTION public.can_access_manual_order_business(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = auth.uid()
      AND profile.status::text = 'active'
      AND (
        profile.role::text IN (
          'super_admin',
          'admin_general',
          'admin_operativo',
          'admin_soporte',
          'admin'
        )
        OR EXISTS (
          SELECT 1
          FROM public.businesses AS business
          WHERE business.id = p_business_id
            AND business.owner_id = auth.uid()
            AND business.is_active = true
            AND business.deleted_at IS NULL
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_manual_order_business(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_manual_order_business(uuid) TO authenticated, service_role;

CREATE POLICY manual_order_drafts_scoped_select
  ON public.manual_order_drafts FOR SELECT TO authenticated
  USING (
    actor_id = auth.uid()
    AND public.can_access_manual_order_business(business_id)
  );

CREATE POLICY manual_order_drafts_scoped_insert
  ON public.manual_order_drafts FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND public.can_access_manual_order_business(business_id)
  );

CREATE POLICY manual_order_drafts_scoped_update
  ON public.manual_order_drafts FOR UPDATE TO authenticated
  USING (
    actor_id = auth.uid()
    AND public.can_access_manual_order_business(business_id)
  )
  WITH CHECK (
    actor_id = auth.uid()
    AND public.can_access_manual_order_business(business_id)
  );

CREATE POLICY manual_order_drafts_scoped_delete
  ON public.manual_order_drafts FOR DELETE TO authenticated
  USING (
    actor_id = auth.uid()
    AND public.can_access_manual_order_business(business_id)
  );

CREATE OR REPLACE FUNCTION public.protect_manual_order_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := coalesce(auth.role()::text, '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_manually = true
       AND v_role <> 'service_role'
       AND current_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'manual_order_server_action_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.created_manually = true OR NEW.created_manually = true THEN
    IF v_role <> 'service_role'
       AND current_user NOT IN ('postgres', 'supabase_admin')
       AND (
         NEW.created_manually IS DISTINCT FROM OLD.created_manually
         OR NEW.creation_source IS DISTINCT FROM OLD.creation_source
         OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
         OR NEW.created_by_role IS DISTINCT FROM OLD.created_by_role
         OR NEW.created_from_panel IS DISTINCT FROM OLD.created_from_panel
         OR NEW.business_id IS DISTINCT FROM OLD.business_id
         OR NEW.branch_id IS DISTINCT FROM OLD.branch_id
         OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
         OR NEW.guest_customer_snapshot IS DISTINCT FROM OLD.guest_customer_snapshot
         OR NEW.delivery_snapshot IS DISTINCT FROM OLD.delivery_snapshot
         OR NEW.business_snapshot IS DISTINCT FROM OLD.business_snapshot
         OR NEW.sales_channel IS DISTINCT FROM OLD.sales_channel
         OR NEW.delivery_type IS DISTINCT FROM OLD.delivery_type
         OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
         OR NEW.delivery_fee_source IS DISTINCT FROM OLD.delivery_fee_source
         OR NEW.delivery_fee_overridden IS DISTINCT FROM OLD.delivery_fee_overridden
         OR NEW.delivery_fee_override_reason IS DISTINCT FROM OLD.delivery_fee_override_reason
         OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
         OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
         OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
         OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
         OR NEW.paid_amount IS DISTINCT FROM OLD.paid_amount
         OR NEW.outstanding_amount IS DISTINCT FROM OLD.outstanding_amount
         OR NEW.currency IS DISTINCT FROM OLD.currency
         OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
         OR NEW.internal_notes IS DISTINCT FROM OLD.internal_notes
         OR NEW.admin_reason IS DISTINCT FROM OLD.admin_reason
       ) THEN
      RAISE EXCEPTION 'manual_order_privileged_fields_are_server_managed' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_manual_order_privileged_fields_trigger ON public.orders;
CREATE TRIGGER protect_manual_order_privileged_fields_trigger
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.protect_manual_order_privileged_fields();

REVOKE ALL ON FUNCTION public.protect_manual_order_privileged_fields() FROM PUBLIC, anon, authenticated;
