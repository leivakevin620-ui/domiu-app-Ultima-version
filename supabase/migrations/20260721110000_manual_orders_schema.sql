-- Manual orders enterprise schema.
-- Additive and idempotent. It does not create authentication users for guests.

alter table public.orders alter column customer_id drop not null;
alter table public.orders alter column delivery_address_id drop not null;
alter table public.addresses alter column user_id drop not null;
alter table public.order_items alter column product_id drop not null;

alter table public.businesses
  add column if not exists allow_custom_manual_products boolean not null default false,
  add column if not exists allow_manual_delivery_fee_override boolean not null default false;

alter table public.orders
  add column if not exists created_manually boolean not null default false,
  add column if not exists creation_source text not null default 'customer_app',
  add column if not exists created_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists created_by_role text,
  add column if not exists created_from_panel text,
  add column if not exists branch_id uuid references public.business_addresses(id) on delete set null,
  add column if not exists guest_customer jsonb,
  add column if not exists customer_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists delivery_address_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists business_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists sales_channel text,
  add column if not exists sales_channel_other text,
  add column if not exists delivery_type text not null default 'delivery',
  add column if not exists delivery_fee_source text,
  add column if not exists delivery_fee_overridden boolean not null default false,
  add column if not exists delivery_fee_override_reason text,
  add column if not exists currency text not null default 'COP',
  add column if not exists kitchen_notes text,
  add column if not exists courier_notes text,
  add column if not exists internal_notes text,
  add column if not exists payment_notes text,
  add column if not exists administrative_reason text,
  add column if not exists idempotency_key text,
  add column if not exists manual_request_hash text,
  add column if not exists amount_paid numeric not null default 0,
  add column if not exists surcharge_amount numeric not null default 0,
  add column if not exists tip_amount numeric not null default 0;

alter table public.order_items
  add column if not exists product_name_snapshot text,
  add column if not exists product_sku_snapshot text,
  add column if not exists product_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists variant_snapshot jsonb,
  add column if not exists modifiers_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists is_custom_product boolean not null default false,
  add column if not exists custom_description text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_manual_creation_source_check') then
    alter table public.orders add constraint orders_manual_creation_source_check
      check (creation_source in ('customer_app','manual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_manual_panel_check') then
    alter table public.orders add constraint orders_manual_panel_check
      check (created_from_panel is null or created_from_panel in ('admin','merchant'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_manual_channel_check') then
    alter table public.orders add constraint orders_manual_channel_check
      check (sales_channel is null or sales_channel in ('whatsapp','phone','in_person','instagram','facebook','direct_message','other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_manual_delivery_type_check') then
    alter table public.orders add constraint orders_manual_delivery_type_check
      check (delivery_type in ('delivery','pickup'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_manual_fee_source_check') then
    alter table public.orders add constraint orders_manual_fee_source_check
      check (delivery_fee_source is null or delivery_fee_source in ('automatic','manual','fallback','pickup'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_manual_currency_check') then
    alter table public.orders add constraint orders_manual_currency_check check (currency = 'COP');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_manual_money_check') then
    alter table public.orders add constraint orders_manual_money_check
      check (amount_paid >= 0 and surcharge_amount >= 0 and tip_amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_manual_guest_check') then
    alter table public.orders add constraint orders_manual_guest_check
      check (not created_manually or customer_id is not null or guest_customer is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'order_items_manual_product_check') then
    alter table public.order_items add constraint order_items_manual_product_check
      check ((is_custom_product and product_id is null) or (not is_custom_product and product_id is not null));
  end if;
end;
$$;

create unique index if not exists idx_orders_manual_idempotency
  on public.orders(created_by_user_id, idempotency_key)
  where created_manually = true and idempotency_key is not null;
create index if not exists idx_orders_manual_business_created
  on public.orders(business_id, created_at desc)
  where created_manually = true;
create index if not exists idx_orders_manual_guest_phone
  on public.orders((guest_customer->>'phone'))
  where created_manually = true and customer_id is null;

create table if not exists public.manual_order_drafts (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  actor_role text not null check (actor_role in ('admin','merchant')),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.business_addresses(id) on delete set null,
  title text not null default 'Pedido manual sin título',
  payload jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft','converted','deleted','expired')),
  expires_at timestamptz not null default (now() + interval '30 days'),
  converted_order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_manual_order_drafts_actor
  on public.manual_order_drafts(actor_id, status, updated_at desc);
create index if not exists idx_manual_order_drafts_business
  on public.manual_order_drafts(business_id, status, updated_at desc);

create table if not exists public.manual_order_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  movement_type text not null check (movement_type in ('decrement','restore')),
  quantity integer not null check (quantity > 0),
  actor_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(order_item_id, movement_type)
);

create index if not exists idx_manual_inventory_order
  on public.manual_order_inventory_movements(order_id, created_at desc);

alter table public.manual_order_drafts enable row level security;
alter table public.manual_order_inventory_movements enable row level security;

revoke all on public.manual_order_drafts from anon, authenticated;
revoke all on public.manual_order_inventory_movements from anon, authenticated;
grant select on public.manual_order_drafts to authenticated;
grant select on public.manual_order_inventory_movements to authenticated;

drop policy if exists manual_order_drafts_owner_select on public.manual_order_drafts;
create policy manual_order_drafts_owner_select on public.manual_order_drafts
  for select to authenticated
  using (actor_id = (select auth.uid()) or public.is_admin());

drop policy if exists manual_inventory_authorized_select on public.manual_order_inventory_movements;
create policy manual_inventory_authorized_select on public.manual_order_inventory_movements
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.orders o
      join public.businesses b on b.id = o.business_id
      where o.id = manual_order_inventory_movements.order_id
        and b.owner_id = (select auth.uid())
    )
  );

comment on table public.manual_order_drafts is 'Incomplete manual orders. Drafts never reserve stock, assign couriers or create charges.';
comment on table public.manual_order_inventory_movements is 'Idempotent stock movements created and restored by confirmed manual orders.';
