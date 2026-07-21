create table if not exists public.domi_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.domi_conversations(id) on delete cascade,
  message_id uuid references public.domi_messages(id) on delete set null,
  rating smallint not null check (rating in (-1, 1)),
  category text not null default 'general' check (category in ('general', 'accuracy', 'helpfulness', 'tone', 'tool_result', 'safety')),
  comment text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_domi_evaluations_conversation on public.domi_evaluations(conversation_id, created_at desc);
alter table public.domi_evaluations enable row level security;
drop policy if exists domi_evaluations_owner_select on public.domi_evaluations;
create policy domi_evaluations_owner_select on public.domi_evaluations for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.domi_evaluations from anon, authenticated;
grant select on public.domi_evaluations to authenticated;
comment on table public.domi_evaluations is 'Explicit user feedback about Domi responses.';