import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { PermissionManager } from '@/lib/auth/permissions';

export async function proxy(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      const pathname = request.nextUrl.pathname;
      if (PermissionManager.isProtectedRoute(pathname)) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
      return NextResponse.next({ request });
    }

    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    });

    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    const pathname = request.nextUrl.pathname;

    if (!session) {
      if (PermissionManager.isProtectedRoute(pathname)) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
      return supabaseResponse;
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', session.user.id);
    requestHeaders.set('x-user-email', session.user.email || '');

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    const pathname = request.nextUrl.pathname;
    if (PermissionManager.isProtectedRoute(pathname)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
