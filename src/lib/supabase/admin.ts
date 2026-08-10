import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { supabaseServiceRoleKey, supabaseUrl } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Service-role client. Bypasses RLS completely.
 *
 * The `server-only` import above makes bundling this into client code a build
 * error. Nothing in the normal request path needs it -- brokers and guests are
 * both served through RLS -- so reach for it only for genuine admin work
 * (backfills, scheduled cleanup, webhook handlers) and never on behalf of a
 * user-supplied identifier without checking authorisation first.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
