-- DomiU Magdalena
-- Núcleo financiero, jornadas operativas y libro de liquidaciones.
-- Esta migración es idempotente y reproduce la estructura aplicada en producción.

create table if not exists public.platform_financial_config (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Configuración principal',
  courier_share_bps integer not null default 9000 check (courier_share_bps between 0 and 10000),
  service_fee_bps integer not null default 250 check (service_fee_bps between 0 and 10000),
  service_fee_min numeric(12,2) not null default 500 check (service_fee_min >= 0),
  service_fee_max numeric(12,2) not null default 2500 check (service_fee_max >= service_fee_min),
  service_fee_rounding numeric(12,2) not null default 100 check (service_fee_rounding > 0),
  business_product_commission_bps integer not null default 0 check (business_product_commission_bps between 0 and 10000),
  currency text not null default 'COP',
  is_active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists platform_financial_config_one_active_idx
  on public.platform_financial_config ((is_active)) where is_active = true;

insert into public.platform_financial_config (
  name, courier_share_bps, service_fee_bps, service_fee_min, service_fee_max,
  service_fee_rounding, business_product_commission_bps, currency, is_active
)
select 'Modelo piloto unificado 90/10 + servicio 2,5%', 9000, 250, 500, 2500, 100, 0, 'COP', true
where not exists (select 1 from public.platform_financial_config where is_active = true);

alter table public.orders add column if not exists service_fee numeric(12,2) not null default 0;
alter table public.orders add column if not exists platform_delivery_commission numeric(12,2) not null default 0;
alter table public.orders add column if not exists business_earnings numeric(12,2) not null default 0;
alter table public.orders add column if not exists financial_config_id uuid references public.platform_financial_config(id);
alter table public.orders add column if not exists financial_calculated_at timestamptz;

create table if not exists public.order_financials (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  financial_config_id uuid references public.platform_financial_config(id),
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  service_fee numeric(12,2) not null default 0,
  business_earnings numeric(12,2) not null default 0,
  courier_earnings numeric(12,2) not null default 0,
  platform_delivery_commission numeric(12,2) not null default 0,
  platform_earnings numeric(12,2) not null default 0,
  customer_total numeric(12,2) not null default 0,
  payment_method text,
  calculated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operational_shifts (
  id uuid primary key default gen_random_uuid(),
  participant_type text not null check (participant_type in ('business','courier')),
  participant_id uuid not null,
  participant_name text not null,
  opened_by uuid references public.profiles(id),
  closed_by uuid references public.profiles(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  status text not null default 'open' check (status in ('open','closed','cancelled')),
  online_seconds bigint not null default 0,
  orders_count integer not null default 0,
  product_sales numeric(12,2) not null default 0,
  delivery_fees numeric(12,2) not null default 0,
  service_fees numeric(12,2) not null default 0,
  courier_earnings numeric(12,2) not null default 0,
  platform_earnings numeric(12,2) not null default 0,
  cash_collected numeric(12,2) not null default 0,
  electronic_collected numeric(12,2) not null default 0,
  company_owes_participant numeric(12,2) not null default 0,
  participant_owes_company numeric(12,2) not null default 0,
  net_balance numeric(12,2) not null default 0,
  opening_note text,
  closing_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists operational_shifts_one_open_participant_idx
  on public.operational_shifts (participant_type, participant_id)
  where status = 'open';
create index if not exists operational_shifts_participant_history_idx
  on public.operational_shifts (participant_type, participant_id, opened_at desc);

create table if not exists public.settlement_entries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  shift_id uuid references public.operational_shifts(id) on delete set null,
  participant_type text not null check (participant_type in ('business','courier')),
  participant_id uuid not null,
  direction text not null check (direction in ('company_owes_participant','participant_owes_company')),
  reason text not null check (reason in ('business_product_sale','courier_earning','cash_remittance','adjustment')),
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','settled','void')),
  description text,
  due_at timestamptz,
  settled_at timestamptz,
  settled_by uuid references public.profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, participant_type, reason)
);

create index if not exists settlement_entries_participant_pending_idx
  on public.settlement_entries (participant_type, participant_id, status, created_at desc);

create table if not exists public.settlement_batches (
  id uuid primary key default gen_random_uuid(),
  participant_type text not null check (participant_type in ('business','courier')),
  participant_id uuid not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  company_owes_participant numeric(12,2) not null default 0,
  participant_owes_company numeric(12,2) not null default 0,
  net_balance numeric(12,2) not null default 0,
  direction text not null check (direction in ('company_owes_participant','participant_owes_company','balanced')),
  status text not null default 'pending' check (status in ('pending','approved','paid','cancelled')),
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  paid_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settlement_batch_items (
  batch_id uuid not null references public.settlement_batches(id) on delete cascade,
  settlement_entry_id uuid not null unique references public.settlement_entries(id) on delete restrict,
  amount numeric(12,2) not null,
  primary key (batch_id, settlement_entry_id)
);

create or replace view public.participant_settlement_balances
with (security_invoker = true)
as
select
  participant_type,
  participant_id,
  coalesce(sum(case when direction='company_owes_participant' and status='pending' then amount else 0 end),0)::numeric(12,2) as company_owes_participant,
  coalesce(sum(case when direction='participant_owes_company' and status='pending' then amount else 0 end),0)::numeric(12,2) as participant_owes_company,
  (
    coalesce(sum(case when direction='company_owes_participant' and status='pending' then amount else 0 end),0)
    - coalesce(sum(case when direction='participant_owes_company' and status='pending' then amount else 0 end),0)
  )::numeric(12,2) as net_balance,
  count(*) filter (where status='pending')::integer as pending_entries,
  max(created_at) filter (where status='pending') as last_pending_at
from public.settlement_entries
group by participant_type, participant_id;

create or replace function public.sync_order_financial_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.order_financials (
    order_id, financial_config_id, subtotal, discount_amount, tax_amount,
    delivery_fee, service_fee, business_earnings, courier_earnings,
    platform_delivery_commission, platform_earnings, customer_total,
    payment_method, calculated_at, metadata, updated_at
  ) values (
    new.id, new.financial_config_id, coalesce(new.subtotal,0), coalesce(new.discount_amount,0),
    coalesce(new.tax_amount,0), coalesce(new.delivery_fee,0), coalesce(new.service_fee,0),
    coalesce(new.business_earnings,0), coalesce(new.courier_earnings,0),
    coalesce(new.platform_delivery_commission,0), coalesce(new.platform_earnings,0),
    coalesce(new.total_amount,0), new.payment_method::text, coalesce(new.financial_calculated_at,now()),
    jsonb_build_object('order_status', new.status::text), now()
  )
  on conflict (order_id) do update set
    financial_config_id = excluded.financial_config_id,
    subtotal = excluded.subtotal,
    discount_amount = excluded.discount_amount,
    tax_amount = excluded.tax_amount,
    delivery_fee = excluded.delivery_fee,
    service_fee = excluded.service_fee,
    business_earnings = excluded.business_earnings,
    courier_earnings = excluded.courier_earnings,
    platform_delivery_commission = excluded.platform_delivery_commission,
    platform_earnings = excluded.platform_earnings,
    customer_total = excluded.customer_total,
    payment_method = excluded.payment_method,
    calculated_at = excluded.calculated_at,
    metadata = excluded.metadata,
    updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_order_settlement_entries()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_courier_shift uuid;
  v_business_shift uuid;
  v_cash_remittance numeric;
begin
  if new.status::text in ('cancelled','refunded') then
    update public.settlement_entries
       set status='void', updated_at=now(),
           metadata=metadata || jsonb_build_object('void_reason',new.status::text)
     where order_id=new.id and status<>'settled';
    return new;
  end if;

  if new.status::text<>'delivered' or new.payment_status::text<>'completed' then
    return new;
  end if;

  select id into v_business_shift
    from public.operational_shifts
   where participant_type='business' and participant_id=new.business_id and status='open'
   order by opened_at desc limit 1;

  if new.courier_id is not null then
    select id into v_courier_shift
      from public.operational_shifts
     where participant_type='courier' and participant_id=new.courier_id and status='open'
     order by opened_at desc limit 1;
  end if;

  insert into public.settlement_entries (
    order_id,shift_id,participant_type,participant_id,direction,reason,
    amount,status,description,due_at,metadata,updated_at
  ) values (
    new.id,v_business_shift,'business',new.business_id,'company_owes_participant',
    'business_product_sale',greatest(coalesce(new.business_earnings,0),0),'pending',
    'Valor neto de productos vendidos',now()+interval '1 day',
    jsonb_build_object('payment_method',new.payment_method::text,'order_number',new.order_number),now()
  )
  on conflict (order_id,participant_type,reason) do update set
    shift_id=excluded.shift_id,
    participant_id=excluded.participant_id,
    direction=excluded.direction,
    amount=excluded.amount,
    status=case when public.settlement_entries.status='settled' then 'settled' else 'pending' end,
    description=excluded.description,
    metadata=excluded.metadata,
    updated_at=now();

  if new.courier_id is not null then
    if new.payment_method::text='cash' then
      v_cash_remittance:=greatest(coalesce(new.total_amount,0)-coalesce(new.courier_earnings,0),0);
      insert into public.settlement_entries (
        order_id,shift_id,participant_type,participant_id,direction,reason,
        amount,status,description,due_at,metadata,updated_at
      ) values (
        new.id,v_courier_shift,'courier',new.courier_id,'participant_owes_company',
        'cash_remittance',v_cash_remittance,'pending',
        'Efectivo recaudado menos la ganancia neta del repartidor',now()+interval '1 day',
        jsonb_build_object('cash_collected',new.total_amount,'courier_earnings',new.courier_earnings,'order_number',new.order_number),now()
      )
      on conflict (order_id,participant_type,reason) do update set
        shift_id=excluded.shift_id,
        participant_id=excluded.participant_id,
        direction=excluded.direction,
        amount=excluded.amount,
        status=case when public.settlement_entries.status='settled' then 'settled' else 'pending' end,
        description=excluded.description,
        metadata=excluded.metadata,
        updated_at=now();
    else
      insert into public.settlement_entries (
        order_id,shift_id,participant_type,participant_id,direction,reason,
        amount,status,description,due_at,metadata,updated_at
      ) values (
        new.id,v_courier_shift,'courier',new.courier_id,'company_owes_participant',
        'courier_earning',greatest(coalesce(new.courier_earnings,0),0),'pending',
        'Ganancia neta del domicilio pagado electrónicamente',now()+interval '1 day',
        jsonb_build_object('payment_method',new.payment_method::text,'order_number',new.order_number),now()
      )
      on conflict (order_id,participant_type,reason) do update set
        shift_id=excluded.shift_id,
        participant_id=excluded.participant_id,
        direction=excluded.direction,
        amount=excluded.amount,
        status=case when public.settlement_entries.status='settled' then 'settled' else 'pending' end,
        description=excluded.description,
        metadata=excluded.metadata,
        updated_at=now();
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.mark_all_notifications_as_read()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_count integer;
begin
  update public.notifications
     set is_read=true, read_at=coalesce(read_at,now()), updated_at=now()
   where recipient_id=auth.uid() and is_read=false and deleted_at is null;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

create or replace function public.create_settlement_batch(
  p_participant_type text,
  p_participant_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_notes text default null
)
returns public.settlement_batches
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch public.settlement_batches;
  v_company_owes numeric:=0;
  v_participant_owes numeric:=0;
  v_count integer:=0;
  v_direction text;
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede crear liquidaciones'; end if;
  if p_participant_type not in ('business','courier') then raise exception 'Tipo de participante inválido'; end if;
  if p_period_end<=p_period_start then raise exception 'El periodo de liquidación no es válido'; end if;

  select
    coalesce(sum(case when direction='company_owes_participant' then amount else 0 end),0),
    coalesce(sum(case when direction='participant_owes_company' then amount else 0 end),0),
    count(*)
  into v_company_owes,v_participant_owes,v_count
  from public.settlement_entries e
  where e.participant_type=p_participant_type
    and e.participant_id=p_participant_id
    and e.status='pending'
    and e.created_at>=p_period_start
    and e.created_at<p_period_end
    and not exists(select 1 from public.settlement_batch_items bi where bi.settlement_entry_id=e.id);

  if v_count=0 then raise exception 'No existen movimientos pendientes para este periodo'; end if;
  v_direction:=case
    when v_company_owes>v_participant_owes then 'company_owes_participant'
    when v_participant_owes>v_company_owes then 'participant_owes_company'
    else 'balanced'
  end;

  insert into public.settlement_batches (
    participant_type,participant_id,period_start,period_end,
    company_owes_participant,participant_owes_company,net_balance,
    direction,status,created_by,notes
  ) values (
    p_participant_type,p_participant_id,p_period_start,p_period_end,
    v_company_owes,v_participant_owes,v_company_owes-v_participant_owes,
    v_direction,'pending',auth.uid(),nullif(trim(p_notes),'')
  ) returning * into v_batch;

  insert into public.settlement_batch_items(batch_id,settlement_entry_id,amount)
  select v_batch.id,e.id,e.amount
  from public.settlement_entries e
  where e.participant_type=p_participant_type
    and e.participant_id=p_participant_id
    and e.status='pending'
    and e.created_at>=p_period_start
    and e.created_at<p_period_end
    and not exists(select 1 from public.settlement_batch_items bi where bi.settlement_entry_id=e.id);
  return v_batch;
end;
$$;

create or replace function public.pay_settlement_batch(p_batch_id uuid)
returns public.settlement_batches
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_batch public.settlement_batches;
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede completar liquidaciones'; end if;
  select * into v_batch from public.settlement_batches where id=p_batch_id for update;
  if v_batch.id is null then raise exception 'Liquidación no encontrada'; end if;
  if v_batch.status='paid' then return v_batch; end if;
  if v_batch.status='cancelled' then raise exception 'La liquidación está cancelada'; end if;

  update public.settlement_entries e
     set status='settled',settled_at=now(),settled_by=auth.uid(),updated_at=now()
   where e.id in (select settlement_entry_id from public.settlement_batch_items where batch_id=p_batch_id)
     and e.status='pending';

  update public.settlement_batches
     set status='paid',approved_by=auth.uid(),paid_at=now(),updated_at=now()
   where id=p_batch_id
   returning * into v_batch;
  return v_batch;
end;
$$;

drop trigger if exists sync_order_financial_snapshot_trigger on public.orders;
create trigger sync_order_financial_snapshot_trigger
  after insert or update of subtotal,discount_amount,tax_amount,delivery_fee,service_fee,
    business_earnings,courier_earnings,platform_delivery_commission,platform_earnings,
    total_amount,payment_method,status
  on public.orders
  for each row execute function public.sync_order_financial_snapshot();

drop trigger if exists sync_order_settlement_entries_trigger on public.orders;
create trigger sync_order_settlement_entries_trigger
  after insert or update of status,payment_status,payment_method,total_amount,
    business_earnings,courier_earnings,platform_earnings
  on public.orders
  for each row execute function public.sync_order_settlement_entries();

alter table public.platform_financial_config enable row level security;
alter table public.order_financials enable row level security;
alter table public.operational_shifts enable row level security;
alter table public.settlement_entries enable row level security;
alter table public.settlement_batches enable row level security;
alter table public.settlement_batch_items enable row level security;

drop policy if exists financial_config_read_authenticated on public.platform_financial_config;
create policy financial_config_read_authenticated on public.platform_financial_config
for select to authenticated using (true);

drop policy if exists financial_config_admin_manage on public.platform_financial_config;
create policy financial_config_admin_manage on public.platform_financial_config
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists order_financials_participant_read on public.order_financials;
create policy order_financials_participant_read on public.order_financials
for select to authenticated using (
  public.is_admin() or exists (
    select 1 from public.orders o
    where o.id=order_financials.order_id and (
      o.customer_id=auth.uid() or o.courier_id=auth.uid() or public.is_business_owner(o.business_id)
    )
  )
);

drop policy if exists operational_shifts_participant_read on public.operational_shifts;
create policy operational_shifts_participant_read on public.operational_shifts
for select to authenticated using (
  public.is_admin()
  or (participant_type='courier' and participant_id=auth.uid())
  or (participant_type='business' and public.is_business_owner(participant_id))
);

drop policy if exists operational_shifts_admin_manage on public.operational_shifts;
create policy operational_shifts_admin_manage on public.operational_shifts
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists settlement_entries_participant_read on public.settlement_entries;
create policy settlement_entries_participant_read on public.settlement_entries
for select to authenticated using (
  public.is_admin()
  or (participant_type='courier' and participant_id=auth.uid())
  or (participant_type='business' and public.is_business_owner(participant_id))
);

drop policy if exists settlement_entries_admin_manage on public.settlement_entries;
create policy settlement_entries_admin_manage on public.settlement_entries
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists settlement_batches_participant_read on public.settlement_batches;
create policy settlement_batches_participant_read on public.settlement_batches
for select to authenticated using (
  public.is_admin()
  or (participant_type='courier' and participant_id=auth.uid())
  or (participant_type='business' and public.is_business_owner(participant_id))
);

drop policy if exists settlement_batches_admin_manage on public.settlement_batches;
create policy settlement_batches_admin_manage on public.settlement_batches
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists settlement_batch_items_participant_read on public.settlement_batch_items;
create policy settlement_batch_items_participant_read on public.settlement_batch_items
for select to authenticated using (
  public.is_admin() or exists (
    select 1 from public.settlement_batches b
    where b.id=settlement_batch_items.batch_id and (
      (b.participant_type='courier' and b.participant_id=auth.uid())
      or (b.participant_type='business' and public.is_business_owner(b.participant_id))
    )
  )
);

drop policy if exists settlement_batch_items_admin_manage on public.settlement_batch_items;
create policy settlement_batch_items_admin_manage on public.settlement_batch_items
for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on function public.sync_order_financial_snapshot() from public,anon,authenticated;
revoke all on function public.sync_order_settlement_entries() from public,anon,authenticated;
revoke all on function public.mark_all_notifications_as_read() from public,anon;
revoke all on function public.create_settlement_batch(text,uuid,timestamptz,timestamptz,text) from public,anon,authenticated;
revoke all on function public.pay_settlement_batch(uuid) from public,anon,authenticated;
grant execute on function public.mark_all_notifications_as_read() to authenticated;
grant execute on function public.create_settlement_batch(text,uuid,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.pay_settlement_batch(uuid) to authenticated;
