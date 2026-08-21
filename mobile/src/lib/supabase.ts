import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import 'react-native-url-polyfill/auto';

import { createDemoClient, type DemoClient } from './demo/client';
import type { Database } from './database.types';

/**
 * Config comes from app.json's `extra` block (populated from .env at build
 * time by app.config.ts), because process.env is not available on device the
 * way it is in Next.js.
 */
type ConfigKey = 'supabaseUrl' | 'supabaseAnonKey' | 'siteUrl';

/**
 * The browser preview build is served from the website and gets its config at
 * runtime from a script the site injects, rather than baked in at build time.
 * That keeps a committed preview bundle free of any project values, and means
 * the preview always points at whatever the site itself is configured with.
 *
 * On a real device this is undefined and the values come from app.config.ts.
 */
declare global {
  // eslint-disable-next-line no-var
  var __CRE_CONFIG__: Partial<Record<ConfigKey, string>> | undefined;
}

function requiredExtra(key: ConfigKey): string {
  const injected = globalThis.__CRE_CONFIG__?.[key];
  if (injected) return injected;

  const value = (Constants.expoConfig?.extra as Record<string, string> | undefined)?.[key];
  if (!value) {
    throw new Error(
      `Missing ${key} in app config. Copy mobile/.env.example to mobile/.env and ` +
        `fill it in from your Supabase project, then restart the dev server.`,
    );
  }
  return value;
}

/** Same normalisation as the web app: strip any path so only the origin is used. */
function projectOrigin(): string {
  const raw = requiredExtra('supabaseUrl').trim();
  try {
    return new URL(raw).origin;
  } catch {
    throw new Error(`supabaseUrl is not a valid URL: "${raw}"`);
  }
}

/**
 * Demo mode: run the app against a database on the device instead of Supabase.
 *
 * On by default in development, because the alternative is a sign-in screen --
 * there is no third option. Row-level security answers "what may this request
 * read?" with "it depends who is signed in", so an app with no session is not
 * an app with everything unlocked, it is an app that can see nothing. Demo mode
 * sidesteps that by not having a server in the conversation at all.
 *
 * Nothing is bypassed, because there is nothing on the other end to bypass. The
 * screens, the forms and the navigation are the real ones; only the data is
 * local. Turn it off with EXPO_PUBLIC_DEMO_MODE=off in mobile/.env and the real
 * client, the real rules and the real sign-in come back untouched.
 *
 * Never on in a release build regardless of what .env says.
 */
export const isDemoMode = (() => {
  if (!__DEV__) return false;
  const flag = (Constants.expoConfig?.extra as Record<string, string | undefined>)?.demoMode;
  return flag?.toLowerCase() !== 'off' && flag?.toLowerCase() !== 'false';
})();

export const siteUrl = () =>
  isDemoMode
    ? 'https://crepropertytour.vercel.app'
    : requiredExtra('siteUrl').replace(/\/+$/, '');

/**
 * Built lazily so that demo mode needs no configuration at all -- reading
 * supabaseUrl would throw before the app could render, which is the failure
 * demo mode exists to avoid.
 */
function realClient() {
  return createClient<Database>(projectOrigin(), requiredExtra('supabaseAnonKey'), {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // A native app has no URL bar to read a magic-link fragment out of; the
      // deep-link handler in app/_layout.tsx feeds the session in explicitly.
      detectSessionInUrl: false,
    },
  });
}

export const supabase = (
  isDemoMode ? createDemoClient() : realClient()
) as unknown as SupabaseClient<Database>;

/**
 * Resolves once any previously saved demo data has been read back off disk.
 * Awaited before the first screen loads so edits made last time are present
 * rather than appearing a moment later.
 */
export const demoReady: Promise<void> = isDemoMode
  ? (supabase as unknown as DemoClient).restore()
  : Promise.resolve();

if (isDemoMode) {
  console.log('[demo] running on a local database — no sign-in, no Supabase');
}
