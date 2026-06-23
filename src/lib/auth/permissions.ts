// src/lib/auth/permissions.ts
// Sistema de permisos y validación de roles

import {
  UserRole,
  ROLE_PERMISSIONS,
  ROLE_ROUTES,
  PermissionCheckResult,
  PUBLIC_ROUTES,
  PROTECTED_ROUTES,
  ADMIN_ROLES,
} from '@/types/auth';

export class PermissionManager {
  /**
   * Verificar si un usuario tiene una permisión específica
   */
  static hasPermission(role: UserRole, permission: string): boolean {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];

    // Admin tiene acceso a todo
    if (rolePermissions.includes('*')) {
      return true;
    }

    return rolePermissions.includes(permission);
  }

  /**
   * Verificar si un usuario puede acceder a una ruta
   */
  static canAccessRoute(role: UserRole, pathname: string): PermissionCheckResult {
    // Rutas públicas: accesible para todos
    if (PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route))) {
      return { isAllowed: true };
    }

    const adminRoles: UserRole[] = ADMIN_ROLES;
    const businessRoles: UserRole[] = ['business', 'merchant'];

    if (pathname.startsWith('/admin')) {
      if (!adminRoles.includes(role)) {
        return {
          isAllowed: false,
          reason: 'Solo administradores pueden acceder al panel de administración',
        };
      }
      return { isAllowed: true };
    }

    if (pathname.startsWith('/negocio')) {
      if (!businessRoles.includes(role)) {
        return {
          isAllowed: false,
          reason: 'Solo comerciantes pueden acceder al panel de negocio',
        };
      }
      return { isAllowed: true };
    }

    if (pathname.startsWith('/cliente')) {
      if (role !== 'customer') {
        return {
          isAllowed: false,
          reason: 'Solo clientes pueden acceder a esta sección',
        };
      }
      return { isAllowed: true };
    }

    if (pathname.startsWith('/repartidor')) {
      if (role !== 'courier') {
        return {
          isAllowed: false,
          reason: 'Solo repartidores pueden acceder a esta sección',
        };
      }
      return { isAllowed: true };
    }

    // Si llega aquí, es una ruta desconocida
    return {
      isAllowed: false,
      reason: 'Ruta no encontrada o no autorizada',
    };
  }

  /**
   * Obtener la ruta principal del dashboard del usuario según su rol
   */
  static getDashboardRoute(role: UserRole): string {
    if (ADMIN_ROLES.includes(role)) {
      return '/admin';
    }
    if (['business', 'merchant'].includes(role)) {
      return '/negocio';
    }
    if (role === 'customer') return '/cliente';
    if (role === 'courier') return '/repartidor';
    return '/';
  }

  /**
   * Verificar si una ruta es pública
   */
  static isPublicRoute(pathname: string): boolean {
    return PUBLIC_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + '/')
    );
  }

  /**
   * Verificar si una ruta es protegida
   */
  static isProtectedRoute(pathname: string): boolean {
    return PROTECTED_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + '/')
    );
  }

  /**
   * Validar que un usuario solo acceda a rutas permitidas
   */
  static validateRouteAccess(role: UserRole | null, pathname: string): boolean {
    // Si no hay rol, solo puede acceder a rutas públicas
    if (!role) {
      return this.isPublicRoute(pathname);
    }

    // Validar acceso según permiso
    const permission = this.canAccessRoute(role, pathname);
    return permission.isAllowed;
  }

  /**
   * Obtener todas las rutas permitidas para un rol
   */
  static getAllowedRoutes(role: UserRole): string[] {
    return [
      ...PUBLIC_ROUTES,
      ...(ROLE_ROUTES[role] || []),
    ];
  }

  /**
   * Verificar si el usuario puede cambiar su rol
   */
  static canChangeRole(currentRole: UserRole, _targetRole: UserRole): boolean { // eslint-disable-line @typescript-eslint/no-unused-vars
    return currentRole === 'super_admin' || currentRole === 'admin_general';
  }

  /**
   * Validar múltiples permisos (todos deben ser true)
   */
  static hasAllPermissions(role: UserRole, permissions: string[]): boolean {
    return permissions.every((permission) =>
      this.hasPermission(role, permission)
    );
  }

  /**
   * Validar al menos un permiso
   */
  static hasAnyPermission(role: UserRole, permissions: string[]): boolean {
    return permissions.some((permission) =>
      this.hasPermission(role, permission)
    );
  }
}
