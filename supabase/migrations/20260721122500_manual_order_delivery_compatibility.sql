-- Keep the existing checkout delivery trigger for application orders while
-- giving manual orders a compatible server-side branch and pricing path.

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_branch_id_fkey;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_branch_id_fkey
  FOREIGN KEY (branch_id)
  REFERENCES public.business_addresses(id)
  ON DELETE SET NULL;

DROP TRIGGER IF EXISTS set_order_delivery_pricing_trigger ON public.orders;
CREATE TRIGGER set_order_delivery_pricing_trigger
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
WHEN (NEW.created_manually IS DISTINCT FROM true)
EXECUTE FUNCTION public.set_order_delivery_pricing();

CREATE OR REPLACE FUNCTION public.set_manual_order_delivery_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pickup public.business_addresses%rowtype;
  v_settings public.delivery_pricing_settings%rowtype;
  v_snapshot jsonb := coalesce(NEW.delivery_snapshot, '{}'::jsonb);
  v_distance numeric;
  v_duration integer;
  v_fee numeric := coalesce(NEW.delivery_fee, 0);
  v_raw numeric;
  v_tip numeric := coalesce((NEW.metadata->>'tip_amount')::numeric, 0);
  v_surcharge numeric := coalesce((NEW.metadata->>'surcharge_amount')::numeric, 0);
  v_prep integer := 15;
  v_delivery_lat numeric;
  v_delivery_lng numeric;
  v_delivery_address text;
  v_outside_coverage boolean := false;
