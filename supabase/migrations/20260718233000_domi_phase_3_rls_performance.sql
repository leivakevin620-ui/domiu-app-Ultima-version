begin;

create index if not exists domi_messages_user_idx
  on public.domi_messages (user_id);

drop policy if exists "Users manage own Domi conversations" on public.domi_conversations;
create policy "Users manage own Domi conversations"
on public.domi_conversations
for all
to authenticated
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
for all
to authenticated
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
for all
to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin())
)
with check (
  user_id = (select auth.uid())
  or (select public.is_admin())
);

commit;
