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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseKey, {
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
          // Forward compatibility: in some Next.js versions this throws in read-only contexts
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

    const { data: { session }, error } = await supabase.auth.getSession();
    if (!error && session?.user) {
      return { userId: session.user.id, email: session.user.email || '' };
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (!userError && user) {
      return { userId: user.id, email: user.email || '' };
    }

    return { error: 'No autenticado', status: 401 };
  } catch {
    return { error: 'Error de autenticación', status: 500 };
  }
});

export const requireAuth = cache(async (): Promise<RequireAuthResult> => {
  const session = await getServerSession();
  if (!session.userId) {
    return { error: { message: session.error || 'No autenticado', status: session.status || 401 } };
  }

  const serviceClient = getServiceClient();
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('*')
    .eq('id', session.userId)
    .single();

  if (!profile) {
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
