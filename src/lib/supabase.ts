import { createClient } from "@supabase/supabase-js";

function buildMockClient() {
  return new Proxy({} as Record<string, unknown>, {
    get(_target, prop) {
      if (prop === "then") return undefined;
      return () => buildMockClient();
    },
  });
}

function getUrlAndKey() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("placeholder")) {
    return { supabaseUrl, supabaseAnonKey };
  }
  if (typeof window !== "undefined") {
    console.warn("Supabase no configurado. Las funciones de base de datos no estarán disponibles.");
  }
  return null;
}

let cachedClient: ReturnType<typeof createClient> | null = null;
let mockClient: unknown = null;

function getClient() {
  const config = getUrlAndKey();
  if (!config) {
    if (!mockClient) mockClient = buildMockClient();
    return mockClient as ReturnType<typeof createClient>;
  }
  if (!cachedClient) {
    cachedClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return cachedClient;
}

const supabaseProxy = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    const client = getClient();
    const value = (client as Record<string, unknown>)[prop];
    if (typeof value === "function") return value.bind(client);
    return value;
  },
});

export { supabaseProxy as supabase };

export function resetSupabaseClient() {
  const config = getUrlAndKey();
  if (config) {
    cachedClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
}

export function getSupabaseClient() {
  return getClient();
}
