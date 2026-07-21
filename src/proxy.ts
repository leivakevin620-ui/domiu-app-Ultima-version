import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/auth/reset-password'];
const INTERNAL_IDENTITY_HEADERS = ['x-user-id', 'x-user-email'];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'));
}

function isStaticAsset(pathname: string): boolean {
  return /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/.test(pathname);
}

function isBrokenRefreshToken(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return error.code === 'refresh_token_not_found' || message.includes('invalid refresh token');
}

function sanitizedHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  for (const name of INTERNAL_IDENTITY_HEADERS) headers.delete(name);
  return headers;
}

function nextWithHeaders(headers: Headers) {
  return NextResponse.next({ request: { headers } });
}

function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse): void {
  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.startsWith('sb-') || !cookie.name.includes('auth-token')) continue;
    response.cookies.set(cookie.name, '', {
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
    });
  }
}

function redirectToLogin(request: NextRequest, reason?: string): NextResponse {
  const loginUrl = new URL('/login', request.url);
  if (reason) loginUrl.searchParams.set('error', reason);
  if (request.nextUrl.pathname !== '/') {
    loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  }
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname === '/favicon.ico' || isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const cleanHeaders = sanitizedHeaders(request);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    if (!isPublicRoute(pathname) && !pathname.startsWith('/api')) {
      return redirectToLogin(request, 'configuration');
    }
    return nextWithHeaders(cleanHeaders);
  }

  let response = nextWithHeaders(cleanHeaders);

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = nextWithHeaders(cleanHeaders);

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, {
            ...options,
            secure: process.env.NODE_ENV === 'production' ? true : options.secure,
            httpOnly: true,
            sameSite: options.sameSite || 'lax',
          });
        }
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (isBrokenRefreshToken(authError)) {
    const cleanResponse = !isPublicRoute(pathname) && !pathname.startsWith('/api')
      ? redirectToLogin(request, 'session_expired')
      : response;
    clearSupabaseAuthCookies(request, cleanResponse);
    return cleanResponse;
  }

  if (!user) {
    if (!isPublicRoute(pathname) && !pathname.startsWith('/api')) {
      return redirectToLogin(request);
    }
    return response;
  }

  const authenticatedHeaders = new Headers(cleanHeaders);
  authenticatedHeaders.set('x-user-id', user.id);
  authenticatedHeaders.set('x-user-email', user.email || '');

  const authenticatedResponse = nextWithHeaders(authenticatedHeaders);
  for (const cookie of response.cookies.getAll()) {
    authenticatedResponse.cookies.set(cookie);
  }

  return authenticatedResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
