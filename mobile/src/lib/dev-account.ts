import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { supabase } from './supabase';

/**
 * Gets you into the app in development without a password.
 *
 * Row-level security decides what a request may read from *who is signed in*,
 * so an app with no session is not an app with everything unlocked -- it is an
 * app that can see nothing at all. Removing the sign-in screen would therefore
 * have produced a set of empty screens, not a working app.
 *
 * Instead the app provisions a throwaway broker account for itself on first
 * launch and remembers it. Every security rule still applies exactly as it will
 * in production; there is simply nobody to type a password. The account is
 * created through the ordinary public sign-up path -- no privileged key is
 * involved, and none exists in this app.
 *
 * __DEV__ is false in any release build, so none of this ships.
 */

const STORAGE_KEY = 'cre.dev-broker-account.v1';

type StoredAccount = { email: string; password: string };

export type DevSignInResult = { ok: true } | { ok: false; message: string };

function randomHex(byteCount: number): string {
  return Array.from(Crypto.getRandomBytes(byteCount), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

/**
 * example.com is the address range IANA reserves for exactly this -- it is
 * accepted by every email validator and can never reach a real inbox.
 */
function newAccount(): StoredAccount {
  return { email: `dev-${randomHex(6)}@example.com`, password: randomHex(16) };
}

async function readStored(): Promise<StoredAccount | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAccount>;
    return parsed.email && parsed.password
      ? { email: parsed.email, password: parsed.password }
      : null;
  } catch {
    // A corrupt entry is not worth reporting: the caller just makes a new one.
    return null;
  }
}

/**
 * Sign-up failures worth translating. Each of these is a project setting the
 * developer can change, so name the setting rather than echoing Supabase.
 */
function humanSignUpError(message: string): string {
  const text = message.toLowerCase();

  if (text.includes('signups not allowed') || text.includes('signup is disabled')) {
    return (
      'Supabase is refusing to create the development account because sign-ups are ' +
      'turned off. In the Supabase dashboard open Authentication → Sign In / Providers ' +
      '→ Email and turn "Allow new users to sign up" on. (Guest tour links need it on ' +
      'too, so this is the setting you want either way.)'
    );
  }
  if (text.includes('rate limit') || text.includes('too many')) {
    return 'Supabase is rate limiting sign-ups. Wait a minute and reload the app.';
  }
  if (text.includes('fetch') || text.includes('network')) {
    return 'Could not reach Supabase. Check the Wi-Fi on the phone and the Mac.';
  }
  return message;
}

/**
 * Reuses the stored account when there is one, and provisions a fresh one
 * otherwise. A stored account that no longer works -- the user was deleted, or
 * the app is pointed at a different project than last time -- is discarded and
 * replaced rather than reported, since there is nothing for anyone to fix.
 */
export async function signInAsDevBroker(): Promise<DevSignInResult> {
  const stored = await readStored();

  if (stored) {
    const { error } = await supabase.auth.signInWithPassword(stored);
    if (!error) return { ok: true };
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  const account = newAccount();
  const { data, error } = await supabase.auth.signUp({
    email: account.email,
    password: account.password,
    options: { data: { full_name: 'Development Broker' } },
  });

  if (error) return { ok: false, message: humanSignUpError(error.message) };

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(account));

  if (data.session) return { ok: true };

  // No session on sign-up means the project requires email confirmation. The
  // address is unreachable by design, so try a direct sign-in in case the
  // project auto-confirms, and otherwise name the setting to change.
  const { error: signInError } = await supabase.auth.signInWithPassword(account);
  if (!signInError) return { ok: true };

  return {
    ok: false,
    message:
      'Supabase created the development account but is waiting for the email address ' +
      'to be confirmed, and this one has no inbox. In the Supabase dashboard open ' +
      'Authentication → Sign In / Providers → Email and turn "Confirm email" off, ' +
      'then reload the app.',
  };
}

/** Forgets the throwaway account, so the next launch provisions a clean one. */
export async function forgetDevBroker(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
