-- Alinea las políticas y funciones financieras con los roles definidos en src/types/auth.ts.

create or replace function public.domiu_is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.deleted_at is null
      and p.status = 'active'
      and p.role in (
        'super_admin',
        'admin_general',
        'admin_financiero',
        'admin_operativo',
        'admin_comercial',
        'admin_soporte',
        'admin'
      )
  );
$$;

create or replace function public.domiu_is_finance_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.deleted_at is null
      and p.status = 'active'
      and p.role in ('super_admin','admin_general','admin_financiero','admin')
  );
$$;

revoke all on function public.domiu_is_admin(uuid) from public, anon;
revoke all on function public.domiu_is_finance_admin(uuid) from public, anon;
grant execute on function public.domiu_is_admin(uuid) to authenticated, service_role;
grant execute on function public.domiu_is_finance_admin(uuid) to authenticated, service_role;

create or replace function public.open_business_operation(p_business_id uuid, p_note text default null)
returns public.operation_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.operation_sessions%rowtype;
begin
  if not exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.deleted_at is null
      and (b.owner_id = auth.uid() or public.domiu_is_admin(auth.uid()))
  ) then
    raise exception 'No tienes permiso para abrir este comercio';
  end if;

  if not exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.is_active = true
      and b.is_verified = true
      and coalesce(b.metadata->>'catalog_status', 'live') = 'live'
  ) then
    raise exception 'El comercio debe estar activo, verificado y con catálogo aprobado';
  end if;

  select * into v_session
  from public.operation_sessions
  where business_id = p_business_id
    and session_type = 'business'
    and status = 'open'
  limit 1;
  if found then return v_session; end if;

  insert into public.operation_sessions (
    session_type, actor_id, business_id, status, opened_by, opening_note
  )
  select 'business', b.owner_id, b.id, 'open', auth.uid(), nullif(trim(p_note), '')
  from public.businesses b
  where b.id = p_business_id
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
begin
  if not exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.deleted_at is null
      and (b.owner_id = auth.uid() or public.domiu_is_admin(auth.uid()))
  ) then
    raise exception 'No tienes permiso para cerrar este comercio';
  end if;

  if exists (
    select 1
    from public.orders o
    where o.business_id = p_business_id
      and o.status in (
        'pending','confirmed','preparing','ready','assigned','accepted','picked_up','in_transit'
      )
      and o.deleted_at is null
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
  where business_id = p_business_id
    and session_type = 'business'
    and status = 'open'
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
  v_entry public.financial_ledger_entries%rowtype;
  v_current_balance bigint := 0;
begin
  if not public.domiu_is_finance_admin(auth.uid()) then
    raise exception 'Solo un administrador financiero puede registrar liquidaciones';
  end if;
  if p_amount_cop <= 0 then raise exception 'El valor debe ser mayor que cero'; end if;
  if p_direction not in ('company_to_courier','courier_to_company') then
    raise exception 'Dirección de liquidación no válida';
  end if;

  select coalesce(sum(balance_effect_cop) filter (where status in ('posted','settled')), 0)::bigint
  into v_current_balance
  from public.financial_ledger_entries
  where account_type = 'courier' and account_id = p_courier_id;

  if p_direction = 'company_to_courier' then
    if v_current_balance <= 0 then raise exception 'DomiU no tiene un saldo pendiente a favor del repartidor'; end if;
    if p_amount_cop > v_current_balance then raise exception 'El pago supera el saldo que DomiU debe al repartidor'; end if;
  else
    if v_current_balance >= 0 then raise exception 'El repartidor no tiene un saldo pendiente con DomiU'; end if;
    if p_amount_cop > abs(v_current_balance) then raise exception 'El valor recibido supera el saldo que debe el repartidor'; end if;
  end if;

  insert into public.financial_ledger_entries (
    account_type, account_id, entry_type, amount_cop, balance_effect_cop,
    status, description, reference, created_by, settled_at
  ) values (
    'courier',
    p_courier_id,
    case
      when p_direction = 'company_to_courier' then 'company_payment_to_courier'
      else 'courier_payment_to_company'
    end,
    p_amount_cop,
    case when p_direction = 'company_to_courier' then -p_amount_cop else p_amount_cop end,
    'settled',
    nullif(trim(p_note), ''),
    nullif(trim(p_reference), ''),
    auth.uid(),
    now()
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

grant execute on function public.open_business_operation(uuid,text) to authenticated;
grant execute on function public.close_business_operation(uuid,text) to authenticated;
grant execute on function public.record_courier_settlement(uuid,text,bigint,text,text) to authenticated;

-- Reemplaza políticas que utilizaban nombres de roles inexistentes.
drop policy if exists platform_financial_settings_admin_read on public.platform_financial_settings;
create policy platform_financial_settings_admin_read
on public.platform_financial_settings
for select to authenticated
using (public.domiu_is_admin(auth.uid()));

drop policy if exists operation_sessions_participant_read on public.operation_sessions;
create policy operation_sessions_participant_read
on public.operation_sessions
for select to authenticated
using (
  actor_id = auth.uid()
  or exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  )
  or public.domiu_is_admin(auth.uid())
);

drop policy if exists ledger_courier_or_admin_read on public.financial_ledger_entries;
create policy ledger_courier_or_admin_read
on public.financial_ledger_entries
for select to authenticated
using (
  (account_type = 'courier' and account_id = auth.uid())
  or public.domiu_is_finance_admin(auth.uid())
);

drop policy if exists financial_snapshots_authorized_read on public.order_financial_snapshots;
create policy financial_snapshots_authorized_read
on public.order_financial_snapshots
for select to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_id
      and (
        o.customer_id = auth.uid()
        or o.courier_id = auth.uid()
        or exists (
          select 1 from public.businesses b
          where b.id = o.business_id and b.owner_id = auth.uid()
        )
        or public.domiu_is_finance_admin(auth.uid())
      )
  )
);

drop policy if exists domi_profiles_owner_or_admin_read on public.domi_agent_profiles;
create policy domi_profiles_owner_or_admin_read
on public.domi_agent_profiles
for select to authenticated
using (user_id = auth.uid() or public.domiu_is_admin(auth.uid()));

drop policy if exists catalog_image_jobs_merchant_or_admin_read on public.catalog_image_jobs;
create policy catalog_image_jobs_merchant_or_admin_read
on public.catalog_image_jobs
for select to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  )
  or public.domiu_is_admin(auth.uid())
);

drop policy if exists catalog_image_jobs_merchant_review on public.catalog_image_jobs;
create policy catalog_image_jobs_merchant_review
on public.catalog_image_jobs
for update to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  )
  or public.domiu_is_admin(auth.uid())
)
with check (
  exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  )
  or public.domiu_is_admin(auth.uid())
);
