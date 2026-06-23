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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
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

  const loadUserProfile = useCallback(async (source = '') => {
    if (isDevMode()) logger.debug(`[AuthContext] loadUserProfile${source ? ` (${source})` : ''}`);
    try {
      const { session } = await SupabaseAuthService.getSession();
      const token = session?.access_token;
      if (!token) return null;
      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const { profile } = await res.json();
      return profile;
    } catch (err) {
      logger.warn('[AuthContext] loadUserProfile error', err);
      return null;
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const { session, error } = await SupabaseAuthService.getSession();
        if (error) throw error;
        if (session?.user) {
          const profile = await loadUserProfile('init');
          if (profile) {
            return { user: session.user, profile, isAuthenticated: true, isLoading: false, error: null } as AuthSession;
          }
          return {
            user: session.user,
            profile: null,
            isAuthenticated: false,
            isLoading: false,
            error: session.user.email_confirmed_at ? 'Perfil no encontrado. Contacta a soporte.' : null,
          } as AuthSession;
        } else {
          return { user: null, profile: null, isAuthenticated: false, isLoading: false, error: null } as AuthSession;
        }
      } catch (error) {
        return {
          user: null, profile: null, isAuthenticated: false, isLoading: false,
          error: error instanceof Error ? error.message : 'Error desconocido',
        } as AuthSession;
      }
    };
    init().then(setAuthSession);
    const unsubscribe = SupabaseAuthService.onAuthStateChange(async (_session, user) => {
      if (isLoggingInRef.current) {
        isLoggingInRef.current = false;
        return;
      }
      if (_session && user) {
        const profile = await loadUserProfile('onAuthStateChange');
        setAuthSession(prev => ({
          ...prev,
          user,
          profile: profile || prev.profile,
          isAuthenticated: profile ? true : prev.isAuthenticated,
          isLoading: false,
          error: profile ? null : prev.error,
        }));
      } else {
        setAuthSession(prev => prev.profile
          ? { ...prev, isLoading: false }
          : { user: null, profile: null, isAuthenticated: false, isLoading: false, error: null }
        );
      }
    });
    return () => { unsubscribe?.data?.subscription?.unsubscribe(); };
  }, [loadUserProfile]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setAuthSession(prev => ({ ...prev, isLoading: true, error: null }));
    isLoggingInRef.current = true;
    try {
      const { session, user, error } = await SupabaseAuthService.login(credentials);
      if (error) {
        const messages: Record<string, string> = {
          'Invalid login credentials': 'Credenciales incorrectas',
          'Email not confirmed': 'Email no confirmado. Revisa tu bandeja de entrada.',
          'User is suspended': 'Cuenta suspendida',
          'User is banned': 'Cuenta suspendida',
        };
        const friendly = messages[error.message] || error.message;
        setAuthSession(prev => ({ ...prev, isLoading: false, error: friendly }));
        throw new Error(friendly);
      }
      if (user && session) {
        const profile = await loadUserProfile('login');
        if (!profile) {
          setAuthSession(prev => ({ ...prev, isLoading: false, error: 'Perfil no encontrado. Contacta a soporte.' }));
          throw new Error('Perfil no encontrado');
        }
        if (profile.status === 'inactive' || profile.status === 'suspended' || profile.status === 'banned') {
          setAuthSession(prev => ({ ...prev, isLoading: false, error: 'Cuenta suspendida. Contacta a soporte.' }));
          throw new Error('Cuenta suspendida');
        }
        setAuthSession({ user, profile, isAuthenticated: true, isLoading: false, error: null });
        return profile;
      }
      throw new Error('Error inesperado al iniciar sesión');
    } finally {
      isLoggingInRef.current = false;
    }
  }, [loadUserProfile]);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    logger.debug('[AuthContext] register', { email: credentials.email, role: credentials.role });
    setAuthSession(prev => ({ ...prev, isLoading: true, error: null }));
    const { user, profile, error, requiresEmailConfirmation, message } = await SupabaseAuthService.register(credentials);
    if (error) {
      const msg = typeof error === 'string' ? error : error.message;
      setAuthSession(prev => ({ ...prev, isLoading: false, error: msg }));
      throw new Error(msg);
    }
    if (requiresEmailConfirmation && user) {
      setAuthSession({ user, profile: null, isAuthenticated: false, isLoading: false, error: null });
      return;
    }
    if (user && profile) {
      setAuthSession({ user, profile, isAuthenticated: false, isLoading: false, error: null });
      return;
    }
    setAuthSession(prev => ({ ...prev, isLoading: false }));
    throw new Error(message || 'Registro incompleto');
  }, []);

  const logout = useCallback(async () => {
    logger.debug('[AuthContext] logout');
    setAuthSession(prev => ({ ...prev, isLoading: true }));
    await SupabaseAuthService.logout();
    setAuthSession({ user: null, profile: null, isAuthenticated: false, isLoading: false, error: null });
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setAuthSession(prev => ({ ...prev, error: null }));
    const { error } = await SupabaseAuthService.resetPassword({ email });
    if (error) { setAuthSession(prev => ({ ...prev, error: error.message })); throw error; }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!authSession.user) throw new Error('No hay usuario autenticado');
    setAuthSession(prev => ({ ...prev, isLoading: true, error: null }));
    const { session } = await SupabaseAuthService.getSession();
    const token = session?.access_token;
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(updates),
    });
    if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || `HTTP ${res.status}`); }
    const { profile } = await res.json();
    setAuthSession(prev => ({ ...prev, profile, isLoading: false, error: null }));
  }, [authSession.user]);

  const resendVerificationEmail = useCallback(async () => {
    if (!authSession.user?.email) throw new Error('Email no disponible');
    await SupabaseAuthService.resendVerificationEmail(authSession.user.email);
  }, [authSession.user]);

  const value = useMemo(() => ({
    ...authSession, login, register, logout, resetPassword, updateProfile, resendVerificationEmail,
  }), [authSession, login, register, logout, resetPassword, updateProfile, resendVerificationEmail]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth debe ser usado dentro de AuthProvider');
  return context;
}
