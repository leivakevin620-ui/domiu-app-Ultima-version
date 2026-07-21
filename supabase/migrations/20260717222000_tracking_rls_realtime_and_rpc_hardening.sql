-- DomiU: GPS limitado al pedido asignado, geocercas sobre snapshots y RPC internos cerrados.

drop policy if exists "Drivers create own locations"
  on public.driver_locations;
drop policy if exists "Drivers create assigned order locations"
  on public.driver_locations;
create policy "Drivers create assigned order locations"
on public.driver_locations
for insert to authenticated
with check (
  driver_id = auth.uid()
  and order_id is not null
  and exists (
    select 1
    from public.orders o
    where o.id = driver_locations.order_id
      and o.courier_id = auth.uid()
      and o.status in ('assigned', 'accepted', 'picked_up', 'in_transit')
      and o.deleted_at is null
  )
);

drop policy if exists "Drivers update own locations"
  on public.driver_locations;
drop policy if exists "Drivers update assigned order locations"
  on public.driver_locations;
create policy "Drivers update assigned order locations"
on public.driver_locations
for update to authenticated
using (
  driver_id = auth.uid()
  and exists (
    select 1
    from public.orders o
    where o.id = driver_locations.order_id
      and o.courier_id = auth.uid()
      and o.status in ('assigned', 'accepted', 'picked_up', 'in_transit')
      and o.deleted_at is null
  )
)
with check (
  driver_id = auth.uid()
  and exists (
    select 1
    from public.orders o
    where o.id = driver_locations.order_id
      and o.courier_id = auth.uid()
      and o.status in ('assigned', 'accepted', 'picked_up', 'in_transit')
      and o.deleted_at is null
  )
);

create or replace function public.detect_geofence_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_status public.order_status;
  v_business_lat double precision;
  v_business_lng double precision;
  v_customer_lat double precision;
  v_customer_lng double precision;
  v_dist_to_business_m double precision := 999999;
  v_dist_to_customer_m double precision := 999999;
begin
  if new.order_id is null
     or new.latitude is null
     or new.longitude is null then
    return new;
  end if;

  select
    o.status,
    coalesce(o.pickup_lat, ba.latitude::double precision),
    coalesce(o.pickup_lng, ba.longitude::double precision),
    coalesce(o.delivery_lat, a.latitude::double precision),
    coalesce(o.delivery_lng, a.longitude::double precision)
  into
    v_order_status,
    v_business_lat,
    v_business_lng,
    v_customer_lat,
    v_customer_lng
  from public.orders o
  left join public.business_addresses ba
    on ba.id = o.pickup_address_id
  left join public.addresses a
    on a.id = o.delivery_address_id
  where o.id = new.order_id
  limit 1;

  if v_business_lat is not null and v_business_lng is not null then
    v_dist_to_business_m := public.st_distancesphere(
      public.st_setsrid(
        public.st_makepoint(
          new.longitude::double precision,
          new.latitude::double precision
        ),
        4326
      ),
      public.st_setsrid(
        public.st_makepoint(v_business_lng, v_business_lat),
        4326
      )
    );
  end if;

  if v_customer_lat is not null and v_customer_lng is not null then
    v_dist_to_customer_m := public.st_distancesphere(
      public.st_setsrid(
        public.st_makepoint(
          new.longitude::double precision,
          new.latitude::double precision
        ),
        4326
      ),
      public.st_setsrid(
        public.st_makepoint(v_customer_lng, v_customer_lat),
        4326
      )
    );
  end if;

  if v_dist_to_business_m <= 150
     and v_order_status in (
       'confirmed',
       'preparing',
       'ready',
       'assigned',
       'accepted'
     ) then
    insert into public.geofence_events(
      order_id,
      driver_id,
      event_type,
      latitude,
      longitude,
      accuracy
    )
    values (
      new.order_id,
      new.driver_id,
      'arrived_at_business',
      new.latitude,
      new.longitude,
      new.accuracy
    )
    on conflict do nothing;
  end if;

  if v_dist_to_customer_m <= 150
     and v_order_status in ('picked_up', 'in_transit') then
    insert into public.geofence_events(
      order_id,
      driver_id,
      event_type,
      latitude,
      longitude,
      accuracy
    )
    values (
      new.order_id,
      new.driver_id,
      'arrived_at_customer',
      new.latitude,
      new.longitude,
      new.accuracy
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.detect_geofence_event()
  from public, anon, authenticated;
grant execute on function public.detect_geofence_event()
  to service_role;

-- Some legacy helpers are created only in later production histories. Apply
-- their ACLs when their exact signatures are present so fresh branches work.
do $$
begin
  if to_regprocedure('public.close_delivery_chat_after_order()') is not null then
    revoke all on function public.close_delivery_chat_after_order()
      from public, anon, authenticated;
    grant execute on function public.close_delivery_chat_after_order()
      to service_role;
  end if;

  if to_regprocedure('public.sync_business_coordinates()') is not null then
    revoke all on function public.sync_business_coordinates()
      from public, anon, authenticated;
    grant execute on function public.sync_business_coordinates()
      to service_role;
  end if;

  if to_regprocedure('public.calculate_delivery_quote(uuid,uuid)') is not null then
    revoke all on function public.calculate_delivery_quote(uuid, uuid)
      from public, anon, authenticated;
    grant execute on function public.calculate_delivery_quote(uuid, uuid)
      to service_role;
  end if;

  if to_regprocedure('public.calculate_delivery_quote_v2(uuid,uuid)') is not null then
    revoke all on function public.calculate_delivery_quote_v2(uuid, uuid)
      from public, anon, authenticated;
    grant execute on function public.calculate_delivery_quote_v2(uuid, uuid)
      to service_role;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chats'
  ) then
    alter publication supabase_realtime add table public.chats;
  end if;
end;
$$;