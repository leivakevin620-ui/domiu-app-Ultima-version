import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

export async function GET() {
  const missingConfiguration = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  let databaseStatus: 'ok' | 'error' | 'skipped' = 'skipped';
  let databaseError: string | null = null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceRoleKey) {
    try {
      const supabase = createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });

      if (error) {
        databaseStatus = 'error';
        databaseError = error.message || error.code || 'Database health query failed';
      } else {
        databaseStatus = 'ok';
      }
    } catch (error) {
      databaseStatus = 'error';
      databaseError = error instanceof Error ? error.message : 'Database health query failed';
    }
  }

  const healthy = missingConfiguration.length === 0 && databaseStatus === 'ok';

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      configuration: {
        status: missingConfiguration.length === 0 ? 'ok' : 'error',
        missing: missingConfiguration,
      },
      services: {
        database: {
          status: databaseStatus,
          error: databaseError,
        },
      },
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
