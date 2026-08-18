import type { Session, User } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { supabase } from './supabase';

type SessionState = {
  session: Session | null;
  user: User | null;
  /** A real broker account. Anonymous guest sessions are deliberately excluded. */
  isBroker: boolean;
  /** True until the stored session has been read back from disk. */
  loading: boolean;
  /** Set when the dev auto sign-in is configured but failed, so the UI can say why. */
  autoSignInError: string | null;
};

const SessionContext = createContext<SessionState>({
  session: null,
  user: null,
  isBroker: false,
  loading: true,
  autoSignInError: null,
});

/**
 * Development convenience: sign in automatically from credentials in .env, so
 * reloading the app while building it does not mean retyping a password.
 *
 * Deliberately not a way of removing authentication. The app still signs in as
 * a real broker, so every row-level security rule applies exactly as it will in
 * production -- which means what you see while developing is what a signed-in
 * broker will see, not a privileged view that hides bugs.
 *
 * Two guards keep it out of a shipped app:
 *   - __DEV__ is false in any release build, so this never runs there.
 *   - the values live in mobile/.env, which is gitignored and is not what EAS
 *     builds read.
 *
 * To turn it off, delete the two lines from .env. Nothing else changes.
 */
function devCredentials(): { email: string; password: string } | null {
  if (!__DEV__) return null;

  const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
  const email = extra?.devEmail?.trim();
  const password = extra?.devPassword;

  return email && password ? { email, password } : null;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoSignInError, setAutoSignInError] = useState<string | null>(null);
  // One attempt only: a wrong password would otherwise retry forever.
  const attempted = useRef(false);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      // Sessions persist in AsyncStorage, so a guest who joined a tour last
      // week is still on it when they reopen the app -- no second sign-in.
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      if (data.session) {
        setSession(data.session);
        setLoading(false);
        return;
      }

      const credentials = devCredentials();
      if (!credentials || attempted.current) {
        setLoading(false);
        return;
      }

      attempted.current = true;
      console.log(`[dev] signing in automatically as ${credentials.email}`);

      const { error } = await supabase.auth.signInWithPassword(credentials);
      if (!active) return;

      if (error) {
        setAutoSignInError(
          `Automatic sign-in failed: ${error.message}. Check EXPO_PUBLIC_DEV_EMAIL and EXPO_PUBLIC_DEV_PASSWORD in mobile/.env, or sign in by hand below.`,
        );
        setLoading(false);
      }
      // On success the auth listener below sets the session and clears loading.
    }

    bootstrap();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<SessionState>(
    () => ({
      session,
      user: session?.user ?? null,
      isBroker: Boolean(session?.user) && !session?.user.is_anonymous,
      loading,
      autoSignInError,
    }),
    [session, loading, autoSignInError],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}

/** True when .env is set up to sign in for you. Used to explain the wait. */
export function hasDevAutoSignIn(): boolean {
  return devCredentials() !== null;
}
