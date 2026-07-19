begin;

create table if not exists public.domi_user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  memory_enabled boolean not null default true,
  proactive_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.domi_pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.domi_conversations(id) on delete cascade,
  role text not null check (role in ('customer', 'merchant', 'courier', 'admin')),
  tenant_id text not null,
  action_name text not null,
  action_arguments jsonb not null default '{}'::jsonb,
  summary text not null,
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'executed', 'expired', 'failed')),
  idempotency_key uuid not null default gen_random_uuid(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  confirmed_at timestamptz,
  executed_at timestamptz,
  result jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists domi_pending_actions_user_status_idx
  on public.domi_pending_actions(user_id, status, created_at desc);

create index if not exists domi_pending_actions_expiry_idx
  on public.domi_pending_actions(status, expires_at)
  where status = 'pending';

alter table public.domi_user_settings enable row level security;
alter table public.domi_pending_actions enable row level security;

revoke all on public.domi_user_settings from anon, authenticated;
revoke all on public.domi_pending_actions from anon, authenticated;

grant select on public.domi_user_settings to authenticated;
grant select on public.domi_pending_actions to authenticated;

drop policy if exists "Users read own Domi settings" on public.domi_user_settings;
create policy "Users read own Domi settings"
  on public.domi_user_settings
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users read own pending Domi actions" on public.domi_pending_actions;
create policy "Users read own pending Domi actions"
  on public.domi_pending_actions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

comment on table public.domi_user_settings is
  'User-controlled preferences for Domi memory and proactive assistance.';

comment on table public.domi_pending_actions is
  'Short-lived, auditable Domi actions that require explicit confirmation before execution.';

commit;
