-- DomiU: ubicaciones exactas, sucursales, snapshots inmutables y tarifa central.

alter table public.addresses
  add column if not exists formatted_address text,
  add column if not exists place_id text,
  add column if not exists neighborhood text,
  add column if not exists location_accuracy_meters numeric;

alter table public.business_addresses
  add column if not exists name varchar(120),
  add column if not exists formatted_address text,
  add column if not exists place_id text,
  add column if not exists neighborhood text,
  add column if not exists opening_hours jsonb not null default '{}'::jsonb,
  add column if not exists service_radius_km numeric not null default 8,
  add column if not exists is_active boolean not null default true;

alter table public.orders
  add column if not exists pickup_address_id uuid references public.business_addresses(id),
  add column if not exists delivery_address text,
  add column if not exists delivery_lat double precision,
  add column if not exists delivery_lng double precision,
  add column if not exists pickup_place_id text,
  add column if not exists delivery_place_id text,
  add column if not exists route_distance_km double precision,
  add column if not exists route_duration_minutes integer,
  add column if not exists route_polyline text,
  add column if not exists route_source text,
  add column if not exists payment_reference text,
  add column if not exists payment_proof_url text;

create unique index if not exists addresses_one_primary_active_per_user
  on public.addresses(user_id)
  where is_primary = true and deleted_at is null;

create unique index if not exists business_addresses_one_primary_active_per_business
  on public.business_addresses(business_id)
  where is_primary = true and deleted_at is null and is_active = true;

create index if not exists business_addresses_business_active_idx
  on public.business_addresses(business_id, is_active, delivery_available)
  where deleted_at is null;

create index if not exists orders_pickup_address_idx
  on public.orders(pickup_address_id);

create index if not exists payment_method_status_orders_idx
  on public.orders(payment_method, payment_status);

alter table public.business_addresses
  drop constraint if exists business_addresses_service_radius_check;

alter table public.business_addresses
  add constraint business_addresses_service_radius_check
  check (service_radius_km > 0 and service_radius_km <= 100);

update public.addresses
set formatted_address = coalesce(
      formatted_address,
      concat_ws(', ', street_address, city, state_province, country)
    ),
    location_accuracy_meters = coalesce(
      location_accuracy_meters,
      nullif(metadata->>'location_accuracy_meters', '')::numeric
    )
where formatted_address is null or location_accuracy_meters is null;

update public.business_addresses
set name = coalesce(
      name,
      nullif(metadata->>'name', ''),
      case when is_primary then 'Local principal' else 'Sucursal' end
    ),
    formatted_address = coalesce(
      formatted_address,
      concat_ws(', ', street_address, city, state_province, country)
    ),
    place_id = coalesce(place_id, nullif(metadata->>'place_id', '')),
    neighborhood = coalesce(neighborhood, nullif(metadata->>'neighborhood', '')),
    service_radius_km = coalesce(
      service_radius_km,
      nullif(metadata->>'service_radius_km', '')::numeric,
      8
    ),
    is_active = coalesce(is_active, true)
where name is null or formatted_address is null;

with snapshots as (
  select
    o.id as order_id,
    ba.id as pickup_address_id,
    ba.formatted_address as pickup_formatted,
    ba.street_address as pickup_street,
    ba.city as pickup_city,
    ba.state_province as pickup_state,
    ba.latitude as pickup_latitude,
    ba.longitude as pickup_longitude,
    ba.place_id as pickup_place_id,
    a.formatted_address as delivery_formatted,
    a.street_address as delivery_street,
    a.city as delivery_city,
    a.state_province as delivery_state,
    a.latitude as delivery_latitude,
    a.longitude as delivery_longitude,
    a.place_id as delivery_place_id
  from public.orders o
  join public.addresses a on a.id = o.delivery_address_id
  left join lateral (
    select x.*
    from public.business_addresses x
    where x.business_id = o.business_id
      and x.is_primary = true
      and x.deleted_at is null
    order by x.updated_at desc nulls last
    limit 1
  ) ba on true
)
update public.orders o
set pickup_address_id = coalesce(o.pickup_address_id, s.pickup_address_id),
    pickup_address = coalesce(
      o.pickup_address,
      s.pickup_formatted,
      concat_ws(', ', s.pickup_street, s.pickup_city, s.pickup_state)
    ),
    pickup_lat = coalesce(o.pickup_lat, s.pickup_latitude::double precision),
    pickup_lng = coalesce(o.pickup_lng, s.pickup_longitude::double precision),
    pickup_place_id = coalesce(o.pickup_place_id, s.pickup_place_id),
    delivery_address = coalesce(
      o.delivery_address,
      s.delivery_formatted,
      concat_ws(', ', s.delivery_street, s.delivery_city, s.delivery_state)
    ),
    delivery_lat = coalesce(o.delivery_lat, s.delivery_latitude::double precision),
    delivery_lng = coalesce(o.delivery_lng, s.delivery_longitude::double precision),
    delivery_place_id = coalesce(o.delivery_place_id, s.delivery_place_id),
    route_distance_km = coalesce(o.route_distance_km, o.delivery_distance_km),
    route_duration_minutes = coalesce(
      o.route_duration_minutes,
      nullif(o.metadata->>'delivery_duration_minutes', '')::integer
    ),
    route_source = coalesce(
      o.route_source,
      nullif(o.metadata->>'delivery_pricing_source', ''),
      'postgis_direct'
    )
