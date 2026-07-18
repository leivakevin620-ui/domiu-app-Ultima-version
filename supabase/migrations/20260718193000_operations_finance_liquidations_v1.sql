-- DomiU Magdalena
-- Núcleo financiero y operativo v1.
-- Todos los valores monetarios se almacenan como pesos enteros COP.

create extension if not exists pgcrypto;

create table if not exists public.platform_financial_settings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default 'default',
  currency text not null default 'COP' check (currency = 'COP'),
  courier_delivery_rate_bps integer not null default 8000 check (courier_delivery_rate_bps between 0 and 10000),
  platform_delivery_rate_bps integer not null default 2000 check (platform_delivery_rate_bps between 0 and 10000),
  customer_service_rate_bps integer not null default 300 check (customer_service_rate_bps between 0 and 10000),
  customer_service_minimum_cop bigint not null default 500 check (customer_service_minimum_cop >= 0),
  customer_service_maximum_cop bigint not null default 2500 check (customer_service_maximum_cop >= customer_service_minimum_cop),
  manual_delivery_service_fee_cop bigint not null default 500 check (manual_delivery_service_fee_cop >= 0),
  rounding_increment_cop bigint not null default 100 check (rounding_increment_cop > 0),
  service_fee_enabled boolean not null default true,
  is_active boolean not null default true,
  effective_from timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_financial_distribution_exact check (
    courier_delivery_rate_bps + platform_delivery_rate_bps = 10000
  )
);

insert into public.platform_financial_settings (code)
values ('default')
on conflict (code) do nothing;

alter table public.orders add column if not exists service_fee bigint not null default 0;
alter table public.orders add column if not exists business_earnings bigint not null default 0;
alter table public.orders add column if not exists courier_earnings bigint not null default 0;
alter table public.orders add column if not exists platform_delivery_commission bigint not null default 0;
alter table public.orders add column if not exists platform_service_fee bigint not null default 0;
alter table public.orders add column if not exists platform_earnings bigint not null default 0;
alter table public.orders add column if not exists payment_holder text;
alter table public.orders add column if not exists financial_snapshot jsonb not null default '{}'::jsonb;
alter table public.orders add column if not exists financial_calculated_at timestamptz;

alter table public.orders drop constraint if exists orders_service_fee_nonnegative;
alter table public.orders add constraint orders_service_fee_nonnegative check (service_fee >= 0);
alter table public.orders drop constraint if exists orders_business_earnings_nonnegative;
alter table public.orders add constraint orders_business_earnings_nonnegative check (business_earnings >= 0);
alter table public.orders drop constraint if exists orders_courier_earnings_nonnegative;
alter table public.orders add constraint orders_courier_earnings_nonnegative check (courier_earnings >= 0);
alter table public.orders drop constraint if exists orders_platform_delivery_commission_nonnegative;
alter table public.orders add constraint orders_platform_delivery_commission_nonnegative check (platform_delivery_commission >= 0);
alter table public.orders drop constraint if exists orders_platform_service_fee_nonnegative;
alter table public.orders add constraint orders_platform_service_fee_nonnegative check (platform_service_fee >= 0);
alter table public.orders drop constraint if exists orders_platform_earnings_nonnegative;
alter table public.orders add constraint orders_platform_earnings_nonnegative check (platform_earnings >= 0);
alter table public.orders drop constraint if exists orders_payment_holder_valid;
alter table public.orders add constraint orders_payment_holder_valid check (
  payment_holder is null or payment_holder in ('courier', 'business', 'platform')
);

