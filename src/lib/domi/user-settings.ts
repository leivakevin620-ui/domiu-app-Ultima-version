import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export type DomiProactiveFrequency = 'off' | 'important_only' | 'daily' | 'realtime';
export type DomiProactiveChannel = 'in_app' | 'push' | 'email';

export interface DomiUserSettings {
  memoryEnabled: boolean;
  proactiveEnabled: boolean;
  voiceEnabled: boolean;
  speechOutputEnabled: boolean;
  learningEnabled: boolean;
  proactiveFrequency: DomiProactiveFrequency;
  proactiveChannel: DomiProactiveChannel;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  preferredLanguage: string;
}

const DEFAULT_SETTINGS: DomiUserSettings = {
  memoryEnabled: true,
  proactiveEnabled: true,
  voiceEnabled: true,
  speechOutputEnabled: true,
  learningEnabled: true,
  proactiveFrequency: 'important_only',
  proactiveChannel: 'in_app',
  quietHoursStart: null,
  quietHoursEnd: null,
  preferredLanguage: 'es-CO',
};

export async function getDomiUserSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<DomiUserSettings> {
  const { data, error } = await supabase
    .from('domi_user_settings')
    .select(`
      memory_enabled,proactive_enabled,voice_enabled,speech_output_enabled,learning_enabled,
      proactive_frequency,proactive_channel,quiet_hours_start,quiet_hours_end,preferred_language
    `)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error('domi_settings_read_failed');
  if (!data) return DEFAULT_SETTINGS;

  const frequency = data.proactive_frequency;
  const channel = data.proactive_channel;
  return {
    memoryEnabled: data.memory_enabled !== false,
    proactiveEnabled: data.proactive_enabled !== false,
    voiceEnabled: data.voice_enabled !== false,
    speechOutputEnabled: data.speech_output_enabled !== false,
    learningEnabled: data.learning_enabled !== false,
    proactiveFrequency:
      frequency === 'off' || frequency === 'daily' || frequency === 'realtime'
        ? frequency
        : 'important_only',
    proactiveChannel:
      channel === 'push' || channel === 'email' ? channel : 'in_app',
    quietHoursStart: data.quiet_hours_start ? String(data.quiet_hours_start) : null,
    quietHoursEnd: data.quiet_hours_end ? String(data.quiet_hours_end) : null,
    preferredLanguage: typeof data.preferred_language === 'string'
      ? data.preferred_language.slice(0, 24)
      : 'es-CO',
  };
}

export async function updateDomiUserSettings(
  supabase: SupabaseClient,
  userId: string,
  updates: Partial<DomiUserSettings>,
): Promise<DomiUserSettings> {
  const current = await getDomiUserSettings(supabase, userId);
  const next: DomiUserSettings = {
    memoryEnabled: updates.memoryEnabled ?? current.memoryEnabled,
    proactiveEnabled: updates.proactiveEnabled ?? current.proactiveEnabled,
    voiceEnabled: updates.voiceEnabled ?? current.voiceEnabled,
    speechOutputEnabled: updates.speechOutputEnabled ?? current.speechOutputEnabled,
    learningEnabled: updates.learningEnabled ?? current.learningEnabled,
    proactiveFrequency: updates.proactiveFrequency ?? current.proactiveFrequency,
    proactiveChannel: updates.proactiveChannel ?? current.proactiveChannel,
    quietHoursStart: updates.quietHoursStart === undefined
      ? current.quietHoursStart
      : updates.quietHoursStart,
    quietHoursEnd: updates.quietHoursEnd === undefined
      ? current.quietHoursEnd
      : updates.quietHoursEnd,
    preferredLanguage: updates.preferredLanguage ?? current.preferredLanguage,
  };

  const { error } = await supabase.from('domi_user_settings').upsert(
    {
      user_id: userId,
      memory_enabled: next.memoryEnabled,
      proactive_enabled: next.proactiveEnabled,
      voice_enabled: next.voiceEnabled,
      speech_output_enabled: next.speechOutputEnabled,
      learning_enabled: next.learningEnabled,
      proactive_frequency: next.proactiveFrequency,
      proactive_channel: next.proactiveChannel,
      quiet_hours_start: next.quietHoursStart,
      quiet_hours_end: next.quietHoursEnd,
      preferred_language: next.preferredLanguage,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) throw new Error('domi_settings_write_failed');
  return next;
}