from snapshots s
where o.id = s.order_id;

create or replace function public.sync_address_geography()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.latitude is null or new.longitude is null then
    new.location := null;
  else
    if new.latitude::double precision not between -90 and 90
       or new.longitude::double precision not between -180 and 180 then
      raise exception 'Coordenadas fuera de rango';
    end if;

    new.location := public.st_setsrid(
      public.st_makepoint(
        new.longitude::double precision,
        new.latitude::double precision
      ),
      4326
    )::geography;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_address_geography() from public, anon, authenticated;
grant execute on function public.sync_address_geography() to service_role;

drop trigger if exists sync_addresses_geography_trigger on public.addresses;
create trigger sync_addresses_geography_trigger
before insert or update of latitude, longitude on public.addresses
for each row execute function public.sync_address_geography();

drop trigger if exists sync_business_addresses_geography_trigger on public.business_addresses;
create trigger sync_business_addresses_geography_trigger
before insert or update of latitude, longitude on public.business_addresses
for each row execute function public.sync_address_geography();

update public.addresses
set latitude = latitude
where latitude is not null and longitude is not null;

update public.business_addresses
set latitude = latitude
where latitude is not null and longitude is not null;

create table if not exists public.delivery_pricing_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Tarifa principal',
  is_active boolean not null default true,
  base_distance_km numeric not null default 2,
  base_fee numeric not null default 5000,
  extra_per_km numeric not null default 1200,
  rounding_increment numeric not null default 500,
  minimum_duration_minutes integer not null default 5,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_pricing_positive_values check (
    base_distance_km >= 0
    and base_fee >= 0
    and extra_per_km >= 0
    and rounding_increment > 0
    and minimum_duration_minutes > 0
  )
);

create unique index if not exists delivery_pricing_one_active_idx
  on public.delivery_pricing_settings((is_active))
  where is_active = true;

insert into public.delivery_pricing_settings(
  name,
  is_active,
  base_distance_km,
  base_fee,
  extra_per_km,
  rounding_increment,
  minimum_duration_minutes
)
select 'Tarifa principal', true, 2, 5000, 1200, 500, 5
where not exists (
  select 1 from public.delivery_pricing_settings where is_active = true
);

alter table public.delivery_pricing_settings enable row level security;

drop policy if exists "Authenticated read active delivery pricing"
  on public.delivery_pricing_settings;
create policy "Authenticated read active delivery pricing"
on public.delivery_pricing_settings
for select to authenticated
using (is_active = true or public.is_admin());

drop policy if exists "Admins manage delivery pricing"
  on public.delivery_pricing_settings;
