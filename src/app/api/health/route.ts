import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDomiGenerativeConfiguration } from '@/lib/domi/model/grounded-generator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REQUIRED_PUBLIC_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
] as const;

export async function GET() {
  const missingConfiguration: string[] = REQUIRED_PUBLIC_ENV_VARS.filter((name) => !process.env[name]);
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) missingConfiguration.push('SUPABASE_SECRET_KEY');

  let databaseStatus: 'ok' | 'error' | 'skipped' = 'skipped';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url && serviceKey) {
    try {
      const supabase = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

      databaseStatus = error ? 'error' : 'ok';
      if (error) console.error('[Health] Database check failed:', error.code || 'database_query_failed');
    } catch (cause) {
      databaseStatus = 'error';
      console.error('[Health] Database check crashed:', cause instanceof Error ? cause.name : 'unknown_error');
    }
  }

  const generative = getDomiGenerativeConfiguration();
  const healthy = missingConfiguration.length === 0 && databaseStatus === 'ok';
  const release = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || process.env.npm_package_version || 'unknown';

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
      release,
      configuration: {
        status: missingConfiguration.length === 0 ? 'ok' : 'error',
        missing: missingConfiguration,
      },
      services: {
        database: { status: databaseStatus },
        domi: {
          status: 'ok',
          deterministicFallback: true,
          generativeEnhancement: generative.enabled ? 'configured' : 'disabled',
        },
      },
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex, nofollow, nosnippet',
      },
    },
  );
}
