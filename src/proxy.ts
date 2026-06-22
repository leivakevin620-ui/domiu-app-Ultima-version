import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { type UserRole } from '@/types/auth';

const ADMIN_ROLES: UserRole[] = ['super_admin', 'admin_general', 'admin_financiero', 'admin_operativo', 'admin_comercial', 'admin_soporte'];
const BUSINESS_ROLES: UserRole[] = ['business', 'merchant'];
const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/auth/reset-password'];
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'));
}

function isStaticAsset(pathname: string): boolean {
  return /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/.test(pathname);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static assets and Next.js internals
  if (pathname.startsWith('/_next') || pathname === '/favicon.ico' || isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase not configured, redirect all protected routes to /login
  if (!supabaseUrl || !supabaseKey) {
    if (!isPublicRoute(pathname) && !pathname.startsWith('/api')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data: { session } } = await supabase.auth.getSession();

  // No session
  if (!session) {
    // Allow public routes
    if (isPublicRoute(pathname)) {
      return NextResponse.next();
    }

    // Allow API routes with proper auth (they handle their own auth)
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Se requiere autenticación' },
        { status: 401 }
      );
    }

    // Redirect all protected routes to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // User is authenticated - get profile role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  const role: UserRole | null = profile?.role || null;

  // Set user info headers for downstream
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', session.user.id);
  requestHeaders.set('x-user-email', session.user.email || '');
  if (role) {
    requestHeaders.set('x-user-role', role);
  }

  // Route-based access control
  if (pathname.startsWith('/admin')) {
    if (!role || !ADMIN_ROLES.includes(role)) {
      const redirectUrl = role && BUSINESS_ROLES.includes(role)
        ? '/negocio'
        : role === 'courier'
          ? '/repartidor'
          : role === 'customer'
            ? '/cliente'
            : '/?error=unauthorized';
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
  }

  if (pathname.startsWith('/negocio')) {
    if (!role || !BUSINESS_ROLES.includes(role)) {
      return NextResponse.redirect(new URL('/?error=unauthorized', request.url));
    }
  }

  if (pathname.startsWith('/repartidor')) {
    if (role !== 'courier') {
      return NextResponse.redirect(new URL('/?error=unauthorized', request.url));
    }
  }

  if (pathname.startsWith('/cliente')) {
    if (role !== 'customer') {
      return NextResponse.redirect(new URL('/?error=unauthorized', request.url));
    }
  }

  // Allow API routes for authenticated users
  if (pathname.startsWith('/api')) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
