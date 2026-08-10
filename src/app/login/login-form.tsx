'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const initialError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(initialError);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus('sending');

    const supabase = createClient();
    const callback = new URL('/auth/callback', window.location.origin);
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      callback.searchParams.set('next', next);
    }

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback.toString() },
    });

    if (signInError) {
      setError(signInError.message);
      setStatus('idle');
      return;
    }

    setStatus('sent');
  }

  if (status === 'sent') {
    return (
      <div className="mt-8 rounded-lg border border-border bg-muted p-4 text-sm">
        <p className="font-medium">Check your email.</p>
        <p className="mt-1 text-muted-foreground">
          We sent a sign-in link to {email}. It expires in an hour.
        </p>
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

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:text-[#0c0f13]"
      >
        {status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
      </button>
    </form>
  );
}
