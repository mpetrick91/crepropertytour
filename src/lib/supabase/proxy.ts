import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { supabaseAnonKey, supabaseUrl } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Paths a signed-out visitor may reach. Everything else redirects to /login.
 *
 * `/app` is the browser build of the mobile app and `/app-config.js` is the
 * config it loads first: both must stay reachable while signed out, because
 * the app does its own sign-in inside that page.
 */
const PUBLIC_PREFIXES = ['/login', '/auth', '/t/', '/app', '/app-config.js'];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix),
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Do not put anything between the client creation and getUser(): this call is
  // what refreshes an expiring token and writes the rotated cookie onto the
  // response. Skipping it logs users out at random.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // A guest holds an anonymous session. That is enough to walk a tour they have
  // joined, but it is not an account, so it must not open the broker app.
  const isBroker = Boolean(user) && !user?.is_anonymous;

  if (!isBroker && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (isBroker && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
