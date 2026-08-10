'use client';

import { createBrowserClient } from '@supabase/ssr';

import { supabaseAnonKey, supabaseUrl } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Browser client. Carries the anon key plus whatever session cookie the user
 * holds -- a broker's real session, or the anonymous session a guest picks up
 * when they redeem a tour link. Every request is still subject to RLS.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}
