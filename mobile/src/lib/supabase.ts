import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import 'react-native-url-polyfill/auto';

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

export const siteUrl = () => requiredExtra('siteUrl').replace(/\/+$/, '');

export const supabase = createClient<Database>(projectOrigin(), requiredExtra('supabaseAnonKey'), {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // A native app has no URL bar to read a magic-link fragment out of; the
    // deep-link handler in app/_layout.tsx feeds the session in explicitly.
    detectSessionInUrl: false,
  },
});