create policy "Admins manage delivery pricing"
on public.delivery_pricing_settings
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.delivery_quote_values_v2(
  p_business_address_id uuid,
  p_address_id uuid
)
returns table(
  distance_km double precision,
  duration_minutes integer,
  delivery_fee numeric,
  pickup_lat double precision,
  pickup_lng double precision,
  delivery_lat double precision,
  delivery_lng double precision
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_distance double precision;
  v_raw numeric;
  v_settings public.delivery_pricing_settings%rowtype;
begin
  select *
  into v_settings
  from public.delivery_pricing_settings
  where is_active = true
  order by updated_at desc
  limit 1;

  select ba.latitude::double precision, ba.longitude::double precision
  into pickup_lat, pickup_lng
  from public.business_addresses ba
  where ba.id = p_business_address_id
    and ba.deleted_at is null
    and ba.is_active = true
    and ba.delivery_available = true;

  select a.latitude::double precision, a.longitude::double precision
  into delivery_lat, delivery_lng
  from public.addresses a
  where a.id = p_address_id
    and a.deleted_at is null;

  if pickup_lat is null or pickup_lng is null then
    raise exception 'El local debe guardar su ubicación exacta antes de recibir pedidos';
  end if;

  if delivery_lat is null or delivery_lng is null then
    raise exception 'La dirección del cliente debe tener coordenadas exactas';
  end if;

  v_distance := public.st_distancesphere(
    public.st_setsrid(public.st_makepoint(pickup_lng, pickup_lat), 4326),
    public.st_setsrid(public.st_makepoint(delivery_lng, delivery_lat), 4326)
  ) / 1000.0;

  v_raw := v_settings.base_fee
    + greatest(v_distance - v_settings.base_distance_km, 0)
    * v_settings.extra_per_km;

  distance_km := round(v_distance::numeric, 2)::double precision;
  duration_minutes := greatest(
    v_settings.minimum_duration_minutes,
    ceil((v_distance / 25.0) * 60.0)::integer
  );
  delivery_fee := case
    when v_distance <= v_settings.base_distance_km then v_settings.base_fee
    else ceil(v_raw / v_settings.rounding_increment)
      * v_settings.rounding_increment
  end;

  return next;
end;
$$;

revoke all on function public.delivery_quote_values_v2(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.delivery_quote_values_v2(uuid, uuid)
  to service_role;

create or replace function public.calculate_delivery_quote_v2(
  p_business_address_id uuid,
  p_address_id uuid
)
returns table(
  distance_km double precision,
  duration_minutes integer,
  delivery_fee numeric,
  pickup_lat double precision,
  pickup_lng double precision,
  delivery_lat double precision,
  delivery_lng double precision
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida';
  end if;

  if not exists (
    select 1
    from public.addresses a
    where a.id = p_address_id
      and a.user_id = auth.uid()
      and a.deleted_at is null
  ) and not public.is_admin() then
    raise exception 'No autorizado para usar esta dirección';
  end if;

  if not exists (
    select 1
    from public.business_addresses ba
    join public.businesses b on b.id = ba.business_id
    where ba.id = p_business_address_id
      and ba.deleted_at is null
      and ba.is_active = true
      and ba.delivery_available = true
      and b.is_active = true
      and b.deleted_at is null
  ) then
    raise exception 'Local no disponible';
  end if;

  return query
  select *
  from public.delivery_quote_values_v2(
    p_business_address_id,
    p_address_id
  );
end;
$$;

revoke all on function public.calculate_delivery_quote_v2(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.calculate_delivery_quote_v2(uuid, uuid)
  to service_role;

create or replace function public.delivery_quote_values(
  p_business_id uuid,
  p_address_id uuid
)
returns table(
  distance_km double precision,
  duration_minutes integer,
  delivery_fee numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pickup_id uuid;
begin
  select ba.id
  into v_pickup_id
  from public.business_addresses ba
  where ba.business_id = p_business_id
    and ba.is_primary = true
    and ba.deleted_at is null
    and ba.is_active = true
    and ba.delivery_available = true
  order by ba.updated_at desc nulls last
  limit 1;

  if v_pickup_id is null then
    raise exception 'El negocio debe guardar un local principal activo';
  end if;

  return query
  select q.distance_km, q.duration_minutes, q.delivery_fee
  from public.delivery_quote_values_v2(v_pickup_id, p_address_id) q;
end;
$$;

revoke all on function public.delivery_quote_values(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.delivery_quote_values(uuid, uuid)
  to service_role;

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
  v_distance double precision;
  v_duration integer;
  v_fee numeric;
  v_settings public.delivery_pricing_settings%rowtype;
  v_raw numeric;
begin
  if new.pickup_address_id is not null then
    select *
    into v_pickup
    from public.business_addresses
    where id = new.pickup_address_id
      and business_id = new.business_id
      and deleted_at is null
      and is_active = true
      and delivery_available = true;
  else
    select *
    into v_pickup
    from public.business_addresses
    where business_id = new.business_id
      and is_primary = true
      and deleted_at is null
      and is_active = true
      and delivery_available = true
    order by updated_at desc nulls last
    limit 1;

    new.pickup_address_id := v_pickup.id;
  end if;

  if v_pickup.id is null then
    raise exception 'Selecciona un local activo con ubicación exacta';
  end if;

  select *
  into v_delivery
  from public.addresses
  where id = new.delivery_address_id
    and deleted_at is null;

  if v_delivery.id is null then
    raise exception 'Dirección de entrega no disponible';
  end if;

  select *
  into v_quote
  from public.delivery_quote_values_v2(v_pickup.id, v_delivery.id);

  select *
  into v_settings
  from public.delivery_pricing_settings
  where is_active = true
  order by updated_at desc
  limit 1;

  v_use_server_route := coalesce(
      current_setting('request.jwt.claim.role', true),
      ''
    ) = 'service_role'
    and new.route_distance_km is not null
    and new.route_distance_km > 0
    and new.route_source in ('google_routes', 'osrm', 'google_directions');

  if v_use_server_route then
    v_distance := new.route_distance_km;
    v_duration := greatest(
      v_settings.minimum_duration_minutes,
      coalesce(new.route_duration_minutes, v_quote.duration_minutes)
    );
    v_raw := v_settings.base_fee
      + greatest(v_distance - v_settings.base_distance_km, 0)
      * v_settings.extra_per_km;
    v_fee := case
      when v_distance <= v_settings.base_distance_km then v_settings.base_fee
      else ceil(v_raw / v_settings.rounding_increment)
        * v_settings.rounding_increment
    end;
  else
    v_distance := v_quote.distance_km;
    v_duration := v_quote.duration_minutes;
    v_fee := v_quote.delivery_fee;
    new.route_distance_km := v_distance;
    new.route_duration_minutes := v_duration;
    new.route_source := coalesce(new.route_source, 'postgis_direct');
  end if;

  select coalesce(
    (b.metadata->>'avgPrepTimeMinutes')::integer,
    (b.metadata->>'avg_prep_time_minutes')::integer,
    15
  )
  into v_prep
  from public.businesses b
  where b.id = new.business_id;

  new.delivery_distance_km := round(v_distance::numeric, 2)::double precision;
  new.delivery_fee := v_fee;
  new.total_amount := coalesce(new.subtotal, 0)
    + v_fee
    + coalesce(new.tax_amount, 0)
    - coalesce(new.discount_amount, 0);
  new.estimated_delivery_time := now()
    + make_interval(mins => greatest(10, coalesce(v_prep, 15) + v_duration));

  new.pickup_address := coalesce(
    v_pickup.formatted_address,
    concat_ws(', ', v_pickup.street_address, v_pickup.city, v_pickup.state_province)
  );
  new.pickup_lat := v_pickup.latitude::double precision;
  new.pickup_lng := v_pickup.longitude::double precision;
  new.pickup_place_id := v_pickup.place_id;

  new.delivery_address := coalesce(
    v_delivery.formatted_address,
    concat_ws(', ', v_delivery.street_address, v_delivery.city, v_delivery.state_province)
  );
  new.delivery_lat := v_delivery.latitude::double precision;
  new.delivery_lng := v_delivery.longitude::double precision;
  new.delivery_place_id := v_delivery.place_id;

  new.metadata := coalesce(new.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'delivery_duration_minutes', v_duration,
      'delivery_pricing_source', new.route_source,
      'delivery_pricing_calculated_at', now(),
      'pickup_address_id', v_pickup.id,
      'delivery_location_status', 'exact'
    );

  return new;
end;
$$;

revoke all on function public.set_order_delivery_pricing()
  from public, anon, authenticated;
grant execute on function public.set_order_delivery_pricing()
  to service_role;

drop trigger if exists set_order_delivery_pricing_trigger on public.orders;
create trigger set_order_delivery_pricing_trigger
before insert or update of
  business_id,
  pickup_address_id,
  delivery_address_id,
  subtotal,
  tax_amount,
  discount_amount
on public.orders
for each row execute function public.set_order_delivery_pricing();