BEGIN
  IF NEW.branch_id IS NOT NULL THEN
    SELECT * INTO v_pickup
    FROM public.business_addresses
    WHERE id = NEW.branch_id
      AND business_id = NEW.business_id
      AND deleted_at IS NULL
      AND is_active = true
    LIMIT 1;
  ELSIF NEW.pickup_address_id IS NOT NULL THEN
    SELECT * INTO v_pickup
    FROM public.business_addresses
    WHERE id = NEW.pickup_address_id
      AND business_id = NEW.business_id
      AND deleted_at IS NULL
      AND is_active = true
    LIMIT 1;
  ELSE
    SELECT * INTO v_pickup
    FROM public.business_addresses
    WHERE business_id = NEW.business_id
      AND deleted_at IS NULL
      AND is_active = true
    ORDER BY is_primary DESC NULLS LAST, updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_pickup.id IS NULL THEN
    RAISE EXCEPTION 'manual_order_active_branch_required' USING ERRCODE = '22023';
  END IF;

  NEW.branch_id := v_pickup.id;
  NEW.pickup_address_id := v_pickup.id;
  NEW.pickup_address := coalesce(
    v_pickup.formatted_address,
    concat_ws(', ', v_pickup.street_address, v_pickup.city, v_pickup.state_province)
  );
  NEW.pickup_lat := v_pickup.latitude::double precision;
  NEW.pickup_lng := v_pickup.longitude::double precision;
  NEW.pickup_place_id := v_pickup.place_id;

  SELECT coalesce(
    (business.metadata->>'avgPrepTimeMinutes')::integer,
    (business.metadata->>'avg_prep_time_minutes')::integer,
    15
  )
  INTO v_prep
  FROM public.businesses AS business
  WHERE business.id = NEW.business_id;

  IF NEW.delivery_type = 'pickup' THEN
    IF NEW.courier_id IS NOT NULL THEN
      RAISE EXCEPTION 'manual_order_pickup_cannot_have_courier' USING ERRCODE = '22023';
    END IF;

    NEW.delivery_fee := 0;
    NEW.delivery_fee_source := 'not_applicable';
    NEW.delivery_fee_overridden := false;
    NEW.delivery_fee_override_reason := NULL;
    NEW.delivery_distance_km := 0;
    NEW.route_distance_km := NULL;
    NEW.route_duration_minutes := NULL;
    NEW.route_source := 'pickup';
    NEW.delivery_address := NEW.pickup_address;
    NEW.delivery_lat := NEW.pickup_lat;
    NEW.delivery_lng := NEW.pickup_lng;
    NEW.delivery_place_id := NEW.pickup_place_id;
    NEW.estimated_delivery_time := now() + make_interval(mins => greatest(5, coalesce(v_prep, 15)));
    NEW.total_amount := greatest(
      0,
      coalesce(NEW.subtotal, 0)
      - coalesce(NEW.discount_amount, 0)
      + coalesce(NEW.tax_amount, 0)
      + v_tip
      + v_surcharge
    );
    NEW.outstanding_amount := greatest(0, NEW.total_amount - coalesce(NEW.paid_amount, 0));
    NEW.metadata := coalesce(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
      'delivery_pricing_source', 'pickup',
      'delivery_pricing_calculated_at', now(),
      'pickup_address_id', v_pickup.id,
      'delivery_location_status', 'pickup'
    );
    RETURN NEW;
  END IF;

  v_delivery_address := nullif(btrim(v_snapshot->>'address'), '');
  IF v_delivery_address IS NULL THEN
    RAISE EXCEPTION 'manual_order_delivery_address_required' USING ERRCODE = '22023';
  END IF;

  v_delivery_lat := nullif(v_snapshot->>'latitude', '')::numeric;
  v_delivery_lng := nullif(v_snapshot->>'longitude', '')::numeric;
  v_distance := coalesce(
    nullif(NEW.metadata->>'distance_km', '')::numeric,
    NEW.route_distance_km::numeric,
    NEW.delivery_distance_km::numeric
  );

  IF (v_distance IS NULL OR v_distance <= 0)
     AND v_pickup.latitude IS NOT NULL
     AND v_pickup.longitude IS NOT NULL
     AND v_delivery_lat IS NOT NULL
     AND v_delivery_lng IS NOT NULL THEN
    v_distance := round((
      ST_Distance(
        ST_SetSRID(ST_MakePoint(v_pickup.longitude, v_pickup.latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(v_delivery_lng, v_delivery_lat), 4326)::geography
      ) / 1000
    )::numeric, 2);
  END IF;

  IF NEW.delivery_fee_source = 'automatic' AND (v_distance IS NULL OR v_distance <= 0) THEN
    RAISE EXCEPTION 'manual_order_automatic_fee_requires_distance' USING ERRCODE = '22023';
  END IF;

  IF v_distance IS NOT NULL
     AND v_pickup.service_radius_km IS NOT NULL
     AND v_distance > v_pickup.service_radius_km THEN
    v_outside_coverage := true;
    IF NOT (
      NEW.created_from_panel = 'admin'
      AND nullif(btrim(NEW.admin_reason), '') IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'manual_order_outside_coverage' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NEW.delivery_fee_source = 'automatic' THEN
    SELECT * INTO v_settings
    FROM public.delivery_pricing_settings
    WHERE is_active = true
    ORDER BY updated_at DESC
    LIMIT 1;

    IF v_settings.id IS NULL THEN
      RAISE EXCEPTION 'manual_order_delivery_pricing_unavailable' USING ERRCODE = '55000';
    END IF;

    v_raw := v_settings.base_fee
      + greatest(v_distance - v_settings.base_distance_km, 0)
      * v_settings.extra_per_km;
    v_fee := CASE
      WHEN v_distance <= v_settings.base_distance_km THEN v_settings.base_fee
      ELSE ceil(v_raw / v_settings.rounding_increment) * v_settings.rounding_increment
    END;
    v_duration := greatest(
      v_settings.minimum_duration_minutes,
      coalesce(NEW.route_duration_minutes, ceil(v_distance * 4)::integer)
    );
    NEW.route_source := coalesce(NEW.route_source, 'manual_order_distance');
  ELSE
    v_fee := coalesce(NEW.delivery_fee, 0);
    v_duration := greatest(10, coalesce(NEW.route_duration_minutes, ceil(coalesce(v_distance, 1) * 4)::integer));
    NEW.route_source := 'manual_override';
  END IF;

  NEW.delivery_fee := round(v_fee);
  NEW.delivery_distance_km := round(coalesce(v_distance, 0), 2)::double precision;
  NEW.route_distance_km := round(coalesce(v_distance, 0), 2)::double precision;
  NEW.route_duration_minutes := v_duration;
  NEW.delivery_address := concat_ws(', ',
    v_delivery_address,
    nullif(btrim(v_snapshot->>'complement'), ''),
    nullif(btrim(v_snapshot->>'neighborhood'), ''),
    nullif(btrim(v_snapshot->>'city'), '')
  );
  NEW.delivery_lat := v_delivery_lat::double precision;
  NEW.delivery_lng := v_delivery_lng::double precision;
  NEW.delivery_place_id := nullif(v_snapshot->>'placeId', '');
  NEW.estimated_delivery_time := now()
    + make_interval(mins => greatest(10, coalesce(v_prep, 15) + coalesce(v_duration, 10)));
  NEW.total_amount := greatest(
    0,
    coalesce(NEW.subtotal, 0)
    - coalesce(NEW.discount_amount, 0)
    + coalesce(NEW.tax_amount, 0)
    + NEW.delivery_fee
    + v_tip
    + v_surcharge
  );
  NEW.outstanding_amount := greatest(0, NEW.total_amount - coalesce(NEW.paid_amount, 0));
  NEW.metadata := coalesce(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
    'delivery_duration_minutes', v_duration,
    'delivery_pricing_source', NEW.route_source,
    'delivery_pricing_calculated_at', now(),
    'pickup_address_id', v_pickup.id,
    'delivery_location_status', CASE
      WHEN v_delivery_lat IS NULL OR v_delivery_lng IS NULL THEN 'address_only'
      ELSE 'exact'
    END,
    'outside_coverage_override', v_outside_coverage
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_manual_order_delivery_pricing_trigger ON public.orders;
CREATE TRIGGER set_manual_order_delivery_pricing_trigger
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
WHEN (NEW.created_manually = true)
EXECUTE FUNCTION public.set_manual_order_delivery_pricing();

REVOKE ALL ON FUNCTION public.set_manual_order_delivery_pricing() FROM PUBLIC, anon, authenticated;
