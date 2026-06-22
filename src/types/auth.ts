// src/types/auth.ts
// Tipos de autenticación y roles

export type UserRole = 'super_admin' | 'admin_general' | 'admin_financiero' | 'admin_operativo' | 'admin_comercial' | 'admin_soporte' | 'admin' | 'business' | 'merchant' | 'courier' | 'customer' | 'guest';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'banned';

export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: {
    firstName?: string;
    lastName?: string;
    avatar_url?: string;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  admin_role: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: UserStatus;
  avatar_url: string | null;
  verified_at: string | null;
  phone_verified_at: string | null;
  email_verified_at: string | null;
  last_login_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  user: AuthUser | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface UpdatePasswordRequest {
  password: string;
  token: string;
}

export interface PermissionCheckResult {
  isAllowed: boolean;
  reason?: string;
}

export interface RolePermissions {
  [key: string]: string[];
}

export const ROLE_PERMISSIONS: RolePermissions = {
  super_admin: ['*'],
  admin_general: ['*'],
  admin_financiero: ['view_orders', 'view_wallets', 'manage_payments', 'view_analytics'],
  admin_operativo: ['view_orders', 'manage_orders', 'view_businesses', 'view_deliveries', 'manage_couriers'],
  admin_comercial: ['view_businesses', 'manage_promotions', 'view_analytics', 'manage_categories'],
  admin_soporte: ['view_orders', 'view_users', 'manage_disputes', 'chat'],
  admin: ['*'],
  business: [
    'view_business',
    'manage_products',
    'manage_orders',
    'view_analytics',
    'manage_deliveries',
  ],
  merchant: [
    'view_business',
    'manage_products',
    'manage_orders',
    'view_analytics',
    'manage_deliveries',
  ],
  customer: [
    'view_products',
    'place_order',
    'view_orders',
    'rate_merchant',
    'rate_product',
    'chat',
  ],
  courier: [
    'view_deliveries',
    'update_location',
    'confirm_delivery',
    'view_earnings',
    'chat',
  ],
  guest: ['view_products'],
};

export const ROLE_ROUTES: { [key in UserRole]: string[] } = {
  super_admin: ['/admin'],
  admin_general: ['/admin'],
  admin_financiero: ['/admin'],
  admin_operativo: ['/admin'],
  admin_comercial: ['/admin'],
  admin_soporte: ['/admin'],
  admin: ['/admin'],
  business: ['/negocio'],
  merchant: ['/negocio'],
  customer: ['/cliente'],
  courier: ['/repartidor'],
  guest: [],
};

export const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/auth/reset-password'];

export const PROTECTED_ROUTES = ['/cliente', '/negocio', '/repartidor', '/admin'];

export const ADMIN_ROLES: UserRole[] = ['super_admin', 'admin_general', 'admin_financiero', 'admin_operativo', 'admin_comercial', 'admin_soporte', 'admin'];

export const BUSINESS_ROLES: UserRole[] = ['business', 'merchant'];

export const DASHBOARD_ROUTES: Record<string, string> = {
  customer: '/cliente',
  merchant: '/negocio',
  business: '/negocio',
  courier: '/repartidor',
};

export function getDashboardPathForRole(role: UserRole): string {
  if (ADMIN_ROLES.includes(role)) return '/admin';
  return DASHBOARD_ROUTES[role] || '/cliente';
}

export function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role as UserRole);
}

export function isBusinessRole(role: string): boolean {
  return BUSINESS_ROLES.includes(role as UserRole);
}
