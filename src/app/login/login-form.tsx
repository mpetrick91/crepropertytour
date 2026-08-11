'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

/**
 * Supabase auth errors are written for developers. This is the only screen a
 * human ever hits cold, so translate the ones that actually come up.
 */
function humanAuthError(message: string): string {
  const text = message.toLowerCase();

  if (text.includes('invalid login credentials')) {
    return 'That email and password do not match an account. You can set or change the password in Supabase under Authentication → Users.';
  }
  if (text.includes('email not confirmed')) {
    return 'That account has not been confirmed yet. In Supabase under Authentication → Users, edit the user and confirm their email.';
  }
  // Raised when the account does not exist, since this form never creates one.
  if (text.includes('signups not allowed') || text.includes('user not found')) {
    return 'That email is not set up as a broker on this app. Check the spelling, or add the account in Supabase under Authentication → Users.';
  }
  if (text.includes('rate limit') || text.includes('too many')) {
    return 'Too many sign-in attempts just now. Wait a minute and try again.';
  }
  if (text.includes('fetch') || text.includes('network')) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return message;
}

/**
 * Password first, email link second.
 *
 * Supabase will not let a project edit its email templates without custom SMTP,
 * and its built-in sender is rate limited to a few messages an hour. Since the
 * only Supabase email this product ever sends is a broker signing themselves in
 * -- clients get their tour link from the broker directly -- a password avoids
 * that whole dependency at no cost.
 */
export function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const next = searchParams.get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get('error'));

  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(humanAuthError(signInError.message));
      setBusy(false);
      return;
    }

    router.replace(safeNext);
    router.refresh();
  }

  async function emailLink() {
    if (!email.trim()) {
      setError('Enter your email first.');
      return;
    }
    setError(null);
    setBusy(true);

    const supabase = createClient();
    const callback = new URL('/auth/callback', window.location.origin);
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      callback.searchParams.set('next', next);
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: callback.toString(),
        // Broker accounts are added deliberately in the Supabase dashboard.
        shouldCreateUser: false,
      },
    });

    setBusy(false);
    if (otpError) {
      setError(humanAuthError(otpError.message));
      return;
    }
    setLinkSent(true);
  }

  if (linkSent) {
    return (
      <div className="mt-8 rounded-lg border border-border bg-muted p-4 text-sm">
        <p className="font-medium">Check your email.</p>
        <p className="mt-1 text-muted-foreground">
          We sent a sign-in link to {email.trim()}. It expires in an hour.
        </p>
        <button
          type="button"
          onClick={() => setLinkSent(false)}
          className="mt-3 text-sm underline"
        >
          Use a password instead
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Work email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@cresa.com"
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:text-[#070B14]"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>

      <button
        type="button"
        onClick={emailLink}
        disabled={busy}
        className="w-full text-center text-sm text-muted-foreground underline disabled:opacity-60"
      >
        Email me a sign-in link instead
      </button>
    </form>
  );
}
