begin;

alter table public.domi_conversations
  add column if not exists tenant_id text,
  add column if not exists summary text not null default '',
  add column if not exists active_goal text,
  add column if not exists current_context jsonb not null default '{}'::jsonb,
  add column if not exists last_message_at timestamptz,
  add column if not exists archived_at timestamptz;

update public.domi_conversations
set tenant_id = coalesce(nullif(metadata ->> 'tenantId', ''), user_id::text)
where tenant_id is null;

update public.domi_conversations c
set last_message_at = coalesce(
  (select max(m.created_at) from public.domi_messages m where m.conversation_id = c.id),
  c.updated_at,
  c.created_at
)
where last_message_at is null;

alter table public.domi_conversations
  alter column last_message_at set default now(),
  alter column last_message_at set not null;

alter table public.domi_conversations
  drop constraint if exists domi_conversations_status_check;

alter table public.domi_conversations
  add constraint domi_conversations_status_check
  check (status in ('active', 'paused', 'completed', 'archived'));

create index if not exists domi_conversations_user_status_last_idx
  on public.domi_conversations (user_id, status, last_message_at desc);

create index if not exists domi_conversations_tenant_idx
  on public.domi_conversations (tenant_id, last_message_at desc);

create or replace function public.touch_domi_conversation_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.domi_conversations
  set last_message_at = new.created_at,
      updated_at = greatest(updated_at, new.created_at)
  where id = new.conversation_id
    and user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists domi_messages_touch_conversation on public.domi_messages;
create trigger domi_messages_touch_conversation
after insert on public.domi_messages
for each row execute function public.touch_domi_conversation_from_message();

commit;
