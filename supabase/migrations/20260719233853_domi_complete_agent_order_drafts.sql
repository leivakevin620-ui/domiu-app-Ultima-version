create table if not exists public.domi_order_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.domi_conversations(id) on delete set null,
  business_id uuid not null references public.businesses(id) on delete restrict,
  address_id uuid references public.addresses(id) on delete set null,
  coupon_id uuid references public.coupons(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'ready', 'converted', 'cancelled', 'expired')),
  items jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0 check (subtotal >= 0),
  delivery_fee numeric not null default 0 check (delivery_fee >= 0),
  service_fee numeric not null default 0 check (service_fee >= 0),
  discount_amount numeric not null default 0 check (discount_amount >= 0),
  total_amount numeric not null default 0 check (total_amount >= 0),
  payment_method text,
  special_instructions text,
  source text not null default 'domi',
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  converted_order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_domi_order_drafts_user_status
  on public.domi_order_drafts(user_id, status, updated_at desc);

alter table public.domi_order_drafts enable row level security;
drop policy if exists domi_order_drafts_owner_select on public.domi_order_drafts;
create policy domi_order_drafts_owner_select on public.domi_order_drafts
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.domi_order_drafts from anon, authenticated;
grant select on public.domi_order_drafts to authenticated;

comment on table public.domi_order_drafts is
  'Reversible purchase preparations created by Domi before manual checkout and payment.';