begin;

alter table public.domi_conversations enable row level security;
alter table public.domi_messages enable row level security;
alter table public.domi_user_memory enable row level security;
alter table public.domi_knowledge_articles enable row level security;

revoke all on public.domi_conversations from anon;
revoke all on public.domi_messages from anon;
revoke all on public.domi_user_memory from anon;
revoke all on public.domi_knowledge_articles from anon;

grant select, insert, update, delete on public.domi_conversations to authenticated;
grant select, insert, update, delete on public.domi_messages to authenticated;
grant select, insert, update, delete on public.domi_user_memory to authenticated;
grant select, insert, update, delete on public.domi_knowledge_articles to authenticated;

drop policy if exists "Users manage own Domi conversations" on public.domi_conversations;
create policy "Users manage own Domi conversations"
on public.domi_conversations
for all to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin())
)
with check (
  user_id = (select auth.uid())
  or (select public.is_admin())
);

drop policy if exists "Users manage own Domi messages" on public.domi_messages;
create policy "Users manage own Domi messages"
on public.domi_messages
for all to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin())
)
with check (
  user_id = (select auth.uid())
  or (select public.is_admin())
);

drop policy if exists "Users manage own Domi memory" on public.domi_user_memory;
create policy "Users manage own Domi memory"
on public.domi_user_memory
for all to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin())
)
with check (
  user_id = (select auth.uid())
  or (select public.is_admin())
);

drop policy if exists "Authenticated read Domi knowledge" on public.domi_knowledge_articles;
create policy "Authenticated read Domi knowledge"
on public.domi_knowledge_articles
for select to authenticated
using (
  is_active = true
  and (
    audience_role is null
    or audience_role = (
      select p.role
      from public.profiles p
      where p.id = (select auth.uid())
    )
  )
);

drop policy if exists "Admins manage Domi knowledge" on public.domi_knowledge_articles;
create policy "Admins manage Domi knowledge"
on public.domi_knowledge_articles
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

commit;