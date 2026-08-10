import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { supabaseAnonKey, supabaseUrl } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Server client for Server Components, Route Handlers and Server Actions.
 * Reads and refreshes the session from cookies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. The middleware refreshes the
          // session on every request, so it is safe to swallow this here.
        }
      },
    },
  });
}

/**
 * The signed-in broker, or null. Uses getUser() rather than getSession()
 * because only getUser() revalidates the token against the auth server --
 * the session cookie itself is attacker-controllable.
 *
 * Anonymous (guest) users are deliberately not brokers: they are filtered out
 * so a guest session can never be mistaken for an account.
 */
export async function getBroker() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) return null;
  return user;
}
