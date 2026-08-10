import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { buttonPrimary, formatTourDate } from '@/lib/ui';

export const metadata = { title: 'Tours | CRE Property Tour' };

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  in_progress: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  completed: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-300',
  archived: 'bg-muted text-muted-foreground',
};

export default async function ToursPage() {
  const supabase = await createClient();
  const { data: tours } = await supabase
    .from('tours')
    .select('id, title, status, tour_date, market, clients(name, company), tour_stops(count)')
    .order('tour_date', { ascending: false, nullsFirst: false });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tours</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Build an itinerary, send one link, collect the feedback.
          </p>
        </div>
        <Link href="/tours/new" className={buttonPrimary}>
          New tour
        </Link>
      </header>

      {!tours?.length ? (
        <div className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No tours yet.
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
          {tours.map((tour) => {
            const client = Array.isArray(tour.clients) ? tour.clients[0] : tour.clients;
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
                        client?.company ?? client?.name,
                        formatTourDate(tour.tour_date),
                        tour.market,
                        `${stopCount} stop${stopCount === 1 ? '' : 's'}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
                      STATUS_STYLES[tour.status] ?? STATUS_STYLES.draft
                    }`}
                  >
                    {tour.status.replace('_', ' ')}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
