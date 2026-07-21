import { z } from 'zod';

/* eslint-disable @typescript-eslint/no-explicit-any */

const isDev = process.env.NODE_ENV === 'development';

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),
  NEXT_PUBLIC_GA_ID: z.string().optional(),
});

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DOMI_GENERATIVE_PROVIDER: z.enum(['disabled', 'openai']).optional(),
  DOMI_OPENAI_MODEL: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const mergedSchema = clientSchema.merge(serverSchema);

export type Env = z.infer<typeof mergedSchema>;

let parsed: Env | null = null;

function getPlaceholders(): Env {
  return {
    NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-key',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: undefined,
    NEXT_PUBLIC_GA_ID: undefined,
    SUPABASE_SECRET_KEY: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    DOMI_GENERATIVE_PROVIDER: 'disabled',
    DOMI_OPENAI_MODEL: undefined,
    OPENAI_API_KEY: undefined,
    NODE_ENV: process.env.NODE_ENV || 'development',
  };
}

export function getEnv(): Env {
  if (parsed) return parsed;

  const raw: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DOMI_GENERATIVE_PROVIDER: process.env.DOMI_GENERATIVE_PROVIDER,
    DOMI_OPENAI_MODEL: process.env.DOMI_OPENAI_MODEL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
  };

  const result = mergedSchema.safeParse(raw);

  if (!result.success) {
    if (isDev) {
      console.warn('[Env] Variables de entorno incompletas. Usando placeholders para desarrollo.');
      const missing = result.error.issues
        .filter(i => i.path.length > 0
          && !i.path[0].toString().startsWith('NEXT_PUBLIC_GOOGLE')
          && !i.path[0].toString().startsWith('SUPABASE_SERVICE')
          && !i.path[0].toString().startsWith('SUPABASE_SECRET')
          && !i.path[0].toString().startsWith('DOMI_')
          && !i.path[0].toString().startsWith('OPENAI_'))
        .map(i => i.path.join('.'));
      if (missing.length > 0) {
        console.warn('[Env] Variables faltantes:', [...new Set(missing)].join(', '));
      }
      parsed = { ...getPlaceholders(), ...result.data as any };
      return parsed as Env;
    }
    console.warn('[Env] Usando placeholders. Algunas funciones no estarán disponibles.');
    parsed = getPlaceholders();
    return parsed;
  }

  parsed = result.data;
  return parsed;
}

export function getSupabaseServerKey(): string | undefined {
  const env = getEnv();
  return env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
}

export function isSupabaseConfigured(): boolean {
  const env = getEnv();
  return !!(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    && !env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder'));
}

export function isMapsConfigured(): boolean {
  const env = getEnv();
  return !!env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

export function isDevMode(): boolean {
  return getEnv().NODE_ENV === 'development';
}

export { getEnv as env };
