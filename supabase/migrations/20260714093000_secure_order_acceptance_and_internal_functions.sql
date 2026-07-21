-- Protect courier acceptance from races and remove direct API execution
-- from internal trigger/security-definer functions.

create or replace function public.guard_order_courier_acceptance()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.status = 'accepted'::public.order_status then
    if old.status not in (
      'pending'::public.order_status,
      'assigned'::public.order_status,
      'confirmed'::public.order_status,
      'ready'::public.order_status,
      'accepted'::public.order_status
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'El pedido ya no está disponible para aceptación';
    end if;

    if old.courier_id is not null
       and new.courier_id is distinct from old.courier_id then
      raise exception using
        errcode = 'P0001',
        message = 'El pedido ya fue tomado por otro repartidor';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_order_courier_acceptance() from public;
revoke all on function public.guard_order_courier_acceptance() from anon;
revoke all on function public.guard_order_courier_acceptance() from authenticated;

drop trigger if exists guard_order_courier_acceptance_trigger on public.orders;
create trigger guard_order_courier_acceptance_trigger
before update of courier_id, status on public.orders
for each row
execute function public.guard_order_courier_acceptance();

-- A fresh preview can reach this point before the legacy internal functions
-- exist. Apply ACLs only when each exact signature is available.
do $$
begin
  if to_regprocedure('public.accept_available_order(uuid,uuid,text)') is not null then
    revoke execute on function public.accept_available_order(uuid, uuid, text) from public;
    revoke execute on function public.accept_available_order(uuid, uuid, text) from anon;
    revoke execute on function public.accept_available_order(uuid, uuid, text) from authenticated;
    grant execute on function public.accept_available_order(uuid, uuid, text) to service_role;
  end if;

  if to_regprocedure('public.auto_create_commission()') is not null then
    revoke execute on function public.auto_create_commission() from public;
    revoke execute on function public.auto_create_commission() from anon;
    revoke execute on function public.auto_create_commission() from authenticated;
    grant execute on function public.auto_create_commission() to service_role;
  end if;

  if to_regprocedure('public.log_order_status_change()') is not null then
    revoke execute on function public.log_order_status_change() from public;
    revoke execute on function public.log_order_status_change() from anon;
    revoke execute on function public.log_order_status_change() from authenticated;
    grant execute on function public.log_order_status_change() to service_role;
  end if;
end;
$$;