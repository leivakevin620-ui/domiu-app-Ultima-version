// src/hooks/useAuthProtection.ts
// Hook para proteger componentes según roles

'use client';

import { useAuth } from '@/contexts/AuthContext';
import { PermissionManager } from '@/lib/auth/permissions';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { UserRole } from '@/types/auth';

interface UseAuthProtectionOptions {
  allowedRoles?: UserRole[];
  requiredPermissions?: string[];
  redirectTo?: string;
}

export function useAuthProtection(options: UseAuthProtectionOptions = {}) {
  const { profile, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const {
    allowedRoles = [],
    requiredPermissions = [],
    redirectTo = '/login',
  } = options;

  useEffect(() => {
    if (isLoading) return;

    // Verificar autenticación
    if (!profile) {
      router.push(redirectTo);
      return;
    }

    // Verificar rol si se especifica
    if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
      const dashboard = PermissionManager.getDashboardRoute(profile.role);
      router.push(dashboard);
      return;
    }

    // Verificar permisos si se especifican
    if (requiredPermissions.length > 0) {
      const hasPermission = PermissionManager.hasAllPermissions(
        profile.role,
        requiredPermissions
      );

      if (!hasPermission) {
        const dashboard = PermissionManager.getDashboardRoute(profile.role);
        router.push(dashboard);
        return;
      }
    }

    // Validar acceso a la ruta actual
    const canAccess = PermissionManager.canAccessRoute(profile.role, pathname);
    if (!canAccess.isAllowed) {
      const dashboard = PermissionManager.getDashboardRoute(profile.role);
      router.push(dashboard);
    }
  }, [profile, isLoading, allowedRoles, requiredPermissions, redirectTo, router, pathname]);

  return {
    isLoading,
    isAuthenticated: !!profile,
    profile,
    canAccess: !isLoading && !!profile,
  };
}

/**
 * Hook para verificar si el usuario tiene un rol específico
 */
export function useRoleCheck(requiredRole: UserRole | UserRole[]) {
  const { profile } = useAuth();

  if (!profile) {
    return false;
  }

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return roles.includes(profile.role);
}

/**
 * Hook para verificar permisos específicos
 */
export function usePermission(permission: string | string[]) {
  const { profile } = useAuth();

  if (!profile) {
    return false;
  }

  const permissions = Array.isArray(permission) ? permission : [permission];
  return PermissionManager.hasAnyPermission(profile.role, permissions);
}

/**
 * Hook para obtener el dashboard route del usuario
 */
export function useDashboardRoute() {
  const { profile } = useAuth();

  if (!profile) {
    return '/';
  }

  return PermissionManager.getDashboardRoute(profile.role);
}

/**
 * Hook para obtener todas las rutas permitidas
 */
export function useAllowedRoutes() {
  const { profile } = useAuth();

  if (!profile) {
    return ['/'];
  }

  return PermissionManager.getAllowedRoutes(profile.role);
}

/**
 * Hook para validar acceso a ruta específica
 */
export function useCanAccessRoute(pathname: string) {
  const { profile } = useAuth();

  if (!profile) {
    return PermissionManager.isPublicRoute(pathname);
  }

  return PermissionManager.canAccessRoute(profile.role, pathname).isAllowed;
}
