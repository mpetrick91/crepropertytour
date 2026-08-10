'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import type { TourSharePreview } from '@/lib/supabase/types';

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
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  const date = formatTourDate(preview.tour_date);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
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
            className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:text-[#0c0f13]"
          >
            {busy ? 'Joining…' : 'Join the tour'}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            No account or password needed.
          </p>
        </form>
      </div>
    </main>
  );
}
