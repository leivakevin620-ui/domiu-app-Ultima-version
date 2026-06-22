import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * La autenticación de UI se valida en layouts cliente porque Supabase
 * Auth se maneja en cliente (localStorage + Bearer token).
 * El proxy no debe bloquear rutas UI usando cookies SSR para evitar
 * mismatch entre client auth y SSR cookies.
 *
 * Las rutas /api/* ya validan su propio Bearer token internamente.
 *
 * Este proxy solo:
 *   1. Permite assets estáticos y archivos internos de Next.js
 *   2. Si Supabase no está configurado, redirige a /login como fallback
 *   3. Si hay sesión SSR por cookies, agrega headers x-user-* (opcional)
 *   4. Nunca bloquea rutas UI protegidas
 */

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

  // If Supabase not configured, redirect protected UI routes to /login
  if (!supabaseUrl || !supabaseKey) {
    if (!isPublicRoute(pathname) && !pathname.startsWith('/api')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // ── Intenta leer sesión SSR (cookies) para agregar headers informativos ──
  // Si no hay sesión, NO bloquea — los layouts cliente manejan la auth.
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll() { /* no-op: no modificamos cookies desde proxy */ },
    },
  });

  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', session.user.id);
    requestHeaders.set('x-user-email', session.user.email || '');

    if (pathname.startsWith('/api')) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Sin sesión SSR — permitir que el cliente maneje la autenticación
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
