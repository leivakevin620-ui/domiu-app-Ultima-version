import { AuthError, Session, User } from '@supabase/supabase-js';
import { getBrowserClient } from '@/lib/db/supabase';
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
  }> {
    try {
      const supabase = getBrowserClient();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            firstName: credentials.firstName,
            lastName: credentials.lastName,
          },
        },
      });

      if (authError) {
        return { user: null, profile: null, error: authError };
      }

      if (!authData.user) {
        const error = new Error('No se pudo crear el usuario') as AuthError;
        return { user: null, profile: null, error };
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: credentials.email,
          role: credentials.role,
          first_name: credentials.firstName,
          last_name: credentials.lastName,
          status: 'active',
        })
        .select()
        .single();

      if (profileError) {
        await supabase.auth.admin.deleteUser(authData.user.id);
        return { user: null, profile: null, error: profileError.message };
      }

      return {
        user: authData.user,
        profile: profileData as UserProfile,
        error: null,
      };
    } catch (error) {
      const authError = new Error(
        error instanceof Error ? error.message : 'Error desconocido'
      ) as AuthError;
      return { user: null, profile: null, error: authError };
    }
  }

  static async login(credentials: LoginCredentials): Promise<{
    session: Session | null;
    user: User | null;
    error: AuthError | null;
  }> {
    try {
      const supabase = getBrowserClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        return { session: null, user: null, error };
      }

      if (data.user) {
        await supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', data.user.id);
      }

      return {
        session: data.session,
        user: data.user,
        error: null,
      };
    } catch (error) {
      const authError = new Error(
        error instanceof Error ? error.message : 'Error desconocido'
      ) as AuthError;
      return { session: null, user: null, error: authError };
    }
  }

  static async logout(): Promise<{ error: AuthError | null }> {
    try {
      const supabase = getBrowserClient();
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      const authError = new Error(
        error instanceof Error ? error.message : 'Error desconocido'
      ) as AuthError;
      return { error: authError };
    }
  }

  static async getSession(): Promise<{
    session: Session | null;
    error: AuthError | null;
  }> {
    try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase.auth.getSession();
      return { session: data.session, error };
    } catch (error) {
      const authError = new Error(
        error instanceof Error ? error.message : 'Error desconocido'
      ) as AuthError;
      return { session: null, error: authError };
    }
  }

  static async getCurrentUser(): Promise<{
    user: User | null;
    error: AuthError | null;
  }> {
    try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase.auth.getUser();
      return { user: data.user, error };
    } catch (error) {
      const authError = new Error(
        error instanceof Error ? error.message : 'Error desconocido'
      ) as AuthError;
      return { user: null, error: authError };
    }
  }

  static async getUserProfile(userId: string): Promise<{
    profile: UserProfile | null;
    error: any | null;
  }> {
    try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        return { profile: null, error };
      }

      return { profile: data as UserProfile, error: null };
    } catch (error) {
      return {
        profile: null,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async resendVerificationEmail(email: string): Promise<{
    error: AuthError | null;
  }> {
    try {
      const supabase = getBrowserClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      return { error };
    } catch (error) {
      const authError = new Error(
        error instanceof Error ? error.message : 'Error desconocido'
      ) as AuthError;
      return { error: authError };
    }
  }

  static async resetPassword(request: ResetPasswordRequest): Promise<{
    error: AuthError | null;
  }> {
    try {
      const supabase = getBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(
        request.email,
        {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
        }
      );

      return { error };
    } catch (error) {
      const authError = new Error(
        error instanceof Error ? error.message : 'Error desconocido'
      ) as AuthError;
      return { error: authError };
    }
  }

  static async updatePassword(request: UpdatePasswordRequest): Promise<{
    user: User | null;
    error: AuthError | null;
  }> {
    try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase.auth.updateUser({
        password: request.password,
      });

      return { user: data.user, error };
    } catch (error) {
      const authError = new Error(
        error instanceof Error ? error.message : 'Error desconocido'
      ) as AuthError;
      return { user: null, error: authError };
    }
  }

  static onAuthStateChange(
    callback: (session: Session | null, user: User | null) => void
  ) {
    const supabase = getBrowserClient();
    return supabase.auth.onAuthStateChange((event: any, session: Session | null) => {
      callback(session, session?.user || null);
    });
  }

  static async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<{
    profile: UserProfile | null;
    error: any | null;
  }> {
    try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId)
        .select()
        .single();

      if (error) {
        return { profile: null, error };
      }

      return { profile: data as UserProfile, error: null };
    } catch (error) {
      return {
        profile: null,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async verifyEmail(token: string): Promise<{
    session: Session | null;
    error: AuthError | null;
  }> {
    try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'email',
      });

      return { session: data.session, error };
    } catch (error) {
      const authError = new Error(
        error instanceof Error ? error.message : 'Error desconocido'
      ) as AuthError;
      return { session: null, error: authError };
    }
  }
}
