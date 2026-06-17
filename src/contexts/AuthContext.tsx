// src/contexts/AuthContext.tsx
// Contexto de autenticación

'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { Session } from '@supabase/supabase-js';
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

  /**
   * Cargar perfil del usuario desde la base de datos
   */
  const loadUserProfile = useCallback(async (userId: string) => {
    try {
      const { profile, error } = await SupabaseAuthService.getUserProfile(userId);
      if (error) {
        throw error;
      }
      return profile;
    } catch (error) {
      console.error('Error cargando perfil:', error);
      return null;
    }
  }, []);

  /**
   * Inicializar sesión
   */
  const initializeSession = useCallback(async () => {
    try {
      setAuthSession((prev) => ({ ...prev, isLoading: true }));

      // Obtener sesión actual
      const { session, error } = await SupabaseAuthService.getSession();

      if (error) {
        throw error;
      }

      if (session && session.user) {
        // Cargar perfil del usuario
        const profile = await loadUserProfile(session.user.id);

        setAuthSession({
          user: session.user,
          profile,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        setAuthSession({
          user: null,
          profile: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    } catch (error) {
      console.error('Error inicializando sesión:', error);
      setAuthSession({
        user: null,
        profile: null,
        isAuthenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }, [loadUserProfile]);

  /**
   * Login
   */
  const login = useCallback(
    async (credentials: LoginCredentials) => {
      try {
        setAuthSession((prev) => ({ ...prev, isLoading: true, error: null }));

        const { session, user, error } = await SupabaseAuthService.login(credentials);

        if (error) {
          throw error;
        }

        if (user && session) {
          const profile = await loadUserProfile(user.id);

          setAuthSession({
            user,
            profile,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error en login';
        setAuthSession((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        throw error;
      }
    },
    [loadUserProfile]
  );

  /**
   * Register
   */
  const register = useCallback(
    async (credentials: RegisterCredentials) => {
      try {
        setAuthSession((prev) => ({ ...prev, isLoading: true, error: null }));

        const { user, profile, error } = await SupabaseAuthService.register(credentials);

        if (error) {
          throw error;
        }

        if (user && profile) {
          // No establecer como autenticado hasta que se verifique el email
          setAuthSession({
            user,
            profile,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error en registro';
        setAuthSession((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        throw error;
      }
    },
    []
  );

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    try {
      setAuthSession((prev) => ({ ...prev, isLoading: true }));

      const { error } = await SupabaseAuthService.logout();

      if (error) {
        throw error;
      }

      setAuthSession({
        user: null,
        profile: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error en logout:', error);
      setAuthSession((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Error en logout',
      }));
    }
  }, []);

  /**
   * Reset password
   */
  const resetPassword = useCallback(async (email: string) => {
    try {
      setAuthSession((prev) => ({ ...prev, error: null }));

      const { error } = await SupabaseAuthService.resetPassword({ email });

      if (error) {
        throw error;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al resetear contraseña';
      setAuthSession((prev) => ({
        ...prev,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  /**
   * Update profile
   */
  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      try {
        if (!authSession.user) {
          throw new Error('No hay usuario autenticado');
        }

        setAuthSession((prev) => ({ ...prev, isLoading: true, error: null }));

        const { profile, error } = await SupabaseAuthService.updateUserProfile(
          authSession.user.id,
          updates
        );

        if (error) {
          throw error;
        }

        setAuthSession({
          user: authSession.user,
          profile,
          isAuthenticated: authSession.isAuthenticated,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error actualizando perfil';
        setAuthSession((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        throw error;
      }
    },
    [authSession.user, authSession.isAuthenticated]
  );

  /**
   * Reenviar email de verificación
   */
  const resendVerificationEmail = useCallback(async () => {
    try {
      if (!authSession.user?.email) {
        throw new Error('Email no disponible');
      }

      const { error } = await SupabaseAuthService.resendVerificationEmail(
        authSession.user.email
      );

      if (error) {
        throw error;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error enviando email';
      throw error;
    }
  }, [authSession.user]);

  /**
   * Suscribirse a cambios de autenticación
   */
  useEffect(() => {
    // Inicializar sesión
    initializeSession();

    // Suscribirse a cambios
    const unsubscribe = SupabaseAuthService.onAuthStateChange(
      async (session, user) => {
        if (session && user) {
          const profile = await loadUserProfile(user.id);
          setAuthSession({
            user,
            profile,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } else {
          setAuthSession({
            user: null,
            profile: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      }
    );

    return () => {
      unsubscribe?.data?.subscription?.unsubscribe();
    };
  }, [initializeSession, loadUserProfile]);

  const value: AuthContextType = {
    ...authSession,
    login,
    register,
    logout,
    resetPassword,
    updateProfile,
    resendVerificationEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook para usar el contexto de autenticación
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
}
