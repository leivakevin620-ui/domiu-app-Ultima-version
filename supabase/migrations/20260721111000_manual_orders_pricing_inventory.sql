-- Manual order compatibility with the existing pricing, operations and financial triggers.

create or replace function public.guard_business_receiving_orders()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_override boolean := false;
begin
  v_admin_override := coalesce(new.created_manually, false)
    and new.created_by_role = 'admin'
    and coalesce(new.administrative_reason, '') <> ''
    and coalesce((new.metadata->>'manual_admin_override')::boolean, false);

  if v_admin_override then
    if not exists (
      select 1 from public.businesses b
      where b.id = new.business_id and b.deleted_at is null
    ) then
      raise exception 'El comercio no existe o fue eliminado';
    end if;
    return new;
  end if;

  if not exists(select 1 from public.operations_days where status='open') then
    raise exception 'DomiU no tiene una jornada operativa abierta';
  end if;
  if not exists(
    select 1 from public.businesses b
    where b.id=new.business_id
      and b.is_active=true
      and b.is_verified=true
      and b.is_accepting_orders=true
      and b.operations_status='open'
      and b.deleted_at is null
  ) then
    raise exception 'El comercio está cerrado y no puede recibir pedidos';
  end if;
  if not exists(
    select 1 from public.business_shifts bs
    where bs.business_id=new.business_id and bs.status='open'
  ) then
    raise exception 'El comercio no tiene una jornada abierta';
  end if;
  return new;
end;
$$;

create or replace function public.set_order_delivery_pricing()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote record;
  v_pickup public.business_addresses%rowtype;
  v_delivery public.addresses%rowtype;
  v_prep integer := 15;
  v_distance double precision := 0;
  v_duration integer := 5;
  v_fee numeric := 0;
  v_settings public.delivery_pricing_settings%rowtype;
  v_raw numeric := 0;
  v_admin_override boolean := false;
  v_can_use_branch boolean := false;
