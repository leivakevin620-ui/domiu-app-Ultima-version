-- Prevent courier shifts from leaking across platform operation days.
-- Historical orders and financial ledger rows are preserved; only open shift state is closed.

create or replace function public.close_platform_operation(p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_now timestamptz := now();
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo un administrador puede cerrar operaciones';
  end if;

  select id into v_id
  from public.operations_days
  where status = 'open'
  order by opened_at desc
  limit 1
  for update;

  if v_id is null then
    raise exception 'No existe una jornada operativa abierta';
  end if;

  if exists (
    select 1
    from public.orders
    where status in ('assigned', 'accepted', 'picked_up', 'in_transit')
      and deleted_at is null
  ) then
    raise exception 'No puedes cerrar operaciones mientras existan domicilios activos';
  end if;

  -- Turn every open courier offline before closing the shifts. This includes stale
  -- shifts from a previous operation day left open by the former implementation.
  update public.drivers d
  set status = 'offline',
      is_active = false,
      is_available = false,
      updated_at = v_now
  where exists (
    select 1
    from public.courier_shifts cs
    where cs.courier_id = d.id
      and cs.status = 'open'
  );

  update public.courier_shifts cs
  set status = 'closed',
      ended_at = v_now,
      online_minutes = greatest(0, floor(extract(epoch from (v_now - cs.started_at)) / 60)::integer),
      delivered_orders = (
        select count(*)
        from public.order_financial_ledger l
        where l.courier_id = cs.courier_id
          and l.finalized_at >= cs.started_at
          and l.finalized_at <= v_now
      ),
      gross_delivery_value = (
        select coalesce(sum(l.courier_gross_earnings), 0)
        from public.order_financial_ledger l
        where l.courier_id = cs.courier_id
          and l.finalized_at >= cs.started_at
          and l.finalized_at <= v_now
      ),
      platform_commission = (
        select coalesce(sum(l.courier_commission), 0)
        from public.order_financial_ledger l
        where l.courier_id = cs.courier_id
          and l.finalized_at >= cs.started_at
          and l.finalized_at <= v_now
      ),
      net_earnings = (
        select coalesce(sum(l.courier_net_earnings), 0)
        from public.order_financial_ledger l
        where l.courier_id = cs.courier_id
          and l.finalized_at >= cs.started_at
          and l.finalized_at <= v_now
      ),
      cash_collected = (
        select coalesce(sum(l.customer_total), 0)
        from public.order_financial_ledger l
        where l.courier_id = cs.courier_id
          and l.collector_type = 'courier'
          and l.finalized_at >= cs.started_at
          and l.finalized_at <= v_now
      ),
      company_owes_courier = (
        select coalesce(sum(case when l.collector_type <> 'courier' then l.courier_net_earnings else 0 end), 0)
        from public.order_financial_ledger l
        where l.courier_id = cs.courier_id
          and l.finalized_at >= cs.started_at
          and l.finalized_at <= v_now
      ),
      courier_owes_company = (
        select coalesce(sum(case when l.collector_type = 'courier' then l.customer_total - l.courier_net_earnings else 0 end), 0)
        from public.order_financial_ledger l
        where l.courier_id = cs.courier_id
          and l.finalized_at >= cs.started_at
          and l.finalized_at <= v_now
      ),
      notes = concat_ws(E'\n', nullif(trim(cs.notes), ''), 'Cierre automático al cerrar operaciones DomiU'),
      metadata = coalesce(cs.metadata, '{}'::jsonb) || jsonb_build_object(
        'closed_with_platform_operation', true,
        'closed_operation_day_id', v_id,
        'closed_at', v_now
      ),
      updated_at = v_now
  where cs.status = 'open';

  update public.businesses
  set is_accepting_orders = false,
      operations_status = 'closed',
      closed_at = v_now,
      updated_at = v_now
  where is_accepting_orders = true;

  update public.business_shifts
  set status = 'closed',
      closed_at = v_now,
      closed_by = auth.uid(),
      updated_at = v_now
  where status = 'open';

  update public.operations_days
  set status = 'closed',
      closed_at = v_now,
      closed_by = auth.uid(),
      closing_notes = nullif(trim(p_notes), ''),
      updated_at = v_now
  where id = v_id;

  return v_id;
end;
$$;

create or replace function public.start_courier_shift(
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shift_id uuid;
  v_operation_day_id uuid;
  v_now timestamptz := now();
begin
  if auth.uid() is null or not public.is_courier() then
    raise exception 'Solo un repartidor puede iniciar jornada';
  end if;

  select id into v_operation_day_id
  from public.operations_days
  where status = 'open'
  order by opened_at desc
  limit 1;

  if v_operation_day_id is null then
    raise exception 'DomiU no tiene una jornada operativa abierta';
  end if;

  select id into v_shift_id
  from public.courier_shifts
  where courier_id = auth.uid()
    and status = 'open'
    and operation_day_id = v_operation_day_id
  order by started_at desc
  limit 1;

  if v_shift_id is not null then
    return v_shift_id;
  end if;

  if exists (
    select 1
    from public.orders
    where courier_id = auth.uid()
      and status in ('assigned', 'accepted', 'picked_up', 'in_transit')
      and deleted_at is null
  ) then
    raise exception 'No puedes iniciar una jornada nueva mientras tengas un domicilio activo';
  end if;

  -- Close any stale open shift belonging to a previous operation day.
  update public.courier_shifts cs
  set status = 'closed',
      ended_at = v_now,
      online_minutes = greatest(0, floor(extract(epoch from (v_now - cs.started_at)) / 60)::integer),
      delivered_orders = (
        select count(*)
        from public.order_financial_ledger l
        where l.courier_id = cs.courier_id
          and l.finalized_at >= cs.started_at
          and l.finalized_at <= v_now
      ),
      gross_delivery_value = (
        select coalesce(sum(l.courier_gross_earnings), 0)
        from public.order_financial_ledger l
        where l.courier_id = cs.courier_id
          and l.finalized_at >= cs.started_at
          and l.finalized_at <= v_now
      ),
      platform_commission = (
        select coalesce(sum(l.courier_commission), 0)
        from public.order_financial_ledger l
        where l.courier_id = cs.courier_id
          and l.finalized_at >= cs.started_at
          and l.finalized_at <= v_now
      ),
      net_earnings = (
        select coalesce(sum(l.courier_net_earnings), 0)
        from public.order_financial_ledger l
        where l.courier_id = cs.courier_id
          and l.finalized_at >= cs.started_at
          and l.finalized_at <= v_now
      ),
      cash_collected = (
        select coalesce(sum(l.customer_total), 0)
        from public.order_financial_ledger l
        where l.courier_id = cs.courier_id
          and l.collector_type = 'courier'
          and l.finalized_at >= cs.started_at
          and l.finalized_at <= v_now
      ),
      company_owes_courier = (
        select coalesce(sum(case when l.collector_type <> 'courier' then l.courier_net_earnings else 0 end), 0)
        from public.order_financial_ledger l
        where l.courier_id = cs.courier_id
          and l.finalized_at >= cs.started_at
          and l.finalized_at <= v_now
      ),
      courier_owes_company = (
        select coalesce(sum(case when l.collector_type = 'courier' then l.customer_total - l.courier_net_earnings else 0 end), 0)
        from public.order_financial_ledger l
        where l.courier_id = cs.courier_id
          and l.finalized_at >= cs.started_at
          and l.finalized_at <= v_now
      ),
      notes = concat_ws(E'\n', nullif(trim(cs.notes), ''), 'Cierre automático de jornada anterior'),
      metadata = coalesce(cs.metadata, '{}'::jsonb) || jsonb_build_object(
        'closed_as_stale_shift', true,
        'replacement_operation_day_id', v_operation_day_id,
        'closed_at', v_now
      ),
      updated_at = v_now
  where cs.courier_id = auth.uid()
    and cs.status = 'open'
    and cs.operation_day_id is distinct from v_operation_day_id;

  insert into public.courier_shifts(
    courier_id,
    operation_day_id,
    start_latitude,
    start_longitude
  ) values (
    auth.uid(),
    v_operation_day_id,
    p_latitude,
    p_longitude
  )
  returning id into v_shift_id;

  update public.drivers
  set status = 'available',
      is_active = true,
      is_available = true,
      updated_at = v_now
  where id = auth.uid();

  return v_shift_id;
end;
$$;

-- Repair stale shifts created by the previous implementation. A shift is only
-- closed automatically when it has no active delivery.
update public.drivers d
set status = 'offline',
    is_active = false,
    is_available = false,
    updated_at = now()
where exists (
  select 1
  from public.courier_shifts cs
  left join public.operations_days od on od.id = cs.operation_day_id
  where cs.courier_id = d.id
    and cs.status = 'open'
    and coalesce(od.status, 'closed') <> 'open'
    and not exists (
      select 1
      from public.orders o
      where o.courier_id = cs.courier_id
        and o.status in ('assigned', 'accepted', 'picked_up', 'in_transit')
        and o.deleted_at is null
    )
);

update public.courier_shifts cs
set status = 'closed',
    ended_at = now(),
    online_minutes = greatest(0, floor(extract(epoch from (now() - cs.started_at)) / 60)::integer),
    delivered_orders = (
      select count(*) from public.order_financial_ledger l
      where l.courier_id = cs.courier_id and l.finalized_at >= cs.started_at
    ),
    gross_delivery_value = (
      select coalesce(sum(l.courier_gross_earnings), 0) from public.order_financial_ledger l
      where l.courier_id = cs.courier_id and l.finalized_at >= cs.started_at
    ),
    platform_commission = (
      select coalesce(sum(l.courier_commission), 0) from public.order_financial_ledger l
      where l.courier_id = cs.courier_id and l.finalized_at >= cs.started_at
    ),
    net_earnings = (
      select coalesce(sum(l.courier_net_earnings), 0) from public.order_financial_ledger l
      where l.courier_id = cs.courier_id and l.finalized_at >= cs.started_at
    ),
    cash_collected = (
      select coalesce(sum(l.customer_total), 0) from public.order_financial_ledger l
      where l.courier_id = cs.courier_id and l.collector_type = 'courier' and l.finalized_at >= cs.started_at
    ),
    company_owes_courier = (
      select coalesce(sum(case when l.collector_type <> 'courier' then l.courier_net_earnings else 0 end), 0)
      from public.order_financial_ledger l
      where l.courier_id = cs.courier_id and l.finalized_at >= cs.started_at
    ),
    courier_owes_company = (
      select coalesce(sum(case when l.collector_type = 'courier' then l.customer_total - l.courier_net_earnings else 0 end), 0)
      from public.order_financial_ledger l
      where l.courier_id = cs.courier_id and l.finalized_at >= cs.started_at
    ),
    notes = concat_ws(E'\n', nullif(trim(cs.notes), ''), 'Reparación de jornada antigua abierta'),
    metadata = coalesce(cs.metadata, '{}'::jsonb) || jsonb_build_object(
      'repaired_stale_shift', true,
      'repaired_at', now()
    ),
    updated_at = now()
from public.operations_days od
where cs.status = 'open'
  and cs.operation_day_id = od.id
  and od.status <> 'open'
  and not exists (
    select 1
    from public.orders o
    where o.courier_id = cs.courier_id
      and o.status in ('assigned', 'accepted', 'picked_up', 'in_transit')
      and o.deleted_at is null
  );
