'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
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

interface AuthContextType extends AuthSession {
  login: (credentials: LoginCredentials) => Promise<void>;
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

  const loadUserProfile = useCallback(async () => {
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
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const { session, error } = await SupabaseAuthService.getSession();
        if (error) throw error;
        if (session?.user) {
          const profile = await loadUserProfile();
          if (profile) {
            return { user: session.user, profile, isAuthenticated: true, isLoading: false, error: null } as AuthSession;
          } else if (session.user.email_confirmed_at) {
            await SupabaseAuthService.logout();
            return { user: null, profile: null, isAuthenticated: false, isLoading: false, error: 'Sesión inválida' } as AuthSession;
          } else {
            return { user: null, profile: null, isAuthenticated: false, isLoading: false, error: null } as AuthSession;
          }
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
      if (_session && user) {
        const profile = await loadUserProfile();
        setAuthSession({
          user, profile: profile || null, isAuthenticated: !!profile, isLoading: false, error: null,
        });
      } else {
        setAuthSession({ user: null, profile: null, isAuthenticated: false, isLoading: false, error: null });
      }
    });
    return () => { unsubscribe?.data?.subscription?.unsubscribe(); };
  }, [loadUserProfile]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setAuthSession(prev => ({ ...prev, isLoading: true, error: null }));
    const { session, user, error } = await SupabaseAuthService.login(credentials);
    if (error) { setAuthSession(prev => ({ ...prev, isLoading: false, error: error.message })); throw error; }
    if (user && session) {
      const profile = await loadUserProfile();
      if (!profile) { setAuthSession(prev => ({ ...prev, isLoading: false, error: 'No se pudo cargar tu perfil' })); throw new Error('Perfil no encontrado'); }
      setAuthSession({ user, profile, isAuthenticated: true, isLoading: false, error: null });
    }
  }, [loadUserProfile]);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    setAuthSession(prev => ({ ...prev, isLoading: true, error: null }));
    const { user, profile, error } = await SupabaseAuthService.register(credentials);
    if (error) { const msg = typeof error === 'string' ? error : error.message; setAuthSession(prev => ({ ...prev, isLoading: false, error: msg })); throw new Error(msg); }
    if (user && profile) {
      setAuthSession({ user, profile, isAuthenticated: false, isLoading: false, error: null });
    } else {
      setAuthSession(prev => ({ ...prev, isLoading: false })); throw new Error('Registro incompleto');
    }
  }, []);

  const logout = useCallback(async () => {
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