begin
  v_admin_override := coalesce(new.created_manually, false)
    and new.created_by_role = 'admin'
    and coalesce(new.administrative_reason, '') <> ''
    and coalesce((new.metadata->>'manual_admin_override')::boolean, false);

  if coalesce(new.order_type, 'product_order') = 'product_order' then
    if not exists (
      select 1 from public.businesses b
      where b.id=new.business_id
        and b.is_active=true and b.is_verified=true
        and b.is_accepting_orders=true and b.operations_status='open'
        and b.deleted_at is null
        and coalesce((b.metadata->>'accepting_orders')::boolean,false)=true
        and coalesce((b.metadata->>'operational_open')::boolean,false)=true
        and exists(select 1 from public.business_shifts bs where bs.business_id=b.id and bs.status='open')
        and exists(select 1 from public.operational_shifts os where os.participant_type='business' and os.participant_id=b.id and os.status='open')
        and exists(select 1 from public.operations_days od where od.status='open')
    ) then
      raise exception 'El comercio está cerrado o no tiene una jornada operativa abierta';
    end if;
  end if;

  if new.branch_id is not null then
    select * into v_pickup
    from public.business_addresses
    where id = new.branch_id
      and business_id = new.business_id
      and deleted_at is null
      and (v_admin_override or is_active = true)
    limit 1;
  elsif new.pickup_address_id is not null then
    select * into v_pickup
    from public.business_addresses
    where id = new.pickup_address_id
      and business_id = new.business_id
      and deleted_at is null
      and (v_admin_override or (is_active = true and delivery_available = true))
    limit 1;
  else
    select * into v_pickup
    from public.business_addresses
    where business_id = new.business_id
      and deleted_at is null
      and (v_admin_override or (is_active = true and delivery_available = true))
    order by is_primary desc, updated_at desc nulls last
    limit 1;
  end if;

  if v_pickup.id is null then
    raise exception 'Selecciona una sucursal válida para el pedido';
  end if;

  new.pickup_address_id := v_pickup.id;
  new.branch_id := coalesce(new.branch_id, v_pickup.id);
  new.pickup_address := coalesce(v_pickup.formatted_address, concat_ws(', ',v_pickup.street_address,v_pickup.city,v_pickup.state_province));
  new.pickup_lat := v_pickup.latitude::double precision;
  new.pickup_lng := v_pickup.longitude::double precision;
  new.pickup_place_id := v_pickup.place_id;

  select coalesce(
    (b.metadata->>'avgPrepTimeMinutes')::integer,
    (b.metadata->>'avg_prep_time_minutes')::integer,
    15
  ) into v_prep
  from public.businesses b where b.id = new.business_id;

  if coalesce(new.delivery_type, 'delivery') = 'pickup' then
    new.delivery_address_id := null;
    new.delivery_fee := 0;
    new.delivery_distance_km := 0;
    new.route_distance_km := 0;
    new.route_duration_minutes := 0;
    new.route_source := 'pickup';
    new.delivery_fee_source := 'pickup';
    new.delivery_address := new.pickup_address;
    new.delivery_lat := new.pickup_lat;
    new.delivery_lng := new.pickup_lng;
    new.delivery_place_id := new.pickup_place_id;
    new.estimated_delivery_time := now() + make_interval(mins => greatest(5, coalesce(v_prep,15)));
    new.metadata := coalesce(new.metadata,'{}'::jsonb) || jsonb_build_object(
      'delivery_duration_minutes',0,
      'delivery_pricing_source','pickup',
      'delivery_pricing_calculated_at',now(),
      'pickup_address_id',v_pickup.id,
      'delivery_location_status','pickup'
    );
    return new;
  end if;

  if new.delivery_address_id is null then
    raise exception 'La dirección de entrega es obligatoria para pedidos a domicilio';
  end if;

  select * into v_delivery
  from public.addresses
  where id = new.delivery_address_id and deleted_at is null;
  if v_delivery.id is null then
    raise exception 'Dirección de entrega no disponible';
  end if;

  select * into v_settings
  from public.delivery_pricing_settings
  where is_active=true
  order by updated_at desc
  limit 1;
  if v_settings.id is null then
    raise exception 'No existe configuración activa para calcular el domicilio';
  end if;

  if coalesce(new.delivery_fee_overridden,false) then
    if coalesce(new.delivery_fee_override_reason,'') = '' then
      raise exception 'Debes indicar el motivo de la tarifa manual';
    end if;
    v_fee := greatest(coalesce(new.delivery_fee,0),0);
    v_distance := greatest(coalesce(new.route_distance_km,new.delivery_distance_km,0),0);
    v_duration := greatest(v_settings.minimum_duration_minutes,coalesce(new.route_duration_minutes,0));
    new.route_source := coalesce(new.route_source,'manual_override');
    new.delivery_fee_source := 'manual';
  elsif new.route_distance_km is not null and new.route_distance_km > 0 then
    v_distance := new.route_distance_km;
    v_duration := greatest(v_settings.minimum_duration_minutes,coalesce(new.route_duration_minutes,0));
    v_raw := v_settings.base_fee + greatest(v_distance-v_settings.base_distance_km,0)*v_settings.extra_per_km;
    v_fee := case
      when v_distance <= v_settings.base_distance_km then v_settings.base_fee
      else ceil(v_raw/v_settings.rounding_increment)*v_settings.rounding_increment
    end;
    new.route_source := coalesce(new.route_source,'manual_distance');
    new.delivery_fee_source := 'automatic';
  elsif v_pickup.latitude is not null and v_pickup.longitude is not null
    and v_delivery.latitude is not null and v_delivery.longitude is not null then
    begin
      select * into v_quote from public.delivery_quote_values_v2(v_pickup.id,v_delivery.id);
      v_distance := coalesce(v_quote.distance_km,0);
      v_duration := greatest(v_settings.minimum_duration_minutes,coalesce(v_quote.duration_minutes,0));
      v_fee := coalesce(v_quote.delivery_fee,v_settings.base_fee);
      new.route_source := coalesce(new.route_source,'postgis_direct');
      new.delivery_fee_source := 'automatic';
    exception when others then
      v_distance := 0;
      v_duration := v_settings.minimum_duration_minutes;
      v_fee := v_settings.base_fee;
      new.route_source := 'fallback';
      new.delivery_fee_source := 'fallback';
    end;
  else
    v_distance := 0;
    v_duration := v_settings.minimum_duration_minutes;
    v_fee := v_settings.base_fee;
    new.route_source := 'fallback';
    new.delivery_fee_source := 'fallback';
  end if;

  new.delivery_distance_km := round(v_distance::numeric,2)::double precision;
  new.route_distance_km := v_distance;
  new.route_duration_minutes := v_duration;
  new.delivery_fee := v_fee;
  new.estimated_delivery_time := now()+make_interval(mins=>greatest(10,coalesce(v_prep,15)+v_duration));
  new.delivery_address := coalesce(v_delivery.formatted_address,concat_ws(', ',v_delivery.street_address,v_delivery.city,v_delivery.state_province));
  new.delivery_lat := v_delivery.latitude::double precision;
  new.delivery_lng := v_delivery.longitude::double precision;
  new.delivery_place_id := v_delivery.place_id;
  new.metadata := coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object(
    'delivery_duration_minutes',v_duration,
    'delivery_pricing_source',new.route_source,
    'delivery_pricing_calculated_at',now(),
    'pickup_address_id',v_pickup.id,
    'delivery_location_status',case when v_delivery.latitude is null then 'text_only' else 'exact' end
  );
  return new;
end;
$$;

create or replace function public.set_order_financial_breakdown()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.platform_financial_settings%rowtype;
  v_config_id uuid;
  v_product_value numeric;
  v_business_value numeric;
  v_service_fee numeric:=0;
  v_delivery_commission numeric:=0;
  v_tip_to_courier numeric:=0;
