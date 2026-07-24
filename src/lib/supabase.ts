import { createClient } from "@supabase/supabase-js";

const FALLBACK_SUPABASE_URL = "https://muikwpjyaojeolwcuvqf.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "sb_publishable_Kcd-ANNCG6ZZhmQhH3jsTA_hqGXOCqO";
const RETIRED_PROJECTS = ["auyzmvyfscvfzrhhjejq", "vuwaqmwgvldqmmgkpyjh"];

function isUsableConfiguredUrl(value?: string) {
  if (!value || value.includes("placeholder")) return false;
  return !RETIRED_PROJECTS.some((projectRef) => value.includes(projectRef));
}

export function getSupabaseConfig() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const configuredKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (isUsableConfiguredUrl(configuredUrl) && configuredKey) {
    return { supabaseUrl: configuredUrl!, supabaseAnonKey: configuredKey };
  }

  return {
    supabaseUrl: FALLBACK_SUPABASE_URL,
    supabaseAnonKey: FALLBACK_SUPABASE_ANON_KEY,
  };
}

let cachedClient: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!cachedClient) {
    const config = getSupabaseConfig();
    cachedClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return cachedClient;
}

const supabaseProxy = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    const client = getClient();
    const value = (client as unknown as Record<string, unknown>)[prop as string];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export { supabaseProxy as supabase };

export function resetSupabaseClient() {
  cachedClient = null;
  return getClient();
}

export function getSupabaseClient() {
  return getClient();
}
