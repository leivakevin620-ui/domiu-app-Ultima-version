create table if not exists public.domi_proactive_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('order_delay', 'draft_pending', 'coupon_expiring', 'favorite_available', 'conversation_goal', 'system_notice')),
  title text not null,
  message text not null,
  action_url text,
  fingerprint text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'pending' check (status in ('pending', 'delivered', 'read', 'dismissed', 'expired')),
  metadata jsonb not null default '{}'::jsonb,
  deliver_after timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz,
  dismissed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);
create index if not exists idx_domi_proactive_events_delivery on public.domi_proactive_events(user_id, status, deliver_after, priority);
alter table public.domi_proactive_events enable row level security;
drop policy if exists domi_proactive_events_owner_select on public.domi_proactive_events;
create policy domi_proactive_events_owner_select on public.domi_proactive_events for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.domi_proactive_events from anon, authenticated;
grant select on public.domi_proactive_events to authenticated;
comment on table public.domi_proactive_events is 'Consent-controlled in-app proactive assistance generated from verified DomiU data.';