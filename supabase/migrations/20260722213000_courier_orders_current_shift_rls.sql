-- Enforce courier order visibility at the database boundary.
-- Couriers may only read or update orders while they have an open shift.
-- Assigned/completed orders are visible only when their last operational update
-- happened during the currently open courier shift. Admins, customers and
-- business owners keep their existing visibility.

create or replace function public.current_courier_has_open_shift()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.courier_shifts cs
    join public.operations_days od on od.id = cs.operation_day_id
    where cs.courier_id = auth.uid()
      and cs.status = 'open'
      and od.status = 'open'
  );
$$;

create or replace function public.courier_order_belongs_to_open_shift(
  p_courier_id uuid,
  p_order_updated_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p_courier_id = auth.uid()
    and exists (
      select 1
      from public.courier_shifts cs
      join public.operations_days od on od.id = cs.operation_day_id
      where cs.courier_id = auth.uid()
        and cs.status = 'open'
        and od.status = 'open'
        and p_order_updated_at >= cs.started_at
    );
$$;

revoke all on function public.current_courier_has_open_shift() from public, anon;
revoke all on function public.courier_order_belongs_to_open_shift(uuid, timestamptz) from public, anon;
grant execute on function public.current_courier_has_open_shift() to authenticated;
grant execute on function public.courier_order_belongs_to_open_shift(uuid, timestamptz) to authenticated;

drop policy if exists "Couriers read available orders" on public.orders;
create policy "Couriers read available orders"
on public.orders
for select
to authenticated
using (
  public.is_courier()
  and public.current_courier_has_open_shift()
  and courier_id is null
  and status in ('confirmed'::public.order_status, 'ready'::public.order_status)
);

drop policy if exists "Order participants read orders" on public.orders;
create policy "Order participants read orders"
on public.orders
for select
to authenticated
using (
  public.is_admin()
  or customer_id = auth.uid()
  or public.courier_order_belongs_to_open_shift(courier_id, updated_at)
  or exists (
    select 1
    from public.businesses b
    where b.id = orders.business_id
      and b.owner_id = auth.uid()
  )
);

drop policy if exists "Couriers update available or assigned orders" on public.orders;
create policy "Couriers update available or assigned orders"
on public.orders
for update
to authenticated
using (
  public.is_courier()
  and public.current_courier_has_open_shift()
  and (
    public.courier_order_belongs_to_open_shift(courier_id, updated_at)
    or (
      courier_id is null
      and status in ('confirmed'::public.order_status, 'ready'::public.order_status)
    )
  )
)
with check (
  courier_id = auth.uid()
  and public.current_courier_has_open_shift()
  and status in (
    'assigned'::public.order_status,
    'accepted'::public.order_status,
    'picked_up'::public.order_status,
    'in_transit'::public.order_status,
    'delivered'::public.order_status
  )
);
