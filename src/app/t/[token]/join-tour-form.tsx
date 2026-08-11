'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import type { TourSharePreview } from '@/lib/supabase/types';

/**
 * Guests are clients standing in a parking lot, not developers. Translate the
 * project-configuration failures they can actually hit into something that
 * tells them who to chase, rather than leaking GoTrue's wording.
 */
function humanJoinError(message: string): string {
  const text = message.toLowerCase();

  // Both of these mean the Supabase project is misconfigured for guests:
  // anonymous sign-ins switched off, or signups disabled project-wide (which
  // silently disables anonymous sign-ins along with everything else).
  if (
    text.includes('anonymous') ||
    text.includes('signups not allowed') ||
    text.includes('signup is disabled')
  ) {
    return 'This tour is not accepting guests yet. Let your broker know — it is a setting on their end, not anything you did.';
  }
  if (text.includes('no longer valid') || text.includes('42501')) {
    return 'This tour link has been turned off. Ask your broker for a new one.';
  }
  if (text.includes('rate limit') || text.includes('too many')) {
    return 'Too many attempts just now. Wait a moment and try again.';
  }
  if (text.includes('fetch') || text.includes('network')) {
    return 'Could not reach the server. Check your signal and try again.';
  }
  return message;
}

function formatTourDate(date: string | null): string | null {
  if (!date) return null;
  // The column is a bare date; parsing it as UTC keeps it from sliding a day
  // backwards for anyone west of Greenwich.
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function JoinTourForm({
  token,
  preview,
}: {
  token: string;
  preview: TourSharePreview;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();

    try {
      // No account, no password: the guest gets an anonymous Supabase identity,
      // then trades the link token for a seat on this one tour. From that point
      // on they are an ordinary authenticated user and RLS does the rest.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error: authError } = await supabase.auth.signInAnonymously();
        if (authError) throw authError;
      }

      const { error: joinError } = await supabase.rpc('join_tour', {
        p_token: token,
        p_display_name: name.trim(),
        p_company: company.trim() || null,
      });
      if (joinError) throw joinError;

      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? humanJoinError(caught.message) : 'Something went wrong.',
      );
      setBusy(false);
    }
  }

  const date = formatTourDate(preview.tour_date);

  return (
    <div className="flex flex-1 flex-col justify-center">
      <div className="w-full max-w-sm">
        <p className="text-sm text-muted-foreground">
          {preview.broker_name ?? 'Your broker'}
          {preview.broker_company ? ` · ${preview.broker_company}` : ''} invited you to
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{preview.tour_title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {[date, preview.market, `${preview.stop_count ?? 0} buildings`]
            .filter(Boolean)
            .join(' · ')}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Your name
            </label>
            <input
              id="name"
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              So your notes and photos are labelled for the group.
            </p>
          </div>

          <div>
            <label htmlFor="company" className="block text-sm font-medium">
              Company <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              id="company"
              maxLength={120}
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              autoComplete="organization"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:text-[#070B14]"
          >
            {busy ? 'Joining…' : 'Join the tour'}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            No account or password needed.
          </p>
        </form>
      </div>
    </div>
  );
}
