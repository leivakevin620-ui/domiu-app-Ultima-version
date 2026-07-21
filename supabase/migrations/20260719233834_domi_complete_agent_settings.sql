alter table public.domi_user_settings
  add column if not exists voice_enabled boolean not null default true,
  add column if not exists speech_output_enabled boolean not null default true,
  add column if not exists learning_enabled boolean not null default true,
  add column if not exists proactive_frequency text not null default 'important_only',
  add column if not exists proactive_channel text not null default 'in_app',
  add column if not exists quiet_hours_start time,
  add column if not exists quiet_hours_end time,
  add column if not exists preferred_language text not null default 'es-CO';

alter table public.domi_user_settings
  drop constraint if exists domi_user_settings_proactive_frequency_check,
  add constraint domi_user_settings_proactive_frequency_check
    check (proactive_frequency in ('off', 'important_only', 'daily', 'realtime')),
  drop constraint if exists domi_user_settings_proactive_channel_check,
  add constraint domi_user_settings_proactive_channel_check
    check (proactive_channel in ('in_app', 'push', 'email'));