create or replace function public.domiu_calculate_order_financials(
  p_subtotal bigint,
  p_delivery_fee bigint,
  p_tax_amount bigint default 0,
  p_discount_amount bigint default 0,
  p_order_type text default 'product_order'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings public.platform_financial_settings%rowtype;
  v_service_fee bigint := 0;
  v_courier bigint := 0;
  v_platform_delivery bigint := 0;
  v_platform_total bigint := 0;
  v_customer_total bigint := 0;
  v_raw_service numeric := 0;
begin
  if coalesce(p_subtotal, 0) < 0 or coalesce(p_delivery_fee, 0) < 0
     or coalesce(p_tax_amount, 0) < 0 or coalesce(p_discount_amount, 0) < 0 then
    raise exception 'Los valores monetarios no pueden ser negativos';
  end if;

  select * into v_settings
  from public.platform_financial_settings
  where is_active = true and effective_from <= now()
  order by effective_from desc, created_at desc
  limit 1;

  if not found then
    raise exception 'No existe una configuración financiera activa';
  end if;

  if v_settings.service_fee_enabled then
    if coalesce(p_order_type, 'product_order') = 'manual_delivery' then
      v_service_fee := v_settings.manual_delivery_service_fee_cop;
    elsif p_subtotal > 0 then
      v_raw_service := (p_subtotal::numeric * v_settings.customer_service_rate_bps::numeric) / 10000;
      v_service_fee := round(v_raw_service / v_settings.rounding_increment_cop) * v_settings.rounding_increment_cop;
      v_service_fee := greatest(v_settings.customer_service_minimum_cop, v_service_fee);
      v_service_fee := least(v_settings.customer_service_maximum_cop, v_service_fee);
    end if;
  end if;

  v_courier := round((p_delivery_fee::numeric * v_settings.courier_delivery_rate_bps::numeric) / 10000);
  v_platform_delivery := p_delivery_fee - v_courier;
  v_platform_total := v_platform_delivery + v_service_fee;
  v_customer_total := greatest(0, p_subtotal + p_delivery_fee + v_service_fee + p_tax_amount - p_discount_amount);

  if p_subtotal + v_courier + v_platform_total + p_tax_amount - p_discount_amount <> v_customer_total then
    raise exception 'El cálculo financiero no conserva el total';
  end if;

  return jsonb_build_object(
    'currency', 'COP',
    'subtotal', p_subtotal,
    'delivery_fee', p_delivery_fee,
    'service_fee', v_service_fee,
    'tax_amount', p_tax_amount,
    'discount_amount', p_discount_amount,
    'customer_total', v_customer_total,
    'business_earnings', p_subtotal,
    'courier_earnings', v_courier,
    'platform_delivery_commission', v_platform_delivery,
    'platform_service_fee', v_service_fee,
    'platform_earnings', v_platform_total,
    'courier_delivery_rate_bps', v_settings.courier_delivery_rate_bps,
    'platform_delivery_rate_bps', v_settings.platform_delivery_rate_bps,
    'customer_service_rate_bps', v_settings.customer_service_rate_bps,
    'settings_id', v_settings.id,
    'calculated_at', now()
  );
end;
$$;

revoke all on function public.domiu_calculate_order_financials(bigint,bigint,bigint,bigint,text) from public, anon, authenticated;
grant execute on function public.domiu_calculate_order_financials(bigint,bigint,bigint,bigint,text) to service_role;

create or replace function public.apply_order_financial_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_breakdown jsonb;
begin
  if tg_op = 'UPDATE' and old.status not in ('pending', 'confirmed') then
    if new.subtotal is distinct from old.subtotal
       or new.delivery_fee is distinct from old.delivery_fee
       or new.tax_amount is distinct from old.tax_amount
       or new.discount_amount is distinct from old.discount_amount then
      raise exception 'No se puede cambiar el valor de un pedido después de iniciar su operación';
    end if;
    return new;
  end if;

  v_breakdown := public.domiu_calculate_order_financials(
    coalesce(new.subtotal, 0)::bigint,
    coalesce(new.delivery_fee, 0)::bigint,
    coalesce(new.tax_amount, 0)::bigint,
    coalesce(new.discount_amount, 0)::bigint,
    coalesce(new.order_type, 'product_order')
  );

  new.service_fee := (v_breakdown->>'service_fee')::bigint;
  new.business_earnings := (v_breakdown->>'business_earnings')::bigint;
  new.courier_earnings := (v_breakdown->>'courier_earnings')::bigint;
  new.platform_delivery_commission := (v_breakdown->>'platform_delivery_commission')::bigint;
  new.platform_service_fee := (v_breakdown->>'platform_service_fee')::bigint;
  new.platform_earnings := (v_breakdown->>'platform_earnings')::bigint;
  new.total_amount := (v_breakdown->>'customer_total')::bigint;
  new.financial_snapshot := v_breakdown;
  new.financial_calculated_at := now();
  new.payment_holder := case
    when new.payment_method = 'cash' then 'courier'
    when new.payment_method = 'transfer' then 'business'
    else 'platform'
  end;
  return new;
end;
$$;

revoke all on function public.apply_order_financial_snapshot() from public, anon, authenticated;

drop trigger if exists trg_apply_order_financial_snapshot on public.orders;
create trigger trg_apply_order_financial_snapshot
before insert or update of subtotal, delivery_fee, tax_amount, discount_amount, order_type, payment_method
on public.orders
for each row execute function public.apply_order_financial_snapshot();

create table if not exists public.order_financial_snapshots (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  snapshot jsonb not null,
  subtotal_cop bigint not null,
  delivery_fee_cop bigint not null,
  service_fee_cop bigint not null,
  customer_total_cop bigint not null,
  business_earnings_cop bigint not null,
  courier_earnings_cop bigint not null,
  platform_earnings_cop bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_financial_snapshots_order
on public.order_financial_snapshots(order_id, created_at desc);

create or replace function public.archive_order_financial_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT'
     or new.financial_snapshot is distinct from old.financial_snapshot then
    insert into public.order_financial_snapshots (
      order_id, snapshot, subtotal_cop, delivery_fee_cop, service_fee_cop,
      customer_total_cop, business_earnings_cop, courier_earnings_cop,
      platform_earnings_cop
    ) values (
      new.id, new.financial_snapshot, new.subtotal::bigint, new.delivery_fee::bigint,
      new.service_fee::bigint, new.total_amount::bigint, new.business_earnings::bigint,
      new.courier_earnings::bigint, new.platform_earnings::bigint
    );
  end if;
  return new;
end;
$$;

revoke all on function public.archive_order_financial_snapshot() from public, anon, authenticated;

drop trigger if exists trg_archive_order_financial_snapshot on public.orders;
create trigger trg_archive_order_financial_snapshot
after insert or update of financial_snapshot on public.orders
for each row execute function public.archive_order_financial_snapshot();

alter table public.businesses add column if not exists is_open boolean not null default false;
alter table public.businesses add column if not exists opened_at timestamptz;
alter table public.businesses add column if not exists closed_at timestamptz;

create table if not exists public.operation_sessions (
  id uuid primary key default gen_random_uuid(),
  session_type text not null check (session_type in ('business', 'courier', 'platform')),
  actor_id uuid references public.profiles(id) on delete set null,
  business_id uuid references public.businesses(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  online_seconds bigint not null default 0 check (online_seconds >= 0),
  opening_note text,
  closing_note text,
  opened_by uuid references public.profiles(id) on delete set null,
  closed_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operation_session_business_scope check (
    (session_type = 'business' and business_id is not null)
    or (session_type <> 'business')
  )
);

create unique index if not exists uq_open_business_operation_session
on public.operation_sessions(business_id)
where session_type = 'business' and status = 'open';

create unique index if not exists uq_open_courier_operation_session
on public.operation_sessions(actor_id)
where session_type = 'courier' and status = 'open';

create index if not exists idx_operation_sessions_period
on public.operation_sessions(session_type, opened_at desc, closed_at desc);

update public.businesses
set is_open = true,
    opened_at = coalesce(opened_at, now()),
    closed_at = null
where is_active = true
  and is_verified = true
  and coalesce(metadata->>'catalog_status', 'live') = 'live'
  and coalesce((metadata->>'accepting_orders')::boolean, true) = true;

insert into public.operation_sessions (
  session_type, actor_id, business_id, status, opened_at, opened_by, opening_note, metadata
)
select 'business', b.owner_id, b.id, 'open', coalesce(b.opened_at, now()), b.owner_id,
       'Jornada inicial creada durante la migración operativa',
       jsonb_build_object('source', 'migration_20260718193000')
from public.businesses b
where b.is_open = true
on conflict do nothing;

create or replace function public.open_business_operation(p_business_id uuid, p_note text default null)
returns public.operation_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.operation_sessions%rowtype;
  v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid() and deleted_at is null;
  if not exists (
    select 1 from public.businesses
    where id = p_business_id and deleted_at is null
      and (owner_id = auth.uid() or v_role in ('admin','super_admin','operations_admin'))
  ) then
    raise exception 'No tienes permiso para abrir este comercio';
  end if;

  if not exists (
    select 1 from public.businesses
    where id = p_business_id and is_active = true and is_verified = true
      and coalesce(metadata->>'catalog_status', 'live') = 'live'
  ) then
    raise exception 'El comercio debe estar activo, verificado y con catálogo aprobado';
  end if;

  select * into v_session
  from public.operation_sessions
  where business_id = p_business_id and session_type = 'business' and status = 'open'
  limit 1;
  if found then return v_session; end if;

  insert into public.operation_sessions (
    session_type, actor_id, business_id, status, opened_by, opening_note
  ) values ('business', auth.uid(), p_business_id, 'open', auth.uid(), nullif(trim(p_note), ''))
  returning * into v_session;

  update public.businesses
  set is_open = true,
      opened_at = v_session.opened_at,
      closed_at = null,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('accepting_orders', true),
      updated_at = now()
  where id = p_business_id;

  return v_session;
end;
$$;

create or replace function public.close_business_operation(p_business_id uuid, p_note text default null)
returns public.operation_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.operation_sessions%rowtype;
  v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid() and deleted_at is null;
  if not exists (
    select 1 from public.businesses
    where id = p_business_id and deleted_at is null
      and (owner_id = auth.uid() or v_role in ('admin','super_admin','operations_admin'))
  ) then
    raise exception 'No tienes permiso para cerrar este comercio';
  end if;

  if exists (
    select 1 from public.orders
    where business_id = p_business_id
      and status in ('pending','confirmed','preparing','ready','assigned','accepted','picked_up','in_transit')
      and deleted_at is null
  ) then
    raise exception 'No se puede cerrar la jornada mientras existan pedidos activos';
  end if;

  update public.operation_sessions
  set status = 'closed',
      closed_at = now(),
      online_seconds = greatest(0, extract(epoch from (now() - opened_at))::bigint),
      closed_by = auth.uid(),
      closing_note = nullif(trim(p_note), ''),
      updated_at = now()
  where business_id = p_business_id and session_type = 'business' and status = 'open'
  returning * into v_session;

  if not found then raise exception 'El comercio no tiene una jornada abierta'; end if;

  update public.businesses
  set is_open = false,
      closed_at = v_session.closed_at,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('accepting_orders', false),
      updated_at = now()
  where id = p_business_id;

  return v_session;
end;
$$;

grant execute on function public.open_business_operation(uuid,text) to authenticated;
grant execute on function public.close_business_operation(uuid,text) to authenticated;

create or replace function public.guard_business_order_availability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
begin
  select * into v_business from public.businesses where id = new.business_id and deleted_at is null;
  if not found then raise exception 'El comercio no existe'; end if;
  if not v_business.is_active or not v_business.is_verified then
    raise exception 'El comercio no está habilitado para recibir pedidos';
  end if;
  if coalesce(v_business.metadata->>'catalog_status', 'live') <> 'live' then
    raise exception 'El catálogo del comercio todavía no está aprobado';
  end if;
  if not v_business.is_open then
    raise exception 'El comercio está cerrado y no puede recibir pedidos';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_business_order_availability() from public, anon, authenticated;

drop trigger if exists trg_guard_business_order_availability on public.orders;
create trigger trg_guard_business_order_availability
before insert on public.orders
for each row execute function public.guard_business_order_availability();

create table if not exists public.financial_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  account_type text not null check (account_type in ('courier', 'platform')),
  account_id uuid references public.profiles(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  operation_session_id uuid references public.operation_sessions(id) on delete set null,
  entry_type text not null check (entry_type in (
    'courier_earning', 'cash_collected', 'company_payment_to_courier',
    'courier_payment_to_company', 'platform_revenue', 'adjustment', 'reversal'
  )),
  amount_cop bigint not null check (amount_cop >= 0),
  balance_effect_cop bigint not null,
  status text not null default 'posted' check (status in ('pending', 'posted', 'settled', 'reversed')),
  description text,
  reference text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists uq_financial_ledger_order_entry
on public.financial_ledger_entries(order_id, account_type, coalesce(account_id, '00000000-0000-0000-0000-000000000000'::uuid), entry_type)
where order_id is not null and status <> 'reversed';

create index if not exists idx_financial_ledger_account
on public.financial_ledger_entries(account_type, account_id, created_at desc);

create or replace function public.post_delivered_order_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session uuid;
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    if new.courier_id is null then raise exception 'Un pedido entregado debe tener repartidor'; end if;

    select id into v_session
    from public.operation_sessions
    where actor_id = new.courier_id and session_type = 'courier' and status = 'open'
    order by opened_at desc limit 1;

    insert into public.financial_ledger_entries (
      account_type, account_id, order_id, operation_session_id, entry_type,
      amount_cop, balance_effect_cop, description, metadata
    ) values (
      'courier', new.courier_id, new.id, v_session, 'courier_earning',
      new.courier_earnings::bigint, new.courier_earnings::bigint,
      'Ganancia neta del repartidor por el domicilio',
      jsonb_build_object('order_number', new.order_number, 'payment_holder', new.payment_holder)
    ) on conflict do nothing;

    if new.payment_holder = 'courier' then
      insert into public.financial_ledger_entries (
        account_type, account_id, order_id, operation_session_id, entry_type,
        amount_cop, balance_effect_cop, description, metadata
      ) values (
        'courier', new.courier_id, new.id, v_session, 'cash_collected',
        new.total_amount::bigint, -new.total_amount::bigint,
        'Dinero del pedido cobrado en efectivo y pendiente de entrega a DomiU',
        jsonb_build_object('order_number', new.order_number)
      ) on conflict do nothing;
    end if;

    insert into public.financial_ledger_entries (
      account_type, account_id, order_id, entry_type, amount_cop,
      balance_effect_cop, description, metadata
    ) values (
      'platform', null, new.id, 'platform_revenue', new.platform_earnings::bigint,
      new.platform_earnings::bigint, 'Ingreso de DomiU por comisión de domicilio y tarifa de servicio',
      jsonb_build_object('order_number', new.order_number)
    ) on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.post_delivered_order_ledger() from public, anon, authenticated;

drop trigger if exists trg_post_delivered_order_ledger on public.orders;
create trigger trg_post_delivered_order_ledger
after update of status on public.orders
for each row execute function public.post_delivered_order_ledger();

create or replace view public.courier_balance_summary_v
with (security_invoker = true)
as
select
  account_id as courier_id,
  coalesce(sum(balance_effect_cop) filter (where status in ('posted','settled')), 0)::bigint as net_balance_cop,
  greatest(coalesce(sum(balance_effect_cop) filter (where status in ('posted','settled')), 0), 0)::bigint as company_owes_courier_cop,
  greatest(-coalesce(sum(balance_effect_cop) filter (where status in ('posted','settled')), 0), 0)::bigint as courier_owes_company_cop,
  coalesce(sum(amount_cop) filter (where entry_type = 'courier_earning' and status <> 'reversed'), 0)::bigint as lifetime_earnings_cop,
  coalesce(sum(amount_cop) filter (where entry_type = 'cash_collected' and status <> 'reversed'), 0)::bigint as lifetime_cash_collected_cop,
  max(created_at) as last_movement_at
from public.financial_ledger_entries
where account_type = 'courier'
group by account_id;

create or replace function public.record_courier_settlement(
  p_courier_id uuid,
  p_direction text,
  p_amount_cop bigint,
  p_reference text default null,
  p_note text default null
)
returns public.financial_ledger_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_entry public.financial_ledger_entries%rowtype;
begin
  select role into v_role from public.profiles where id = auth.uid() and deleted_at is null;
  if v_role not in ('admin','super_admin','finance_admin') then
    raise exception 'Solo un administrador financiero puede registrar liquidaciones';
  end if;
  if p_amount_cop <= 0 then raise exception 'El valor debe ser mayor que cero'; end if;
  if p_direction not in ('company_to_courier','courier_to_company') then
    raise exception 'Dirección de liquidación no válida';
  end if;

  insert into public.financial_ledger_entries (
    account_type, account_id, entry_type, amount_cop, balance_effect_cop,
    status, description, reference, created_by, settled_at
  ) values (
    'courier', p_courier_id,
    case when p_direction = 'company_to_courier' then 'company_payment_to_courier' else 'courier_payment_to_company' end,
    p_amount_cop,
    case when p_direction = 'company_to_courier' then -p_amount_cop else p_amount_cop end,
    'settled', nullif(trim(p_note), ''), nullif(trim(p_reference), ''), auth.uid(), now()
  ) returning * into v_entry;
  return v_entry;
end;
$$;

grant execute on function public.record_courier_settlement(uuid,text,bigint,text,text) to authenticated;

create or replace view public.courier_daily_payment_stub_v
with (security_invoker = true)
as
select
  o.courier_id,
  (o.updated_at at time zone 'America/Bogota')::date as work_date,
  count(*) filter (where o.status = 'delivered')::integer as completed_deliveries,
  coalesce(sum(o.delivery_fee) filter (where o.status = 'delivered'), 0)::bigint as delivery_fees_cop,
  coalesce(sum(o.courier_earnings) filter (where o.status = 'delivered'), 0)::bigint as courier_net_earnings_cop,
  coalesce(sum(o.total_amount) filter (where o.status = 'delivered' and o.payment_holder = 'courier'), 0)::bigint as cash_collected_cop,
  coalesce(sum(o.courier_earnings - case when o.payment_holder = 'courier' then o.total_amount else 0 end) filter (where o.status = 'delivered'), 0)::bigint as period_balance_effect_cop,
  min(o.created_at) as first_order_at,
  max(o.updated_at) as last_order_at
from public.orders o
where o.courier_id is not null
group by o.courier_id, (o.updated_at at time zone 'America/Bogota')::date;

create or replace view public.daily_company_operations_v
with (security_invoker = true)
as
with days as (
  select distinct (created_at at time zone 'America/Bogota')::date as operation_date from public.orders
  union
  select distinct (created_at at time zone 'America/Bogota')::date from public.profiles
  union
  select distinct (created_at at time zone 'America/Bogota')::date from public.businesses
)
select
  d.operation_date,
  (select count(*) from public.orders o where (o.created_at at time zone 'America/Bogota')::date = d.operation_date)::integer as orders_created,
  (select count(*) from public.orders o where (o.updated_at at time zone 'America/Bogota')::date = d.operation_date and o.status = 'delivered')::integer as orders_delivered,
  (select count(*) from public.orders o where (o.updated_at at time zone 'America/Bogota')::date = d.operation_date and o.status = 'cancelled')::integer as orders_cancelled,
  (select coalesce(sum(o.subtotal),0) from public.orders o where (o.updated_at at time zone 'America/Bogota')::date = d.operation_date and o.status = 'delivered')::bigint as product_sales_cop,
  (select coalesce(sum(o.delivery_fee),0) from public.orders o where (o.updated_at at time zone 'America/Bogota')::date = d.operation_date and o.status = 'delivered')::bigint as delivery_fees_cop,
  (select coalesce(sum(o.service_fee),0) from public.orders o where (o.updated_at at time zone 'America/Bogota')::date = d.operation_date and o.status = 'delivered')::bigint as service_fees_cop,
  (select coalesce(sum(o.business_earnings),0) from public.orders o where (o.updated_at at time zone 'America/Bogota')::date = d.operation_date and o.status = 'delivered')::bigint as business_earnings_cop,
  (select coalesce(sum(o.courier_earnings),0) from public.orders o where (o.updated_at at time zone 'America/Bogota')::date = d.operation_date and o.status = 'delivered')::bigint as courier_earnings_cop,
  (select coalesce(sum(o.platform_earnings),0) from public.orders o where (o.updated_at at time zone 'America/Bogota')::date = d.operation_date and o.status = 'delivered')::bigint as domiu_earnings_cop,
  (select count(*) from public.profiles p where (p.created_at at time zone 'America/Bogota')::date = d.operation_date)::integer as users_registered,
  (select count(*) from public.businesses b where (b.created_at at time zone 'America/Bogota')::date = d.operation_date)::integer as businesses_registered,
  (select count(*) from public.operation_sessions s where (s.opened_at at time zone 'America/Bogota')::date = d.operation_date and s.session_type = 'business')::integer as business_shifts_opened,
  (select count(*) from public.operation_sessions s where (s.opened_at at time zone 'America/Bogota')::date = d.operation_date and s.session_type = 'courier')::integer as courier_shifts_opened
from days d;

alter table public.platform_financial_settings enable row level security;
alter table public.order_financial_snapshots enable row level security;
alter table public.operation_sessions enable row level security;
alter table public.financial_ledger_entries enable row level security;

create policy platform_financial_settings_admin_read on public.platform_financial_settings
for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','super_admin','finance_admin'))
);

create policy operation_sessions_participant_read on public.operation_sessions
for select to authenticated using (
  actor_id = auth.uid()
  or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','super_admin','operations_admin','finance_admin'))
);

create policy ledger_courier_or_admin_read on public.financial_ledger_entries
for select to authenticated using (
  (account_type = 'courier' and account_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','super_admin','finance_admin'))
);

create policy financial_snapshots_authorized_read on public.order_financial_snapshots
for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and (
      o.customer_id = auth.uid() or o.courier_id = auth.uid()
      or exists (select 1 from public.businesses b where b.id = o.business_id and b.owner_id = auth.uid())
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','super_admin','finance_admin'))
    )
  )
);

comment on column public.financial_ledger_entries.balance_effect_cop is
'Perspectiva del repartidor: positivo = DomiU le debe; negativo = el repartidor le debe a DomiU.';
comment on column public.orders.service_fee is
'Tarifa de servicio DomiU cobrada al cliente y mostrada de forma separada antes de confirmar.';
