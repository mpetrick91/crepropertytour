import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { buttonPrimary, buttonSecondary, formatTourDate } from '@/lib/ui';

export const metadata = { title: 'Dashboard | CRE Property Tour' };

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: tours }, { count: propertyCount }, { count: clientCount }] = await Promise.all([
    supabase
      .from('tours')
      .select('id, title, status, tour_date, market, tour_stops(count)')
      .not('status', 'eq', 'archived')
      .order('tour_date', { ascending: false, nullsFirst: false })
      .limit(5),
    supabase.from('properties').select('id', { count: 'exact', head: true }),
    supabase.from('clients').select('id', { count: 'exact', head: true }),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Active tours', value: tours?.length ?? 0 },
          { label: 'Properties', value: propertyCount ?? 0 },
          { label: 'Clients', value: clientCount ?? 0 },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border p-4">
            <dt className="text-sm text-muted-foreground">{stat.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent tours
          </h2>
          <div className="flex gap-2">
            <Link href="/properties/new" className={buttonSecondary}>
              Add property
            </Link>
            <Link href="/tours/new" className={buttonPrimary}>
              New tour
            </Link>
          </div>
        </div>

        {!tours?.length ? (
          <div className="mt-4 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Nothing scheduled. Add a few properties, then build your first tour.
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {tours.map((tour) => {
              const stopCount = Array.isArray(tour.tour_stops)
                ? (tour.tour_stops[0]?.count ?? 0)
                : 0;
              return (
                <li key={tour.id}>
                  <Link
                    href={`/tours/${tour.id}`}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-muted"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{tour.title}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {[
                          formatTourDate(tour.tour_date),
                          tour.market,
                          `${stopCount} stop${stopCount === 1 ? '' : 's'}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      {tour.status.replace('_', ' ')}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
