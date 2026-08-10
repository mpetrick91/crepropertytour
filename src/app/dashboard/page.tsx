import { redirect } from 'next/navigation';

import { createClient, getBroker } from '@/lib/supabase/server';

export const metadata = { title: 'Dashboard | CRE Property Tour' };

export default async function DashboardPage() {
  const broker = await getBroker();
  if (!broker) redirect('/login');

  const supabase = await createClient();

  const [{ data: profile }, { data: tours }, { count: propertyCount }] = await Promise.all([
    supabase.from('profiles').select('full_name, company, email').eq('id', broker.id).single(),
    supabase
      .from('tours')
      .select('id, title, status, tour_date, market')
      .order('tour_date', { ascending: false, nullsFirst: false })
      .limit(10),
    supabase.from('properties').select('id', { count: 'exact', head: true }),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tours</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as {profile?.full_name ?? profile?.email ?? broker.email}
            {profile?.company ? ` · ${profile.company}` : ''}
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground"
          >
            Sign out
          </button>
        </form>
      </header>

      <p className="mt-6 text-sm text-muted-foreground">
        {propertyCount ?? 0} propert{propertyCount === 1 ? 'y' : 'ies'} in your library.
      </p>

      <section className="mt-4">
        {!tours?.length ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No tours yet. Tour creation lands in the next phase &mdash; the database,
            share links and photo storage behind it are already in place.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {tours.map((tour) => (
              <li key={tour.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{tour.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {[tour.market, tour.tour_date].filter(Boolean).join(' · ') || 'Unscheduled'}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  {tour.status.replace('_', ' ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
