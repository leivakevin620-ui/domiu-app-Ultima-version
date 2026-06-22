import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const envVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'missing',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'set' : 'missing',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ? 'set' : 'missing',
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? 'set' : 'missing',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'missing',
    NODE_ENV: process.env.NODE_ENV || 'not set',
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let dbStatus = 'unknown';
  let dbError: string | null = null;

  if (url && anonKey) {
    try {
      const supabase = createClient(url, anonKey);
      const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).limit(1);
      if (error) {
        dbStatus = 'error';
        dbError = error.message;
      } else {
        dbStatus = 'ok';
      }
    } catch (e) {
      dbStatus = 'error';
      dbError = e instanceof Error ? e.message : 'Unknown error';
    }
  } else {
    dbStatus = 'skipped';
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    env: envVars,
    supabase: {
      db: { status: dbStatus, error: dbError },
    },
  });
}
