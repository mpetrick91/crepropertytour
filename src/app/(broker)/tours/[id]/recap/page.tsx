import Link from 'next/link';
import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { TOUR_PHOTOS_BUCKET } from '@/lib/supabase/types';
import { buttonSecondary, cityState, formatTourDate } from '@/lib/ui';

export const metadata = { title: 'Tour recap | CRE Property Tour' };

/** Signed URLs are short-lived on purpose -- the bucket stays private. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <span className="text-xs text-amber-600 dark:text-amber-400" aria-label={`${rating} out of 5`}>
      {'★'.repeat(rating)}
      {'☆'.repeat(5 - rating)}
    </span>
  );
}

export default async function TourRecapPage({ params }: PageProps<'/tours/[id]/recap'>) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tour } = await supabase
    .from('tours')
    .select('id, title, tour_date, market, requirement_summary')
    .eq('id', id)
    .maybeSingle();
  if (!tour) notFound();

  const [{ data: stops }, { data: notes }, { data: photos }, { data: participants }] =
    await Promise.all([
      supabase
        .from('tour_stops')
        .select(
          'id, position, broker_notes, properties(name, address_line1, city, state)',
        )
        .eq('tour_id', id)
        .order('position'),
      supabase
        .from('stop_notes')
        .select('id, stop_id, body, rating, created_at, tour_participants(display_name, role, company)')
        .eq('tour_id', id)
        .order('created_at'),
      supabase
        .from('stop_photos')
        .select('id, stop_id, storage_path, caption, created_at, tour_participants(display_name)')
        .eq('tour_id', id)
        .order('created_at'),
      supabase
        .from('tour_participants')
        .select('id, display_name, company, role')
        .eq('tour_id', id)
        .is('removed_at', null),
    ]);

  // One batch call rather than one per photo.
  const paths = (photos ?? []).map((photo) => photo.storage_path);
  const { data: signed } = paths.length
    ? await supabase.storage.from(TOUR_PHOTOS_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
    : { data: [] };

  const urlByPath = new Map(
    (signed ?? [])
      .filter((entry) => entry.signedUrl && entry.path)
      .map((entry) => [entry.path as string, entry.signedUrl]),
  );

  const guestCount = (participants ?? []).filter((p) => p.role === 'guest').length;
  const totalNotes = notes?.length ?? 0;
  const totalPhotos = photos?.length ?? 0;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{tour.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[formatTourDate(tour.tour_date), tour.market].filter(Boolean).join(' · ')}
          </p>
        </div>
        <Link href={`/tours/${tour.id}`} className={buttonSecondary}>
          Back to tour
        </Link>
      </header>

      <p className="mt-6 text-sm text-muted-foreground">
        {totalNotes} note{totalNotes === 1 ? '' : 's'} and {totalPhotos} photo
        {totalPhotos === 1 ? '' : 's'} from {guestCount} client
        {guestCount === 1 ? '' : 's'}, grouped by stop.
      </p>

      <div className="mt-8 space-y-8">
        {stops?.map((stop, index) => {
          const property = Array.isArray(stop.properties) ? stop.properties[0] : stop.properties;
          const stopNotes = (notes ?? []).filter((note) => note.stop_id === stop.id);
          const stopPhotos = (photos ?? []).filter((photo) => photo.stop_id === stop.id);

          return (
            <section key={stop.id}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent text-xs font-semibold text-white dark:text-[#070B14]">
                  {index + 1}
                </span>
                <div>
                  <h2 className="font-medium">
                    {property?.name ?? property?.address_line1 ?? 'Property'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {property?.address_line1}
                    {cityState(property?.city, property?.state)
                      ? ` · ${cityState(property?.city, property?.state)}`
                      : ''}
                  </p>
                </div>
              </div>

              {stop.broker_notes ? (
                <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/30">
                  <span className="font-medium">Your note:</span> {stop.broker_notes}
                </p>
              ) : null}

              {stopNotes.length ? (
                <ul className="mt-3 space-y-2">
                  {stopNotes.map((note) => {
                    const author = Array.isArray(note.tour_participants)
                      ? note.tour_participants[0]
                      : note.tour_participants;
                    return (
                      <li key={note.id} className="rounded-lg border border-border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">
                            {author?.display_name ?? 'Someone'}
                          </span>
                          {author?.role === 'broker' ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                              you
                            </span>
                          ) : null}
                          <Stars rating={note.rating} />
                        </div>
                        <p className="mt-1 text-sm whitespace-pre-wrap">{note.body}</p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No client notes on this stop.</p>
              )}

              {stopPhotos.length ? (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {stopPhotos.map((photo) => {
                    const url = urlByPath.get(photo.storage_path);
                    const author = Array.isArray(photo.tour_participants)
                      ? photo.tour_participants[0]
                      : photo.tour_participants;
                    return (
                      <figure key={photo.id} className="overflow-hidden rounded-lg border border-border">
                        {url ? (
                          // Signed URLs expire, so the Image optimizer would
                          // cache and then re-serve a dead target.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={url}
                            alt={photo.caption ?? `Photo by ${author?.display_name ?? 'a client'}`}
                            className="aspect-4/3 w-full object-cover"
                          />
                        ) : (
                          <div className="flex aspect-4/3 items-center justify-center bg-muted text-xs text-muted-foreground">
                            Unavailable
                          </div>
                        )}
                        <figcaption className="p-2 text-xs text-muted-foreground">
                          {photo.caption ?? author?.display_name ?? ''}
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {!stops?.length ? (
        <p className="mt-8 text-sm text-muted-foreground">This tour has no stops yet.</p>
      ) : null}
    </main>
  );
}
