create table if not exists public.domi_voice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.domi_conversations(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'completed', 'interrupted', 'failed')),
  language text not null default 'es-CO',
  transcript_count integer not null default 0 check (transcript_count >= 0),
  last_transcript text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists idx_domi_voice_sessions_user on public.domi_voice_sessions(user_id, started_at desc);
alter table public.domi_voice_sessions enable row level security;
drop policy if exists domi_voice_sessions_owner_select on public.domi_voice_sessions;
create policy domi_voice_sessions_owner_select on public.domi_voice_sessions for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.domi_voice_sessions from anon, authenticated;
grant select on public.domi_voice_sessions to authenticated;
comment on table public.domi_voice_sessions is 'Auditable voice interactions without storing audio recordings.';