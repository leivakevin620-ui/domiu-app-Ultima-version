-- Reproducible integration checks for manual orders.
-- Run against a disposable or preview database after applying migrations:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/manual_orders_integration.sql
-- Every fixture is wrapped in a transaction and rolled back.

BEGIN;

DO $$
DECLARE
  v_actor uuid := gen_random_uuid();
  v_business uuid := gen_random_uuid();
  v_branch uuid := gen_random_uuid();
  v_product uuid := gen_random_uuid();
  v_key uuid := gen_random_uuid();
  v_email text := 'manual-order-' || replace(v_actor::text, '-', '') || '@domiu.test';
  v_slug text := 'manual-order-' || left(replace(v_business::text, '-', ''), 16);
  v_payload jsonb;
  v_items jsonb;
  v_created jsonb;
  v_replayed jsonb;
  v_order_id uuid;
  v_order public.orders%rowtype;
  v_payment public.payment_transactions%rowtype;
  v_stock integer;
  v_snapshot_name text;
  v_conflict_rejected boolean := false;
BEGIN
  INSERT INTO auth.users(id, email, raw_app_meta_data, raw_user_meta_data)
  VALUES (
    v_actor,
    v_email,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  );

  INSERT INTO public.profiles(id, role, email, first_name, last_name, status)
  VALUES (v_actor, 'admin', v_email, 'Prueba', 'Pedidos manuales', 'active');

  INSERT INTO public.businesses(id, owner_id, name, slug, is_active, is_verified)
  VALUES (v_business, v_actor, 'Negocio prueba pedidos manuales', v_slug, true, true);

  INSERT INTO public.business_addresses(
    id,
    business_id,
    name,
    street_address,
    formatted_address,
    city,
    state_province,
    latitude,
    longitude,
    is_primary,
    delivery_available,
    is_active,
    service_radius_km
  ) VALUES (
    v_branch,
    v_business,
    'Sede principal',
    'Calle 10 # 5-20',
    'Calle 10 # 5-20, Santa Marta',
    'Santa Marta',
    'Magdalena',
    11.2408,
    -74.1990,
    true,
    true,
    true,
    10
  );

  INSERT INTO public.products(
    id,
    business_id,
    sku,
    name,
    slug,
    price,
    status,
    quantity_available,
    total_sales
  ) VALUES (
    v_product,
    v_business,
    'MANUAL-TEST-1',
    'Producto de prueba',
    'producto-' || left(replace(v_product::text, '-', ''), 16),
    10000,
    'available',
    10,
    0
  );

  v_payload := jsonb_build_object(
    'business_id', v_business,
    'branch_id', v_branch,
    'customer_id', '',
    'courier_id', '',
    'status', 'confirmed',
    'payment_status', 'pending',
    'payment_method', 'cash',
    'paid_amount', 0,
    'delivery_fee', 1,
    'discount_amount', 0,
    'tax_amount', 0,
    'tip_amount', 0,
    'surcharge_amount', 0,
    'courier_earnings', 1,
    'platform_earnings', 1,
    'preparation_notes', 'Sin cebolla',
    'internal_notes', 'Prueba transaccional',
    'courier_notes', 'Llamar al llegar',
    'admin_reason', 'Validación automática de integración',
    'creation_source', 'admin_manual',
    'created_by_user_id', v_actor,
    'created_by_role', 'admin',
    'created_from_panel', 'admin',
    'sales_channel', 'whatsapp',
    'sales_channel_detail', '',
    'delivery_type', 'delivery',
    'delivery_fee_source', 'automatic',
    'delivery_fee_overridden', false,
    'delivery_fee_override_reason', '',
    'guest_customer_snapshot', jsonb_build_object(
      'kind', 'guest',
      'name', 'Cliente invitado de prueba',
      'phone', '3000000000'
    ),
    'delivery_snapshot', jsonb_build_object(
      'type', 'delivery',
      'address', 'Carrera 20 # 10-30',
      'city', 'Santa Marta',
      'distanceKm', 3.2
    ),
    'business_snapshot', jsonb_build_object(
      'id', v_business,
      'name', 'Negocio prueba pedidos manuales'
    ),
    'idempotency_key', v_key,
    'metadata', jsonb_build_object(
      'request_fingerprint', 'catalog-delivery-test',
      'distance_km', 3.2
    )
  );

  v_items := jsonb_build_array(
    jsonb_build_object(
      'product_id', v_product,
      'is_custom_item', false,
      'name', 'Nombre manipulado que debe ignorarse',
      'quantity', 2,
      'unit_price', 1,
      'instructions', 'Término medio',
      'variant', '{}'::jsonb,
      'modifiers', '[]'::jsonb,
      'metadata', '{}'::jsonb
    )
  );

  v_created := public.create_manual_order_atomic(v_payload, v_items);
  v_order_id := (v_created->>'order_id')::uuid;

  SELECT quantity_available INTO v_stock
  FROM public.products
  WHERE id = v_product;
  IF v_stock <> 8 THEN
    RAISE EXCEPTION 'Expected stock 8 after creation; received %', v_stock;
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_order_id;

  IF v_order.subtotal <> 20000 THEN
    RAISE EXCEPTION 'Frontend price was trusted; subtotal=%', v_order.subtotal;
  END IF;
  IF v_order.delivery_fee <= 0 THEN
    RAISE EXCEPTION 'Automatic delivery fee was not calculated';
  END IF;
  IF v_order.total_amount <> v_order.subtotal + v_order.delivery_fee THEN
    RAISE EXCEPTION 'Final total is inconsistent; subtotal=% fee=% total=%',
      v_order.subtotal, v_order.delivery_fee, v_order.total_amount;
  END IF;
  IF v_order.outstanding_amount <> v_order.total_amount THEN
    RAISE EXCEPTION 'Outstanding amount is inconsistent';
  END IF;
  IF v_order.customer_id IS NOT NULL THEN
    RAISE EXCEPTION 'Guest order created a registered customer reference';
  END IF;
  IF v_order.branch_id <> v_branch OR v_order.pickup_address_id <> v_branch THEN
    RAISE EXCEPTION 'Authorized branch was not preserved';
  END IF;
  IF v_order.courier_earnings + v_order.platform_earnings <> v_order.delivery_fee THEN
    RAISE EXCEPTION 'Delivery earnings do not reconcile with the fee';
  END IF;

  SELECT * INTO v_payment
  FROM public.payment_transactions
  WHERE order_id = v_order_id;
  IF v_payment.customer_id IS NOT NULL THEN
    RAISE EXCEPTION 'Guest payment transaction has a registered customer';
  END IF;
  IF v_payment.customer_snapshot->>'name' <> 'Cliente invitado de prueba' THEN
    RAISE EXCEPTION 'Guest payment snapshot was not frozen';
  END IF;
  IF v_payment.amount <> v_order.total_amount THEN
    RAISE EXCEPTION 'Payment transaction amount does not match final order total';
  END IF;

  SELECT product_name_snapshot INTO v_snapshot_name
  FROM public.order_items
  WHERE order_id = v_order_id;
  IF v_snapshot_name <> 'Producto de prueba' THEN
    RAISE EXCEPTION 'Catalog product snapshot used manipulated request data';
  END IF;

  v_replayed := public.create_manual_order_atomic(v_payload, v_items);
  IF (v_replayed->>'order_id')::uuid <> v_order_id
     OR coalesce((v_replayed->>'idempotent_replay')::boolean, false) <> true THEN
    RAISE EXCEPTION 'Identical retry did not return the existing order';
  END IF;

  SELECT quantity_available INTO v_stock
  FROM public.products
  WHERE id = v_product;
  IF v_stock <> 8 THEN
    RAISE EXCEPTION 'Idempotent replay changed stock; stock=%', v_stock;
  END IF;

  BEGIN
    PERFORM public.create_manual_order_atomic(
      jsonb_build_object(
        'idempotency_key', v_key,
        'metadata', jsonb_build_object('request_fingerprint', 'different-payload')
      ),
      '[]'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%manual_order_idempotency_conflict%' THEN
      v_conflict_rejected := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_conflict_rejected THEN
    RAISE EXCEPTION 'Conflicting idempotency payload was accepted';
  END IF;

  UPDATE public.orders
  SET status = 'cancelled'
  WHERE id = v_order_id;

  SELECT quantity_available INTO v_stock
  FROM public.products
  WHERE id = v_product;
  IF v_stock <> 10 THEN
    RAISE EXCEPTION 'Cancellation did not restore stock; stock=%', v_stock;
  END IF;

  UPDATE public.orders
  SET status = 'cancelled'
  WHERE id = v_order_id;

  SELECT quantity_available INTO v_stock
  FROM public.products
  WHERE id = v_product;
  IF v_stock <> 10 THEN
    RAISE EXCEPTION 'Inventory was restored more than once; stock=%', v_stock;
  END IF;
END;
$$;

DO $$
DECLARE
  v_actor uuid := gen_random_uuid();
  v_business uuid := gen_random_uuid();
  v_branch uuid := gen_random_uuid();
  v_key uuid := gen_random_uuid();
  v_email text := 'manual-pickup-' || replace(v_actor::text, '-', '') || '@domiu.test';
  v_result jsonb;
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
BEGIN
  INSERT INTO auth.users(id, email, raw_app_meta_data, raw_user_meta_data)
  VALUES (
    v_actor,
    v_email,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  );

  INSERT INTO public.profiles(id, role, email, first_name, last_name, status)
  VALUES (v_actor, 'admin', v_email, 'Prueba', 'Recogida', 'active');

  INSERT INTO public.businesses(id, owner_id, name, slug, is_active, is_verified)
  VALUES (
    v_business,
    v_actor,
    'Negocio prueba recogida',
    'pickup-' || left(replace(v_business::text, '-', ''), 16),
    true,
    true
  );

  INSERT INTO public.business_addresses(
    id,
    business_id,
    name,
    street_address,
    formatted_address,
    city,
    state_province,
    latitude,
    longitude,
    is_primary,
    delivery_available,
    is_active,
    service_radius_km
  ) VALUES (
    v_branch,
    v_business,
    'Sede recogida',
    'Calle 1 # 1-1',
    'Calle 1 # 1-1, Santa Marta',
    'Santa Marta',
    'Magdalena',
    11.24,
    -74.19,
    true,
    true,
    true,
    8
  );

  v_result := public.create_manual_order_atomic(
    jsonb_build_object(
      'business_id', v_business,
      'branch_id', v_branch,
      'customer_id', '',
      'courier_id', '',
      'status', 'confirmed',
      'payment_status', 'pending',
      'payment_method', 'cash',
      'paid_amount', 0,
      'delivery_fee', 999999,
      'discount_amount', 0,
      'tax_amount', 0,
      'tip_amount', 1000,
      'surcharge_amount', 500,
      'courier_earnings', 999999,
      'platform_earnings', 999999,
      'preparation_notes', 'Empacar bien',
      'internal_notes', 'Artículo fuera de catálogo',
      'courier_notes', '',
      'admin_reason', 'Pedido presencial para recoger',
      'creation_source', 'admin_manual',
      'created_by_user_id', v_actor,
      'created_by_role', 'admin',
      'created_from_panel', 'admin',
      'sales_channel', 'in_person',
      'sales_channel_detail', '',
      'delivery_type', 'pickup',
      'delivery_fee_source', 'not_applicable',
      'delivery_fee_overridden', false,
      'delivery_fee_override_reason', '',
      'guest_customer_snapshot', jsonb_build_object(
        'kind', 'guest',
        'name', 'Cliente recogida',
        'phone', '3010000000'
      ),
      'delivery_snapshot', null,
      'business_snapshot', jsonb_build_object(
        'id', v_business,
        'name', 'Negocio prueba recogida'
      ),
      'idempotency_key', v_key,
      'metadata', jsonb_build_object('request_fingerprint', 'pickup-custom-test')
    ),
    jsonb_build_array(
      jsonb_build_object(
        'product_id', '',
        'is_custom_item', true,
        'name', 'Producto personalizado',
        'quantity', 3,
        'unit_price', 7000,
        'instructions', 'Tres unidades',
        'variant', '{}'::jsonb,
        'modifiers', '[]'::jsonb,
        'metadata', '{}'::jsonb
      )
    )
  );

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = (v_result->>'order_id')::uuid;

  IF v_order.delivery_type <> 'pickup'
     OR v_order.delivery_fee <> 0
     OR v_order.courier_id IS NOT NULL THEN
    RAISE EXCEPTION 'Pickup logistics are inconsistent';
  END IF;
  IF v_order.subtotal <> 21000 OR v_order.total_amount <> 22500 THEN
    RAISE EXCEPTION 'Pickup totals are inconsistent';
  END IF;
  IF v_order.courier_earnings <> 0 OR v_order.platform_earnings <> 0 THEN
    RAISE EXCEPTION 'Pickup generated delivery earnings';
  END IF;
  IF v_order.delivery_address <> v_order.pickup_address THEN
    RAISE EXCEPTION 'Pickup did not use the branch snapshot';
  END IF;

  SELECT * INTO v_item
  FROM public.order_items
  WHERE order_id = v_order.id;

  IF v_item.product_id IS NOT NULL
     OR v_item.is_custom_item IS DISTINCT FROM true
     OR v_item.product_name_snapshot <> 'Producto personalizado'
     OR v_item.item_total <> 21000 THEN
    RAISE EXCEPTION 'Custom item snapshot is inconsistent';
  END IF;
END;
$$;

ROLLBACK;

SELECT 'manual_orders_integration_passed' AS result;
