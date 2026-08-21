import type { Session, User } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { signInAsDevBroker } from './dev-account';
import { seedDevWorkspaceOnce } from './dev-seed';
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
 * Optional development credentials from .env. Set them and the app signs in as
 * that specific broker -- which is what you want once there is real data in the
 * account you care about. Leave them out and the app provisions a throwaway
 * broker for itself instead (see dev-account.ts), so nobody has to type
 * anything at all.
 *
 * Either way the app is signed in as a real broker and every row-level security
 * rule applies exactly as it will in production. What you see while developing
 * is what a signed-in broker sees, not a privileged view that hides bugs.
 *
 * __DEV__ is false in any release build, so none of this ships.
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
  // Holds the app on its spinner while a new development workspace is filled
  // in, so the tour list opens populated instead of blank-then-populated.
  const seeding = useRef(false);

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

      if (!__DEV__ || attempted.current) {
        setLoading(false);
        return;
      }
      attempted.current = true;

      const credentials = devCredentials();

      if (credentials) {
        console.log(`[dev] signing in automatically as ${credentials.email}`);
        const { error } = await supabase.auth.signInWithPassword(credentials);
        if (!active) return;

        if (!error) return; // The auth listener takes it from here.

        // Named credentials that do not work are a mistake worth surfacing --
        // silently falling through to a throwaway account would leave someone
        // staring at the wrong workspace wondering where their tours went.
        setAutoSignInError(
          `Could not sign in as ${credentials.email}: ${error.message}. Fix ` +
            'EXPO_PUBLIC_DEV_EMAIL and EXPO_PUBLIC_DEV_PASSWORD in mobile/.env, or ' +
            'delete those two lines to let the app make its own account.',
        );
        setLoading(false);
        return;
      }

      console.log('[dev] no credentials in .env — using a throwaway broker account');
      seeding.current = true;
      const result = await signInAsDevBroker();

      if (!result.ok) {
        seeding.current = false;
        if (!active) return;
        setAutoSignInError(result.message);
        setLoading(false);
        return;
      }

      const { data: signedIn } = await supabase.auth.getUser();
      if (signedIn.user) await seedDevWorkspaceOnce(signedIn.user.id);

      seeding.current = false;
      if (!active) return;
      setLoading(false);
    }

    bootstrap();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      // Not while a new workspace is still being written -- bootstrap() clears
      // it once there is something to show.
      if (!seeding.current) setLoading(false);
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

/**
 * True when the app signs itself in rather than asking. Always the case in
 * development -- with .env credentials if they are set, and with a throwaway
 * account if they are not. Used to explain the wait instead of flashing a
 * sign-in form nobody is expected to fill in.
 */
export function hasDevAutoSignIn(): boolean {
  return __DEV__;
}
