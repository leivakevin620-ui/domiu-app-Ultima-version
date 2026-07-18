begin;

alter function public.prepare_domi_conversation() security invoker;
alter function public.touch_domi_conversation_from_message() security invoker;

commit;
