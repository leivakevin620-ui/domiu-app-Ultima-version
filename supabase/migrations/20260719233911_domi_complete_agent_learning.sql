create table if not exists public.domi_learning_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  conversation_id uuid references public.domi_conversations(id) on delete set null,
  source_message_id uuid references public.domi_messages(id) on delete set null,
  candidate_type text not null check (candidate_type in ('correction', 'preference_pattern', 'knowledge', 'tool_gap', 'response_quality')),
  title text not null,
  content text not null,
  normalized_content text not null,
  evidence jsonb not null default '{}'::jsonb,
  audience_role public.user_role,
  private_scope boolean not null default true,
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'deployed')),
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  deployed_article_id uuid references public.domi_knowledge_articles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_domi_learning_candidates_status on public.domi_learning_candidates(status, created_at desc);
alter table public.domi_learning_candidates enable row level security;
drop policy if exists domi_learning_candidates_admin_select on public.domi_learning_candidates;
create policy domi_learning_candidates_admin_select on public.domi_learning_candidates for select to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
revoke all on public.domi_learning_candidates from anon, authenticated;
grant select on public.domi_learning_candidates to authenticated;
comment on table public.domi_learning_candidates is 'Supervised learning candidates that require human review before becoming global knowledge.';