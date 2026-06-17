// middleware.ts
// Middleware global de protección de rutas

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PermissionManager } from '@/lib/auth/permissions';

// Rutas públicas que no requieren autenticación
const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password'];

// Rutas protegidas y sus roles requeridos
const PROTECTED_ROUTES: { [key: string]: string[] } = {
  '/admin': ['admin'],
  '/negocio': ['merchant'],
  '/cliente': ['customer'],
  '/repartidor': ['courier'],
};

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  try {
    // Crear cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    // Obtener sesión actual
    const { data, error } = await supabase.auth.getSession();
    const session = data?.session;

    const pathname = request.nextUrl.pathname;

    // 1. Si no hay sesión
    if (!session) {
      // Redirigir rutas protegidas al login
      if (PermissionManager.isProtectedRoute(pathname)) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
      // Permitir rutas públicas
      return response;
    }

    // 2. Si hay sesión, obtener el perfil del usuario
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    const userRole = profileData?.role;

    // 3. Validar que el usuario tenga un rol
    if (!userRole) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // 4. Validar acceso a la ruta según el rol
    const permission = PermissionManager.canAccessRoute(userRole, pathname);

    if (!permission.isAllowed) {
      // Redirigir al dashboard del rol del usuario
      const dashboard = PermissionManager.getDashboardRoute(userRole);
      return NextResponse.redirect(new URL(dashboard, request.url));
    }

    // 5. Agregar información del usuario a los headers para acceso en componentes
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', session.user.id);
    requestHeaders.set('x-user-role', userRole);
    requestHeaders.set('x-user-email', session.user.email || '');

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    console.error('Middleware error:', error);
    // En caso de error, permitir continuar (mejor fallback)
    return response;
  }
}

// Configurar en qué rutas aplicar el middleware
export const config = {
  matcher: [
    /*
     * Aplicar a todas las rutas excepto:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico (favicon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
