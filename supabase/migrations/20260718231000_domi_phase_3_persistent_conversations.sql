begin;

alter table public.domi_conversations
  add column if not exists tenant_id text,
  add column if not exists summary text not null default '',
  add column if not exists active_goal text,
  add column if not exists current_context jsonb not null default '{}'::jsonb,
  add column if not exists last_message_at timestamptz,
  add column if not exists archived_at timestamptz;

update public.domi_conversations
set tenant_id = coalesce(nullif(metadata ->> 'tenantId', ''), user_id::text),
    current_context = case
      when current_context = '{}'::jsonb then jsonb_strip_nulls(jsonb_build_object(
        'path', nullif(metadata ->> 'path', ''),
        'locale', nullif(metadata ->> 'locale', ''),
        'tenantType', nullif(metadata ->> 'tenantType', '')
      ))
      else current_context
    end
where tenant_id is null or current_context = '{}'::jsonb;

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

create or replace function public.prepare_domi_conversation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.tenant_id := coalesce(nullif(new.tenant_id, ''), nullif(new.metadata ->> 'tenantId', ''), new.user_id::text);
  if new.current_context is null or new.current_context = '{}'::jsonb then
    new.current_context := jsonb_strip_nulls(jsonb_build_object(
      'path', nullif(new.metadata ->> 'path', ''),
      'locale', nullif(new.metadata ->> 'locale', ''),
      'tenantType', nullif(new.metadata ->> 'tenantType', '')
    ));
  end if;
  new.last_message_at := coalesce(new.last_message_at, new.updated_at, new.created_at, now());
  return new;
end;
$$;

drop trigger if exists domi_conversations_prepare on public.domi_conversations;
create trigger domi_conversations_prepare
before insert or update on public.domi_conversations
for each row execute function public.prepare_domi_conversation();

create or replace function public.touch_domi_conversation_from_message()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  first_user text;
  last_user text;
  last_assistant text;
  generated_summary text;
begin
  select left(regexp_replace(content, '\s+', ' ', 'g'), 220)
  into first_user
  from public.domi_messages
  where conversation_id = new.conversation_id and role = 'user'
  order by created_at asc, id asc
  limit 1;

  select left(regexp_replace(content, '\s+', ' ', 'g'), 220)
  into last_user
  from public.domi_messages
  where conversation_id = new.conversation_id and role = 'user'
  order by created_at desc, id desc
  limit 1;

  select left(regexp_replace(content, '\s+', ' ', 'g'), 220)
  into last_assistant
  from public.domi_messages
  where conversation_id = new.conversation_id and role = 'assistant'
  order by created_at desc, id desc
  limit 1;

  generated_summary := left(concat_ws(' · ',
    case when first_user is not null then 'Tema: ' || first_user end,
    case when last_user is not null and last_user is distinct from first_user then 'Última solicitud: ' || last_user end,
    case when last_assistant is not null then 'Última respuesta: ' || last_assistant end
  ), 520);

  update public.domi_conversations
  set last_message_at = new.created_at,
      updated_at = greatest(updated_at, new.created_at),
      summary = coalesce(generated_summary, summary),
      active_goal = case
        when new.role = 'user' then left(regexp_replace(new.content, '\s+', ' ', 'g'), 180)
        else active_goal
      end,
      current_context = case
        when new.role = 'user' then current_context || jsonb_strip_nulls(jsonb_build_object(
          'path', nullif(new.metadata ->> 'path', ''),
          'intent', nullif(new.metadata ->> 'intent', ''),
          'tenantType', nullif(new.metadata ->> 'tenantType', ''),
          'sessionId', nullif(new.metadata ->> 'sessionId', '')
        ))
        else current_context
      end
  where id = new.conversation_id
    and user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists domi_messages_touch_conversation on public.domi_messages;
create trigger domi_messages_touch_conversation
after insert on public.domi_messages
for each row execute function public.touch_domi_conversation_from_message();

with summaries as (
  select
    c.id,
    left(concat_ws(' · ',
      case when first_message.content is not null then 'Tema: ' || left(regexp_replace(first_message.content, '\s+', ' ', 'g'), 220) end,
      case when last_user.content is not null and last_user.content is distinct from first_message.content then 'Última solicitud: ' || left(regexp_replace(last_user.content, '\s+', ' ', 'g'), 220) end,
      case when last_assistant.content is not null then 'Última respuesta: ' || left(regexp_replace(last_assistant.content, '\s+', ' ', 'g'), 220) end
    ), 520) as generated_summary,
    left(regexp_replace(coalesce(last_user.content, ''), '\s+', ' ', 'g'), 180) as generated_goal
  from public.domi_conversations c
  left join lateral (
    select content from public.domi_messages
    where conversation_id = c.id and role = 'user'
    order by created_at asc, id asc limit 1
  ) first_message on true
  left join lateral (
    select content from public.domi_messages
    where conversation_id = c.id and role = 'user'
    order by created_at desc, id desc limit 1
  ) last_user on true
  left join lateral (
    select content from public.domi_messages
    where conversation_id = c.id and role = 'assistant'
    order by created_at desc, id desc limit 1
  ) last_assistant on true
)
update public.domi_conversations c
set summary = coalesce(nullif(s.generated_summary, ''), c.summary),
    active_goal = coalesce(nullif(s.generated_goal, ''), c.active_goal)
from summaries s
where s.id = c.id;

commit;