begin
  select * into v_settings from public.current_financial_settings();
  if v_settings.id is null then raise exception 'No existe una configuración financiera activa'; end if;
  select id into v_config_id from public.platform_financial_config where is_active=true order by effective_from desc limit 1;

  v_product_value:=greatest(coalesce(new.subtotal,0)-coalesce(new.discount_amount,0)+coalesce(new.tax_amount,0),0);
  v_business_value:=v_product_value+coalesce(new.surcharge_amount,0);
  if coalesce(new.delivery_type,'delivery')='pickup' then
    v_business_value:=v_business_value+coalesce(new.tip_amount,0);
  else
    v_tip_to_courier:=coalesce(new.tip_amount,0);
  end if;

  if coalesce(new.subtotal,0)>0 then
    v_service_fee:=public.round_money_up(
      greatest(coalesce(new.subtotal,0)-coalesce(new.discount_amount,0),0)*v_settings.service_fee_rate/100,
      v_settings.service_fee_rounding
    );
    v_service_fee:=least(v_settings.service_fee_max,greatest(v_settings.service_fee_min,v_service_fee));
  end if;
  if coalesce(new.delivery_fee,0)>0 then
    v_delivery_commission:=public.round_money_up(
      coalesce(new.delivery_fee,0)*v_settings.delivery_commission_rate/100,
      v_settings.delivery_commission_rounding
    );
    v_delivery_commission:=least(
      coalesce(new.delivery_fee,0),
      least(v_settings.delivery_commission_max,greatest(v_settings.delivery_commission_min,v_delivery_commission))
    );
  end if;

  new.service_fee:=v_service_fee;
  new.business_earnings:=v_business_value;
  new.merchant_earnings:=v_business_value;
  new.courier_gross_earnings:=coalesce(new.delivery_fee,0)+v_tip_to_courier;
  new.courier_commission:=v_delivery_commission;
  new.courier_net_earnings:=greatest(coalesce(new.delivery_fee,0)-v_delivery_commission,0)+v_tip_to_courier;
  new.platform_delivery_commission:=v_delivery_commission;
  new.platform_service_fee:=v_service_fee;
  new.platform_total_earnings:=v_service_fee+v_delivery_commission;
  new.courier_earnings:=new.courier_net_earnings;
  new.platform_earnings:=new.platform_total_earnings;
  new.total_amount:=v_product_value+coalesce(new.surcharge_amount,0)+coalesce(new.tip_amount,0)+coalesce(new.delivery_fee,0)+v_service_fee;
  new.collector_type:=case when new.payment_method='cash' then 'courier' when new.payment_method='transfer' then 'business' else 'platform' end;
  new.collector_id:=case when new.payment_method='cash' then new.courier_id when new.payment_method='transfer' then new.business_id else null end;
  new.financial_version:=v_settings.version;
  new.financial_config_id:=v_config_id;
  new.financial_calculated_at:=now();
  new.metadata:=coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object(
    'financial_version',v_settings.version,
    'service_fee_label','Tarifa de servicio DomiU',
    'service_fee_rate',v_settings.service_fee_rate,
    'delivery_commission_rate',v_settings.delivery_commission_rate,
    'courier_share_rate',100-v_settings.delivery_commission_rate,
    'merchant_product_commission_rate',v_settings.merchant_product_commission_rate,
    'financial_calculated_at',now()
  );
  return new;
end;
$$;

create or replace function public.restore_cancelled_manual_order_inventory()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_move public.manual_order_inventory_movements%rowtype;
  v_restore_id uuid;
begin
  if not coalesce(new.created_manually,false)
    or new.status <> 'cancelled'::public.order_status
    or old.status = 'cancelled'::public.order_status then
    return new;
  end if;

  for v_move in
    select * from public.manual_order_inventory_movements
    where order_id = new.id and movement_type = 'decrement'
  loop
    insert into public.manual_order_inventory_movements(
      order_id,order_item_id,product_id,variant_id,movement_type,quantity,actor_id,reason,metadata
    ) values (
      new.id,v_move.order_item_id,v_move.product_id,v_move.variant_id,'restore',v_move.quantity,
      new.created_by_user_id,'Restauración automática por cancelación',jsonb_build_object('source_movement_id',v_move.id)
    )
    on conflict(order_item_id,movement_type) do nothing
    returning id into v_restore_id;

    if v_restore_id is not null then
      if v_move.variant_id is not null then
        update public.product_variants
        set quantity_available = quantity_available + v_move.quantity,
            updated_at = now()
        where id = v_move.variant_id;
      else
        update public.products
        set quantity_available = quantity_available + v_move.quantity,
            updated_at = now()
        where id = v_move.product_id;
      end if;
    end if;
    v_restore_id := null;
  end loop;
  return new;
end;
$$;

revoke all on function public.restore_cancelled_manual_order_inventory() from public, anon, authenticated;
grant execute on function public.restore_cancelled_manual_order_inventory() to service_role;

drop trigger if exists restore_cancelled_manual_order_inventory_trigger on public.orders;
create trigger restore_cancelled_manual_order_inventory_trigger
after update of status on public.orders
for each row
when (old.status is distinct from new.status)
execute function public.restore_cancelled_manual_order_inventory();
