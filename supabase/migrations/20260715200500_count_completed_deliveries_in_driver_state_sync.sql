create or replace function public.sync_driver_state_from_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_first_delivery boolean := false;
begin
  if tg_op = 'INSERT' then
    v_first_delivery := new.status = 'delivered';
  elsif tg_op = 'UPDATE' then
    v_first_delivery := new.status = 'delivered' and old.status is distinct from 'delivered';
  end if;

  if new.courier_id is not null and new.status in ('assigned','accepted','picked_up','in_transit') then
    update public.drivers
    set status = 'busy',
        is_active = true,
        is_available = false,
        updated_at = now()
    where id = new.courier_id;
  elsif new.courier_id is not null and new.status = 'delivered' then
    update public.drivers
    set status = 'available',
        is_active = true,
        is_available = true,
        total_deliveries = coalesce(total_deliveries, 0) + case when v_first_delivery then 1 else 0 end,
        completed_deliveries = coalesce(completed_deliveries, 0) + case when v_first_delivery then 1 else 0 end,
        updated_at = now()
    where id = new.courier_id;
  elsif new.courier_id is not null and new.status = 'cancelled' then
    update public.drivers
    set status = 'available',
        is_active = true,
        is_available = true,
        updated_at = now()
    where id = new.courier_id;
  end if;

  return new;
end;
$$;

alter function public.sync_driver_state_from_order() owner to postgres;
