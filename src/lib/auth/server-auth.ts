import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { getServiceClient } from '@/lib/db/supabase';
import type { UserProfile } from '@/types/auth';
import { PermissionManager } from '@/lib/auth/permissions';

export interface AuthSession {
  user: { id: string; email: string };
  profile: UserProfile;
}

interface AuthResult {
  session: AuthSession;
  error?: never;
}

interface AuthError {
  session?: never;
  error: { message: string; status: number };
}

type RequireAuthResult = AuthResult | AuthError;

async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error('supabase_auth_configuration_missing');

  return createServerClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Algunos contextos de React Server Components son de solo lectura.
        }
      },
    },
  });
}

export const getServerSession = cache(async (): Promise<{
  userId?: string; email?: string; error?: string; status?: number
}> => {
  try {
    const supabase = await createServerSupabaseClient();
    // getUser valida el JWT contra Supabase Auth. No se usa getSession porque
    // únicamente decodifica el estado local de cookies y no es una autorización.
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) {
      return { userId: user.id, email: user.email || '' };
    }

    return { error: 'No autenticado', status: 401 };
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : 'unknown_auth_error';
    return {
      error: reason === 'supabase_auth_configuration_missing'
        ? 'Configuración de autenticación incompleta'
        : 'Error de autenticación',
      status: 500,
    };
  }
});

export const requireAuth = cache(async (): Promise<RequireAuthResult> => {
  const session = await getServerSession();
  if (!session.userId) {
    return { error: { message: session.error || 'No autenticado', status: session.status || 401 } };
  }

  const serviceClient = getServiceClient();
  const { data: profile, error } = await serviceClient
    .from('profiles')
    .select('*')
    .eq('id', session.userId)
    .single();

  if (error || !profile) {
    return { error: { message: 'Perfil no encontrado', status: 404 } };
  }

  return {
    session: {
      user: { id: session.userId, email: session.email || '' },
      profile: profile as UserProfile,
    },
  };
});

export async function requireRole(allowedRoles: string[]): Promise<AuthSession> {
  const result = await requireAuth();
  if (result.error) {
    redirect('/login');
  }

  const { session } = result;
  if (!allowedRoles.includes(session.profile.role)) {
    redirect('/?error=unauthorized');
  }

  return session;
}

export async function requirePermission(permission: string): Promise<AuthSession> {
  const result = await requireAuth();
  if (result.error) {
    redirect('/login');
  }

  const { session } = result;
  if (!PermissionManager.hasPermission(session.profile.role, permission)) {
    redirect('/?error=unauthorized');
  }

  return session;
}
