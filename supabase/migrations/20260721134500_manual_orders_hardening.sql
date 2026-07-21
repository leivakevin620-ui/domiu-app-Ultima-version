-- DomiU Magdalena — endurecimiento de pedidos manuales
-- Corrige direcciones sin coordenadas, pago completo e inventario al cancelar.

begin;

-- El saldo pagado nunca puede superar el total calculado por el backend.
do $$
begin
  if not exists (select 1 from pg_constraint where conname='orders_manual_amount_paid_total_check') then
    alter table public.orders add constraint orders_manual_amount_paid_total_check
      check (amount_paid <= total_amount);
  end if;
end $$;

-- La tarifa puede calcularse por ruta exacta, PostGIS o una sobrescritura autorizada.
-- Una dirección textual sin coordenadas no bloquea el pedido cuando existe tarifa manual
-- con motivo y permisos; queda marcada como text_only para operación y auditoría.
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
  v_use_server_route boolean := false;
  v_has_coordinates boolean := false;
  v_distance double precision := 0;
  v_duration integer := 0;
  v_fee numeric := 0;
  v_settings public.delivery_pricing_settings%rowtype;
  v_raw numeric;
  v_business_live boolean := false;
begin
  if coalesce(new.order_type, 'product_order') = 'product_order' then
    select exists (
      select 1 from public.businesses b
      where b.id=new.business_id
        and b.is_active=true and b.is_verified=true and b.is_accepting_orders=true
        and b.operations_status='open' and b.deleted_at is null
        and coalesce((b.metadata->>'accepting_orders')::boolean,false)=true
        and coalesce((b.metadata->>'operational_open')::boolean,false)=true
        and exists(select 1 from public.business_shifts bs where bs.business_id=b.id and bs.status='open')
        and exists(select 1 from public.operational_shifts os where os.participant_type='business' and os.participant_id=b.id and os.status='open')
        and exists(select 1 from public.operations_days od where od.status='open')
    ) into v_business_live;
    if not v_business_live then
      raise exception 'El comercio está cerrado o no tiene una jornada operativa abierta';
    end if;
  end if;

  if new.pickup_address_id is not null then
    select * into v_pickup from public.business_addresses
    where id=new.pickup_address_id and business_id=new.business_id
      and deleted_at is null and is_active=true;
  else
    select * into v_pickup from public.business_addresses
    where business_id=new.business_id and is_primary=true
      and deleted_at is null and is_active=true
    order by updated_at desc nulls last limit 1;
    new.pickup_address_id:=v_pickup.id;
  end if;
  if v_pickup.id is null then
    raise exception 'Selecciona una sucursal activa con ubicación registrada';
  end if;

  select coalesce((b.metadata->>'avgPrepTimeMinutes')::integer,(b.metadata->>'avg_prep_time_minutes')::integer,15)
    into v_prep from public.businesses b where b.id=new.business_id;

  new.pickup_address:=coalesce(v_pickup.formatted_address,concat_ws(', ',v_pickup.street_address,v_pickup.city,v_pickup.state_province));
  new.pickup_lat:=v_pickup.latitude::double precision;
  new.pickup_lng:=v_pickup.longitude::double precision;
  new.pickup_place_id:=v_pickup.place_id;
  new.business_address_id:=v_pickup.id;

  if coalesce(new.delivery_type,'delivery')='pickup' then
    new.delivery_address_id:=null;
    new.delivery_address:=new.pickup_address;
    new.delivery_lat:=new.pickup_lat;
    new.delivery_lng:=new.pickup_lng;
    new.delivery_place_id:=new.pickup_place_id;
    new.delivery_fee:=0;
    new.delivery_distance_km:=0;
    new.route_distance_km:=0;
    new.route_duration_minutes:=0;
    new.route_source:='pickup';
    new.delivery_fee_source:='pickup';
    new.delivery_fee_overridden:=false;
    new.delivery_fee_override_reason:=null;
    new.estimated_delivery_time:=now()+make_interval(mins=>greatest(5,coalesce(v_prep,15)));
    new.metadata:=coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object(
      'delivery_duration_minutes',0,
      'delivery_pricing_source','pickup',
      'delivery_pricing_calculated_at',now(),
      'pickup_address_id',v_pickup.id,
      'delivery_location_status','pickup'
    );
    return new;
  end if;

  select * into v_delivery from public.addresses where id=new.delivery_address_id and deleted_at is null;
  if v_delivery.id is null then
    raise exception 'Dirección de entrega no disponible';
  end if;

  select * into v_settings from public.delivery_pricing_settings
  where is_active=true order by updated_at desc limit 1;
  if v_settings.id is null then raise exception 'No existe una configuración de domicilio activa'; end if;

  v_use_server_route:=coalesce(current_setting('request.jwt.claim.role',true),'')='service_role'
    and new.route_distance_km is not null and new.route_distance_km>0
    and new.route_source in ('google_routes','google_maps','osrm','google_directions');
  v_has_coordinates:=v_pickup.latitude is not null and v_pickup.longitude is not null
    and v_delivery.latitude is not null and v_delivery.longitude is not null;

  if v_use_server_route then
    v_distance:=new.route_distance_km;
    v_duration:=greatest(v_settings.minimum_duration_minutes,coalesce(new.route_duration_minutes,0));
  elsif v_has_coordinates then
    select * into v_quote from public.delivery_quote_values_v2(v_pickup.id,v_delivery.id);
    v_distance:=coalesce(v_quote.distance_km,0);
    v_duration:=coalesce(v_quote.duration_minutes,v_settings.minimum_duration_minutes);
    new.route_distance_km:=v_distance;
    new.route_duration_minutes:=v_duration;
    new.route_source:=coalesce(nullif(new.route_source,''),'postgis_direct');
  elsif coalesce(new.delivery_fee_overridden,false) then
    v_distance:=greatest(coalesce(new.route_distance_km,new.delivery_distance_km,0),0);
    v_duration:=greatest(coalesce(new.route_duration_minutes,0),0);
    new.route_source:='manual';
  else
    raise exception 'La dirección no tiene coordenadas. Calcula una ruta válida o registra una tarifa manual con motivo.';
  end if;

  if coalesce(new.delivery_fee_overridden,false) then
    if coalesce(new.delivery_fee,0)<=0 or length(trim(coalesce(new.delivery_fee_override_reason,'')))<5 then
      raise exception 'La tarifa manual requiere un valor válido y un motivo';
    end if;
    v_fee:=new.delivery_fee;
    new.delivery_fee_source:='manual_override';
  else
    if v_distance<=0 then raise exception 'No fue posible calcular una distancia válida'; end if;
    v_raw:=v_settings.base_fee+greatest(v_distance-v_settings.base_distance_km,0)*v_settings.extra_per_km;
    v_fee:=case
      when v_distance<=v_settings.base_distance_km then v_settings.base_fee
      else ceil(v_raw/v_settings.rounding_increment)*v_settings.rounding_increment
    end;
    new.delivery_fee_source:=case when v_use_server_route then 'google_maps' else 'postgis' end;
  end if;

  new.delivery_distance_km:=round(v_distance::numeric,2)::double precision;
  new.delivery_fee:=v_fee;
  new.estimated_delivery_time:=now()+make_interval(mins=>greatest(10,coalesce(v_prep,15)+v_duration));
  new.delivery_address:=coalesce(v_delivery.formatted_address,concat_ws(', ',v_delivery.street_address,v_delivery.city,v_delivery.state_province));
  new.delivery_lat:=v_delivery.latitude::double precision;
  new.delivery_lng:=v_delivery.longitude::double precision;
  new.delivery_place_id:=v_delivery.place_id;
  new.metadata:=coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object(
    'delivery_duration_minutes',v_duration,
    'delivery_pricing_source',new.route_source,
    'delivery_pricing_calculated_at',now(),
    'pickup_address_id',v_pickup.id,
    'delivery_location_status',case when v_has_coordinates then 'exact' else 'text_only' end
  );
  return new;
