import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from './supabase';

type SessionState = {
  session: Session | null;
  user: User | null;
  /** A real broker account. Anonymous guest sessions are deliberately excluded. */
  isBroker: boolean;
  /** True until the stored session has been read back from disk. */
  loading: boolean;
};

const SessionContext = createContext<SessionState>({
  session: null,
  user: null,
  isBroker: false,
  loading: true,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Sessions persist in AsyncStorage, so a guest who joined a tour last week
    // is still on it when they reopen the app -- no second sign-in.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

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
    }),
    [session, loading],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
