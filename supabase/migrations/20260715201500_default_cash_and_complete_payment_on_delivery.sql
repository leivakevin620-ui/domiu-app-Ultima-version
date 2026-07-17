alter table public.orders alter column payment_method set default 'cash'::public.payment_method;

create or replace function public.finalize_order_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.payment_method is null then
    new.payment_method := 'cash'::public.payment_method;
  end if;

  if new.status = 'delivered'::public.order_status
     and new.payment_method = 'cash'::public.payment_method
     and coalesce(new.payment_status, 'pending'::public.payment_status) = 'pending'::public.payment_status then
    new.payment_status := 'completed'::public.payment_status;
    new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
      'payment_completed_at', now(),
      'payment_completion_source', 'cash_on_delivery'
    );
  end if;

  return new;
end;
$$;

alter function public.finalize_order_payment() owner to postgres;
revoke all on function public.finalize_order_payment() from public, anon, authenticated;
grant execute on function public.finalize_order_payment() to service_role;

drop trigger if exists finalize_order_payment_trigger on public.orders;
create trigger finalize_order_payment_trigger
before insert or update of status, payment_status, payment_method
on public.orders
for each row execute function public.finalize_order_payment();

update public.orders
set payment_method = 'cash'::public.payment_method,
    payment_status = case when status = 'delivered'::public.order_status then 'completed'::public.payment_status else payment_status end,
    metadata = case
      when status = 'delivered'::public.order_status then coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'payment_completed_at', coalesce(actual_delivery_time, updated_at, now()),
        'payment_completion_source', 'cash_on_delivery_backfill'
      )
      else metadata
    end,
    updated_at = now()
where payment_method is null;