end;
$$;

-- Se ejecuta después del desglose financiero (orden alfabético de triggers BEFORE)
-- para que un pago marcado como completo cubra exactamente el total recalculado.
create or replace function public.normalize_manual_order_amount_paid()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(new.created_manually,false) then
    if new.payment_status='completed'::public.payment_status then
      new.amount_paid:=new.total_amount;
    elsif new.payment_status in ('pending','pending_verification','failed') then
      new.amount_paid:=least(greatest(coalesce(new.amount_paid,0),0),new.total_amount);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists zzzz_normalize_manual_order_amount_paid_trigger on public.orders;
create trigger zzzz_normalize_manual_order_amount_paid_trigger
before insert or update of payment_status,total_amount,amount_paid on public.orders
for each row execute function public.normalize_manual_order_amount_paid();

-- Solo puede existir una devolución de inventario por pedido/producto/variante.
create unique index if not exists inventory_movements_cancellation_unique
  on public.inventory_movements(order_id,product_id,coalesce(variant_id,'00000000-0000-0000-0000-000000000000'::uuid),reason)
  where reason='order_cancelled' and order_id is not null;

create or replace function public.restore_manual_order_inventory()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_move record;
begin
  if not coalesce(new.created_manually,false)
     or old.status in ('cancelled','refunded')
     or new.status not in ('cancelled','refunded') then
    return new;
  end if;

  for v_move in
    select im.product_id,im.variant_id,abs(sum(im.quantity_delta))::integer as quantity
    from public.inventory_movements im
    where im.order_id=new.id and im.reason='manual_order_confirmed' and im.quantity_delta<0
    group by im.product_id,im.variant_id
  loop
    if not exists (
      select 1 from public.inventory_movements restored
      where restored.order_id=new.id and restored.product_id=v_move.product_id
        and restored.variant_id is not distinct from v_move.variant_id
        and restored.reason='order_cancelled'
    ) then
      if v_move.variant_id is not null then
        update public.product_variants
        set quantity_available=quantity_available+v_move.quantity
        where id=v_move.variant_id and product_id=v_move.product_id;
      else
        update public.products
        set quantity_available=quantity_available+v_move.quantity
        where id=v_move.product_id;
      end if;

      insert into public.inventory_movements(
        product_id,variant_id,order_id,actor_id,quantity_delta,reason,metadata
      ) values (
        v_move.product_id,v_move.variant_id,new.id,new.created_by_user_id,v_move.quantity,'order_cancelled',
        jsonb_build_object('restored_from_status',old.status,'cancelled_status',new.status,'restored_at',now())
      ) on conflict do nothing;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists restore_manual_order_inventory_trigger on public.orders;
create trigger restore_manual_order_inventory_trigger
after update of status on public.orders
for each row when (old.status is distinct from new.status)
execute function public.restore_manual_order_inventory();

-- Conserva fecha de modificación y marca borradores vencidos al consultarlos.
drop trigger if exists update_manual_order_drafts_updated_at on public.manual_order_drafts;
create trigger update_manual_order_drafts_updated_at
before update on public.manual_order_drafts
for each row execute function public.update_updated_at_column();

create or replace function public.expire_manual_order_drafts(p_actor_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.manual_order_drafts
  set status='expired',updated_at=now()
  where actor_id=p_actor_id and status='draft' and expires_at<=now();
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;
revoke all on function public.expire_manual_order_drafts(uuid) from public,anon,authenticated;
grant execute on function public.expire_manual_order_drafts(uuid) to service_role;

commit;
