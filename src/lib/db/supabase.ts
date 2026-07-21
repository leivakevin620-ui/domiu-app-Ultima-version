import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import { getEnv, getSupabaseServerKey } from '@/lib/env';

type SupabaseClientType = SupabaseClient;
let browserClient: SupabaseClientType | null = null;
let serviceClient: SupabaseClientType | null = null;

function buildMockClient(): SupabaseClientType {
  return new Proxy({} as Record<string, unknown>, {
    get(_target, prop) {
      if (prop === 'then') return undefined;
      return () => buildMockClient();
    },
  }) as unknown as SupabaseClientType;
}

export function getBrowserClient() {
  if (browserClient) return browserClient;
  const env = getEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return buildMockClient();
  }
  browserClient = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as unknown as SupabaseClientType;
  return browserClient;
}

export function getServiceClient() {
  if (serviceClient) return serviceClient;
  const env = getEnv();
  const serverKey = getSupabaseServerKey();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !serverKey) {
    return buildMockClient();
  }
  serviceClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as SupabaseClientType;
  return serviceClient;
}

export { isSupabaseConfigured } from '@/lib/env';
