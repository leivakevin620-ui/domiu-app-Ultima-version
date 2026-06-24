import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/server-auth';
import { getServiceClient, getBrowserClient } from '@/lib/db/supabase';
import { getEnv } from '@/lib/env';

export async function GET() {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll().map(c => ({ name: c.name, value: c.value.length > 20 ? c.value.substring(0, 20) + '...' : c.value }));
    const sbCookies = cookieStore.getAll().filter(c => c.name.startsWith('sb-'));

    const result = await requireAuth();
    if (result.error) {
      return NextResponse.json({
        error: 'No autenticado',
        details: result.error,
        totalCookies: allCookies.length,
        sbCookies: sbCookies.map(c => ({ name: c.name, value: c.value.length > 20 ? c.value.substring(0, 20) + '...' : c.value })),
        allCookieNames: allCookies.map(c => c.name),
        hints: [
          'setAll en createServerSupabaseClient ahora escribe cookies correctamente',
          'Asegúrate de estar logueado como admin en esta misma pestaña',
          'Si usaste varias pestañas, cierra sesión y vuelve a iniciar',
          'Si no ves cookies sb-*, el token no se está enviando al servidor',
        ],
      }, { status: 401 });
    }
    if (result.session.profile.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const env = getEnv();
    const serviceClient = getServiceClient();
    const browserClient = getBrowserClient();

    const hasServiceKey = !!env.SUPABASE_SERVICE_ROLE_KEY;
    const hasAnonKey = !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const hasUrl = !!env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceIsMock = !serviceClient?.from;

    let bizCount = -1;
    let bizError: string | null = null;
    let bizSample: unknown[] = [];

    if (!serviceIsMock) {
      const { data, error } = await serviceClient
        .from('businesses')
        .select('id, name, slug, owner_id, is_verified, is_active, created_at')
        .limit(5);

      if (error) {
        bizError = error.message;
      } else {
        bizCount = data?.length ?? 0;
        bizSample = data ?? [];
      }
    }

    let profileCount = -1;
    let profileError: string | null = null;
    let profileSample: unknown[] = [];

    if (!serviceIsMock) {
      const { data, error } = await serviceClient
        .from('profiles')
        .select('id, email, role, status')
        .limit(5);

      if (error) {
        profileError = error.message;
      } else {
        profileCount = data?.length ?? 0;
        profileSample = data ?? [];
      }
    }

    return NextResponse.json({
      auth: {
        user: { id: result.session.user.id, email: result.session.user.email },
        profile: { id: result.session.profile.id, role: result.session.profile.role, email: result.session.profile.email },
      },
      env: {
        hasServiceKey,
        hasAnonKey,
        hasUrl,
        serviceIsMock,
      },
      businesses: {
        count: bizCount,
        error: bizError,
        sample: bizSample,
      },
      profiles: {
        count: profileCount,
        error: profileError,
        sample: profileSample,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
