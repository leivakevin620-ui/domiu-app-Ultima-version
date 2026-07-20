-- These functions are trigger-only internals. They must not be callable
-- through the public PostgREST RPC surface.
-- Fresh databases may reach this migration before the legacy functions exist.

do $$
begin
  if to_regprocedure('public.ensure_driver_for_courier_profile()') is not null then
    revoke execute on function public.ensure_driver_for_courier_profile() from public;
    revoke execute on function public.ensure_driver_for_courier_profile() from anon;
    revoke execute on function public.ensure_driver_for_courier_profile() from authenticated;
    grant execute on function public.ensure_driver_for_courier_profile() to service_role;
  end if;

  if to_regprocedure('public.sync_driver_state_from_order()') is not null then
    revoke execute on function public.sync_driver_state_from_order() from public;
    revoke execute on function public.sync_driver_state_from_order() from anon;
    revoke execute on function public.sync_driver_state_from_order() from authenticated;
    grant execute on function public.sync_driver_state_from_order() to service_role;
  end if;
end;
$$;