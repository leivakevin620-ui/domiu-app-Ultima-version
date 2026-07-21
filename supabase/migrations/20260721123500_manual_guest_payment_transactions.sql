-- Payment records must support manual guest orders without creating a fake
-- authenticated customer. Access remains bound to the order and business/admin
-- policies; a phone number never grants access.

ALTER TABLE public.payment_transactions
  ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS customer_snapshot jsonb;

ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_customer_identity_check;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_customer_identity_check
  CHECK (
    customer_id IS NOT NULL
    OR (
      customer_snapshot IS NOT NULL
      AND nullif(btrim(customer_snapshot->>'name'), '') IS NOT NULL
      AND nullif(btrim(customer_snapshot->>'phone'), '') IS NOT NULL
    )
  );

CREATE OR REPLACE FUNCTION public.sync_order_payment_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer_snapshot jsonb;
BEGIN
  v_customer_snapshot := CASE
    WHEN NEW.customer_id IS NULL THEN coalesce(
      NEW.guest_customer_snapshot,
      NEW.metadata->'customer_snapshot'
    )
    ELSE NULL
  END;

  IF NEW.customer_id IS NULL AND (
    v_customer_snapshot IS NULL
    OR nullif(btrim(v_customer_snapshot->>'name'), '') IS NULL
    OR nullif(btrim(v_customer_snapshot->>'phone'), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'manual_order_guest_payment_snapshot_required'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.payment_transactions(
    order_id,
    customer_id,
    customer_snapshot,
    method,
    status,
    amount,
    provider_reference,
    proof_url,
    metadata,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.customer_id,
    v_customer_snapshot,
    NEW.payment_method,
    NEW.payment_status,
    NEW.total_amount,
    NEW.payment_reference,
    NEW.payment_proof_url,
    jsonb_build_object(
      'order_status', NEW.status,
      'customer_kind', CASE WHEN NEW.customer_id IS NULL THEN 'guest' ELSE 'registered' END,
      'created_manually', coalesce(NEW.created_manually, false)
    ),
    now()
  )
  ON CONFLICT (order_id) DO UPDATE SET
    customer_id = excluded.customer_id,
    customer_snapshot = excluded.customer_snapshot,
    method = excluded.method,
    status = excluded.status,
    amount = excluded.amount,
    provider_reference = excluded.provider_reference,
    proof_url = excluded.proof_url,
    metadata = public.payment_transactions.metadata || excluded.metadata,
    updated_at = now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_order_payment_transaction() FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.payment_transactions.customer_snapshot IS
  'Immutable guest customer identity snapshot. It never grants authentication or order access.';
