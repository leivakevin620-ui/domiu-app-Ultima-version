import { AuthChangeEvent, AuthError, Session, User } from '@supabase/supabase-js';
import { getBrowserClient } from '@/lib/db/supabase';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

import {
  LoginCredentials,
  RegisterCredentials,
  UserProfile,
  ResetPasswordRequest,
  UpdatePasswordRequest,
} from '@/types/auth';

export class SupabaseAuthService {

  static async register(credentials: RegisterCredentials): Promise<{
    user: User | null;
    profile: UserProfile | null;
    error: AuthError | string | null;
    requiresEmailConfirmation?: boolean;
    message?: string;
  }> {
    logger.debug('[Auth] register start', { email: credentials.email, role: credentials.role });
    try {
      const supabase = getBrowserClient();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: { firstName: credentials.firstName, lastName: credentials.lastName },
        },
      });

      if (authError) {
        logger.debug('[Auth] register supabase error', { message: authError.message });
        return { user: null, profile: null, error: authError };
      }
      if (!authData.user) {
        logger.debug('[Auth] register no user returned');
        return { user: null, profile: null, error: new Error('No se pudo crear el usuario') as AuthError };
      }

      const token = authData.session?.access_token;

      if (!token) {
        logger.debug('[Auth] register requires email confirmation');
        return {
          user: authData.user,
          profile: null,
          error: null,
          requiresEmailConfirmation: true,
          message: 'Registro exitoso. Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.',
        };
      }

      logger.debug('[Auth] register creating profile');

      const profileRes = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: credentials.email,
          role: credentials.role,
          first_name: credentials.firstName,
          last_name: credentials.lastName,
          status: 'active',
        }),
      });

      if (!profileRes.ok) {
        logger.debug('[Auth] register profile API error', { status: profileRes.status });
        const body = await profileRes.json().catch(() => ({}));
        return { user: null, profile: null, error: body.error || body.details || `Error del servidor (HTTP ${profileRes.status})` };
      }

      const { profile } = await profileRes.json();
      logger.debug('[Auth] register success with profile');
      return { user: authData.user, profile, error: null };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      logger.debug('[Auth] register unexpected error', { message: msg });
      return { user: null, profile: null, error: new Error(msg) as AuthError };
    }
  }

  static async login(credentials: LoginCredentials): Promise<{
    session: Session | null;
    user: User | null;
    error: AuthError | null;
  }> {
    const envUrl = getEnv().NEXT_PUBLIC_SUPABASE_URL;
    logger.debug('[Auth] login start', { email: credentials.email, url: envUrl ? envUrl.replace(/^https?:\/\//, '').split('.')[0] : 'MOCK' });
    try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
      if (error) {
        logger.debug('[Auth] login error', { message: error.message });
        return { session: null, user: null, error };
      }
      logger.debug('[Auth] login success');
      return { session: data.session, user: data.user, error: null };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      logger.debug('[Auth] login unexpected error', { message: msg });
      return { session: null, user: null, error: new Error(msg) as AuthError };
    }
  }

  static async logout(): Promise<{ error: AuthError | null }> {
    try {
      const supabase = getBrowserClient();
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      return { error: new Error(msg) as AuthError };
    }
  }

  static async getSession(): Promise<{ session: Session | null; error: AuthError | null }> {
    try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase.auth.getSession();
      return { session: data.session, error };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      return { session: null, error: new Error(msg) as AuthError };
    }
  }

  static async getCurrentUser(): Promise<{ user: User | null; error: AuthError | null }> {
    try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase.auth.getUser();
      return { user: data.user, error };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      return { user: null, error: new Error(msg) as AuthError };
    }
  }

  static async getUserProfile(userId: string): Promise<{ profile: UserProfile | null; error: unknown }> {
    try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error) return { profile: null, error };
      return { profile: data as UserProfile, error: null };
    } catch (error) {
      return { profile: null, error };
    }
  }

  static async resendVerificationEmail(email: string): Promise<{ error: AuthError | null }> {
    try {
      const supabase = getBrowserClient();
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      return { error };
    } catch (error) {
      return { error: new Error(error instanceof Error ? error.message : 'Error desconocido') as AuthError };
    }
  }

  static async resetPassword(request: ResetPasswordRequest): Promise<{ error: AuthError | null }> {
    try {
      const supabase = getBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(request.email, {
        redirectTo: `${getEnv().NEXT_PUBLIC_APP_URL}/auth/reset-password`,
      });
      return { error };
    } catch (error) {
      return { error: new Error(error instanceof Error ? error.message : 'Error desconocido') as AuthError };
    }
  }

  static async updatePassword(request: UpdatePasswordRequest): Promise<{ user: User | null; error: AuthError | null }> {
    try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase.auth.updateUser({ password: request.password });
      return { user: data.user, error };
    } catch (error) {
      return { user: null, error: new Error(error instanceof Error ? error.message : 'Error desconocido') as AuthError };
    }
  }

  static onAuthStateChange(callback: (session: Session | null, user: User | null) => void) {
    const supabase = getBrowserClient();
    return supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      callback(session, session?.user || null);
    });
  }

  static async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<{ profile: UserProfile | null; error: unknown }> {
    try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single();
      if (error) return { profile: null, error };
      return { profile: data as UserProfile, error: null };
    } catch (error) {
      return { profile: null, error };
    }
  }

  static async verifyEmail(token: string): Promise<{ session: Session | null; error: AuthError | null }> {
    try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: token, type: 'email' });
      return { session: data.session, error };
    } catch (error) {
      return { session: null, error: new Error(error instanceof Error ? error.message : 'Error desconocido') as AuthError };
    }
  }
}
