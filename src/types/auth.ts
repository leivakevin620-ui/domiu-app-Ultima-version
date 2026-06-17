// src/types/auth.ts
// Tipos de autenticación y roles

export type UserRole = 'admin' | 'merchant' | 'customer' | 'courier';
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
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: UserStatus;
  avatar_url: string | null;
  verified_at: string | null;
  phone_verified_at: string | null;
  email_verified_at: string | null;
  last_login_at: string | null;
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
  admin: ['*'], // Admin tiene acceso a todo
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
};

export const ROLE_ROUTES: { [key in UserRole]: string[] } = {
  admin: ['/admin'],
  merchant: ['/negocio'],
  customer: ['/cliente'],
  courier: ['/repartidor'],
};

export const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password'];

export const PROTECTED_ROUTES = ['/cliente', '/negocio', '/repartidor', '/admin'];
