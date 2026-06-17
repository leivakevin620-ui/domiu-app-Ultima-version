// src/components/auth/ProtectedRoute.tsx
// Componente para proteger rutas

'use client';

import React, { ReactNode } from 'react';
import { useAuthProtection } from '@/hooks/useAuthProtection';
import { UserRole } from '@/types/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  requiredPermissions?: string[];
  fallback?: ReactNode;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  requiredPermissions,
  fallback,
}: ProtectedRouteProps) {
  const { isLoading, canAccess } = useAuthProtection({
    allowedRoles,
    requiredPermissions,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Acceso Denegado</h1>
            <p className="text-gray-600">No tienes permiso para acceder a esta página.</p>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}

/**
 * Componente para mostrar contenido solo si el usuario tiene un rol específico
 */
interface RoleBasedProps {
  children: ReactNode;
  roles: UserRole | UserRole[];
  fallback?: ReactNode;
}

export function RoleBased({ children, roles, fallback }: RoleBasedProps) {
  const { profile, isLoading } = useAuthProtection();

  if (isLoading) {
    return null;
  }

  if (!profile) {
    return <>{fallback}</>;
  }

  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  if (!allowedRoles.includes(profile.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Componente para mostrar contenido solo si el usuario tiene un permiso
 */
interface PermissionBasedProps {
  children: ReactNode;
  permission: string | string[];
  fallback?: ReactNode;
}

export function PermissionBased({
  children,
  permission,
  fallback,
}: PermissionBasedProps) {
  const { profile, isLoading } = useAuthProtection();

  if (isLoading) {
    return null;
  }

  if (!profile) {
    return <>{fallback}</>;
  }

  const permissions = Array.isArray(permission) ? permission : [permission];
  
  // Importar aquí para evitar circular dependency
  const { PermissionManager } = require('@/lib/auth/permissions');
  const hasPermission = PermissionManager.hasAnyPermission(profile.role, permissions);

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Componente para formulario de login
 */
interface AuthGuardProps {
  children: ReactNode;
  requireAuth?: boolean;
}

export function AuthGuard({ children, requireAuth = true }: AuthGuardProps) {
  const { isLoading, isAuthenticated } = useAuthProtection();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Cargando...</p>
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) {
    return null;
  }

  if (!requireAuth && isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
