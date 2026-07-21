import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDomiGenerativeConfiguration } from '@/lib/domi/model/grounded-generator';

export const dynamic = 'force-dynamic';

const REQUIRED_PUBLIC_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
] as const;

export async function GET() {
  const missingConfiguration = REQUIRED_PUBLIC_ENV_VARS.filter((name) => !process.env[name]);
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) missingConfiguration.push('SUPABASE_SECRET_KEY' as typeof missingConfiguration[number]);

  let databaseStatus: 'ok' | 'error' | 'skipped' = 'skipped';
  let databaseError: string | null = null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url && serviceKey) {
    try {
      const supabase = createClient(url, serviceKey, {
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

  const generative = getDomiGenerativeConfiguration();
  const healthy = missingConfiguration.length === 0 && databaseStatus === 'ok';

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      configuration: {
        status: missingConfiguration.length === 0 ? 'ok' : 'error',
        missing: missingConfiguration,
        supabaseServerKeyType: process.env.SUPABASE_SECRET_KEY ? 'secret' : serviceKey ? 'legacy_service_role' : 'missing',
      },
      services: {
        database: {
          status: databaseStatus,
          error: databaseError,
        },
        domiGenerative: {
          status: generative.enabled ? 'configured' : 'disabled',
          provider: generative.provider,
          model: generative.enabled ? generative.model : null,
          requiredForCoreOperations: false,
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
