'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';
import {
  AuthSession,
  UserProfile,
  LoginCredentials,
  RegisterCredentials,
} from '@/types/auth';
import { SupabaseAuthService } from '@/lib/auth/supabase';
import { logger } from '@/lib/logger';
import { isDevMode } from '@/lib/env';

interface AuthContextType extends AuthSession {
  login: (credentials: LoginCredentials) => Promise<UserProfile>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  retrySession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const BOOT_TIMEOUT_MS = 12_000;
const PROFILE_TIMEOUT_MS = 8_000;

interface AuthProviderProps {
  children: ReactNode;
}

function emptySession(error: string | null = null): AuthSession {
  return {
    user: null,
    profile: null,
    isAuthenticated: false,
    isLoading: false,
    error,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authSession, setAuthSession] = useState<AuthSession>({
    user: null,
    profile: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const isLoggingInRef = useRef(false);
  const isLoggingOutRef = useRef(false);
  const mountedRef = useRef(true);

  const loadUserProfile = useCallback(async (source = '') => {
    if (isDevMode()) logger.debug(`[AuthContext] loadUserProfile${source ? ` (${source})` : ''}`);
    try {
      const { session } = await withTimeout(
        SupabaseAuthService.getSession(),
        5_000,
        'La sesión tardó demasiado en responder',
      );
      const token = session?.access_token;
      if (!token) return null;

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), PROFILE_TIMEOUT_MS);
      try {
        const response = await fetch('/api/profile', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) return null;
        const { profile } = await response.json();
        return profile as UserProfile | null;
      } finally {
        window.clearTimeout(timeoutId);
      }
    } catch (error) {
      logger.warn('[AuthContext] loadUserProfile error', error);
      return null;
    }
  }, []);

  const resolveSession = useCallback(async (): Promise<AuthSession> => {
    try {
      const { session, error } = await withTimeout(
        SupabaseAuthService.getSession(),
        6_000,
        'No fue posible validar la sesión',
      );
      if (error) throw error;
      if (!session?.user) return emptySession();

      const profile = await loadUserProfile('resolveSession');
      if (profile) {
        return {
          user: session.user,
          profile,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        };
      }

      return {
        user: session.user,
        profile: null,
        isAuthenticated: false,
        isLoading: false,
        error: session.user.email_confirmed_at
          ? 'No pudimos cargar tu perfil. Revisa la conexión e inténtalo nuevamente.'
          : null,
      };
    } catch (error) {
      return emptySession(error instanceof Error ? error.message : 'No fue posible iniciar la aplicación');
    }
  }, [loadUserProfile]);

  const retrySession = useCallback(async () => {
    setAuthSession((previous) => ({ ...previous, isLoading: true, error: null }));
    const next = await resolveSession();
    if (mountedRef.current) setAuthSession(next);
  }, [resolveSession]);

  useEffect(() => {
    mountedRef.current = true;
    const watchdog = window.setTimeout(() => {
      setAuthSession((previous) =>
        previous.isLoading
          ? emptySession('La aplicación tardó demasiado en iniciar. Recarga o vuelve a iniciar sesión.')
          : previous,
      );
    }, BOOT_TIMEOUT_MS);

    void resolveSession().then((next) => {
      if (mountedRef.current) setAuthSession(next);
    });

    const unsubscribe = SupabaseAuthService.onAuthStateChange((_session, user) => {
      window.setTimeout(() => {
        if (!mountedRef.current) return;
        if (isLoggingInRef.current) {
          isLoggingInRef.current = false;
          return;
        }
        if (isLoggingOutRef.current) return;

        if (_session && user) {
          void loadUserProfile('onAuthStateChange').then((profile) => {
            if (!mountedRef.current) return;
            setAuthSession((previous) => ({
              ...previous,
              user,
              profile: profile || previous.profile,
              isAuthenticated: Boolean(profile || previous.profile),
              isLoading: false,
              error: profile ? null : previous.error,
            }));
          });
        } else {
          setAuthSession((previous) =>
            previous.profile ? { ...previous, isLoading: false } : emptySession(),
          );
        }
      }, 0);
    });

    return () => {
      mountedRef.current = false;
      window.clearTimeout(watchdog);
      unsubscribe?.data?.subscription?.unsubscribe();
    };
  }, [loadUserProfile, resolveSession]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setAuthSession((previous) => ({ ...previous, isLoading: true, error: null }));
    isLoggingInRef.current = true;
    try {
      const { session, user, error } = await withTimeout(
        SupabaseAuthService.login(credentials),
        12_000,
        'El inicio de sesión tardó demasiado',
      );
      if (error) {
        const messages: Record<string, string> = {
          'Invalid login credentials': 'Credenciales incorrectas',
          'Email not confirmed': 'Email no confirmado. Revisa tu bandeja de entrada.',
          'User is suspended': 'Cuenta suspendida',
          'User is banned': 'Cuenta suspendida',
        };
        throw new Error(messages[error.message] || error.message);
      }
      if (!user || !session) throw new Error('Error inesperado al iniciar sesión');

      const profile = await loadUserProfile('login');
      if (!profile) throw new Error('No pudimos cargar tu perfil. Intenta nuevamente.');
      if (['inactive', 'suspended', 'banned'].includes(profile.status)) {
        throw new Error('Cuenta suspendida. Contacta a soporte.');
      }

      setAuthSession({ user, profile, isAuthenticated: true, isLoading: false, error: null });
      return profile;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible iniciar sesión';
      setAuthSession((previous) => ({ ...previous, isLoading: false, error: message }));
      throw new Error(message);
    } finally {
      isLoggingInRef.current = false;
    }
  }, [loadUserProfile]);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    logger.debug('[AuthContext] register', { email: credentials.email, role: credentials.role });
    setAuthSession((previous) => ({ ...previous, isLoading: true, error: null }));
    try {
      const { user, profile, error, requiresEmailConfirmation, message } = await withTimeout(
        SupabaseAuthService.register(credentials),
        15_000,
        'El registro tardó demasiado',
      );
      if (error) throw new Error(typeof error === 'string' ? error : error.message);
      if (requiresEmailConfirmation && user) {
        setAuthSession({ user, profile: null, isAuthenticated: false, isLoading: false, error: null });
        return;
      }
      if (user && profile) {
        setAuthSession({ user, profile, isAuthenticated: false, isLoading: false, error: null });
        return;
      }
      throw new Error(message || 'Registro incompleto');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible completar el registro';
      setAuthSession((previous) => ({ ...previous, isLoading: false, error: message }));
      throw new Error(message);
    }
  }, []);

  const logout = useCallback(async () => {
    logger.debug('[AuthContext] logout');
    isLoggingOutRef.current = true;
    setAuthSession((previous) => ({ ...previous, isLoading: true }));
    try {
      await withTimeout(SupabaseAuthService.logout(), 8_000, 'La sesión no pudo cerrarse a tiempo');
    } catch (error) {
      logger.warn('[AuthContext] logout error', error);
    } finally {
      setAuthSession(emptySession());
      window.setTimeout(() => {
        isLoggingOutRef.current = false;
      }, 700);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setAuthSession((previous) => ({ ...previous, error: null }));
    const { error } = await SupabaseAuthService.resetPassword({ email });
    if (error) {
      setAuthSession((previous) => ({ ...previous, error: error.message }));
      throw error;
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!authSession.user) throw new Error('No hay usuario autenticado');
    setAuthSession((previous) => ({ ...previous, isLoading: true, error: null }));
    try {
      const { session } = await SupabaseAuthService.getSession();
      const token = session?.access_token;
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), PROFILE_TIMEOUT_MS);
      try {
        const response = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(updates),
          signal: controller.signal,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${response.status}`);
        }
        const { profile } = await response.json();
        setAuthSession((previous) => ({ ...previous, profile, isLoading: false, error: null }));
      } finally {
        window.clearTimeout(timeoutId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el perfil';
      setAuthSession((previous) => ({ ...previous, isLoading: false, error: message }));
      throw new Error(message);
    }
  }, [authSession.user]);

  const resendVerificationEmail = useCallback(async () => {
    if (!authSession.user?.email) throw new Error('Email no disponible');
    await SupabaseAuthService.resendVerificationEmail(authSession.user.email);
  }, [authSession.user]);

  const value = useMemo(() => ({
    ...authSession,
    login,
    register,
    logout,
    resetPassword,
    updateProfile,
    resendVerificationEmail,
    retrySession,
  }), [authSession, login, register, logout, resetPassword, updateProfile, resendVerificationEmail, retrySession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth debe ser usado dentro de AuthProvider');
  return context;
}
