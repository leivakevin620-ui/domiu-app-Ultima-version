-- Domi core schema
-- Reconstructs the original Domi tables before the persistent-conversation,
-- confirmed-action and enterprise-agent extensions. The migration is additive
-- and safe for production databases where these relations already exist.

create table if not exists public.domi_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null,
  title text not null default 'Conversación con Domi',
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.domi_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.domi_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  model text,
  tokens_input integer,
  tokens_output integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.domi_user_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  memory_key text not null,
  memory_value jsonb not null,
  memory_type text not null default 'preference'
    check (memory_type in ('preference', 'instruction', 'behavior', 'business_context', 'courier_context')),
  confidence numeric not null default 1
    check (confidence >= 0 and confidence <= 1),
  source text not null default 'explicit',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, memory_key)
);

create table if not exists public.domi_knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  audience_role public.user_role,
  title text not null,
  content text not null,
  tags text[] not null default '{}'::text[],
  is_active boolean not null default true,
  version text not null default '1.0',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists domi_conversations_user_idx
  on public.domi_conversations(user_id, updated_at desc);
create index if not exists domi_messages_conversation_idx
  on public.domi_messages(conversation_id, created_at);
create index if not exists domi_messages_user_idx
  on public.domi_messages(user_id);

alter table public.domi_conversations enable row level security;
alter table public.domi_messages enable row level security;
alter table public.domi_user_memory enable row level security;
alter table public.domi_knowledge_articles enable row level security;

comment on table public.domi_conversations is
  'Authenticated conversations between a DomiU profile and Domi.';
comment on table public.domi_messages is
  'Messages belonging to an authenticated Domi conversation.';
comment on table public.domi_user_memory is
  'Explicit, user-controlled memories used by Domi.';
comment on table public.domi_knowledge_articles is
  'Reviewed operational knowledge available to Domi by audience role.';