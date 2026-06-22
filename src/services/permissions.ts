// src/services/permissions.ts
// RBAC permission checking service

'use client';

import type { AdminRole, Permission } from '@/types/admin';
import { ADMIN_ROLE_PERMISSIONS, SUPER_ADMIN_EMAIL } from '@/types/admin';

export const permissionsService = {
  hasPermission(role: string | null, permission: Permission, email?: string): boolean {
    if (email === SUPER_ADMIN_EMAIL) return true;
    if (!role) return false;
    const perms = ADMIN_ROLE_PERMISSIONS[role as AdminRole];
    if (!perms) return false;
    if (perms.includes('*' as unknown as Permission)) return true;
    return perms.includes(permission);
  },

  hasAnyPermission(role: AdminRole | null, permissions: Permission[], email?: string): boolean {
    return permissions.some((p) => this.hasPermission(role, p, email));
  },

  hasAllPermissions(role: AdminRole | null, permissions: Permission[], email?: string): boolean {
    return permissions.every((p) => this.hasPermission(role, p, email));
  },

  getPermissions(role: string | null): Permission[] {
    if (!role) return [];
    return ADMIN_ROLE_PERMISSIONS[role as AdminRole] || [];
  },

  can(required: Permission): (role: AdminRole | null, email?: string) => boolean {
    return (role, email) => this.hasPermission(role, required, email);
  },
};
