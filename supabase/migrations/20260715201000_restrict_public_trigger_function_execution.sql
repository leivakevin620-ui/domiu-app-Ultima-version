-- Restrict public execution only when each exact function signature exists.
-- Fresh preview databases can reach this migration before legacy helpers are created.

do $$
begin
  if to_regprocedure('public.calculate_delivery_quote(uuid,uuid)') is not null then
    revoke all on function public.calculate_delivery_quote(uuid, uuid) from public, anon;
    grant execute on function public.calculate_delivery_quote(uuid, uuid) to authenticated, service_role;
  end if;

  if to_regprocedure('public.set_order_delivery_pricing()') is not null then
    revoke all on function public.set_order_delivery_pricing() from public, anon, authenticated;
    grant execute on function public.set_order_delivery_pricing() to service_role;
  end if;

  if to_regprocedure('public.sync_delivery_order_chat()') is not null then
    revoke all on function public.sync_delivery_order_chat() from public, anon, authenticated;
    grant execute on function public.sync_delivery_order_chat() to service_role;
  end if;

  if to_regprocedure('public.enforce_order_assignment_integrity()') is not null then
    revoke all on function public.enforce_order_assignment_integrity() from public, anon, authenticated;
    grant execute on function public.enforce_order_assignment_integrity() to service_role;
  end if;
end;
$$;