import Link from 'next/link';
import { notFound } from 'next/navigation';

import { siteUrl } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import {
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  cityState,
  errorText,
  formatRate,
  formatSf,
  formatTourDate,
  input,
  label,
} from '@/lib/ui';

import { addStop, createShare, deleteTour, updateTour } from '../actions';
import { TourForm } from '../tour-form';
import { StopList } from './stop-list';
import { ShareLink } from './share-link';

export const metadata = { title: 'Tour | CRE Property Tour' };

export default async function TourDetailPage({
  params,
  searchParams,
}: PageProps<'/tours/[id]'>) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();

  const { data: tour } = await supabase.from('tours').select('*').eq('id', id).maybeSingle();
  if (!tour) notFound();

  const [{ data: stops }, { data: properties }, { data: clients }, { data: shares }, { count: noteCount }] =
    await Promise.all([
      supabase
        // Must stay one string literal -- supabase-js parses the select at the
        // type level, and concatenation erases it to `string`.
        .from('tour_stops')
        .select(
          'id, position, duration_minutes, broker_notes, property_id, properties(id, name, address_line1, city, state, available_sf, rent_rate, rent_type)',
        )
        .eq('tour_id', id)
        .order('position'),
      supabase
        .from('properties')
        .select('id, name, address_line1, city, state')
        .order('address_line1'),
      supabase.from('clients').select('id, name, company').order('name'),
      supabase
        .from('tour_shares')
        .select('id, token, label, allow_notes, allow_photos, revoked_at, created_at')
        .eq('tour_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('stop_notes').select('id', { count: 'exact', head: true }).eq('tour_id', id),
    ]);

  const stopPropertyIds = new Set((stops ?? []).map((stop) => stop.property_id));
  const available = (properties ?? []).filter((property) => !stopPropertyIds.has(property.id));
  const origin = siteUrl();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{tour.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[formatTourDate(tour.tour_date), tour.market, tour.status.replace('_', ' ')]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <Link href={`/tours/${tour.id}/recap`} className={buttonSecondary}>
          Recap{noteCount ? ` (${noteCount})` : ''}
        </Link>
      </header>

      {typeof error === 'string' ? <p className={`mt-6 ${errorText}`}>{error}</p> : null}

      {/* Itinerary ------------------------------------------------------- */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Itinerary
        </h2>

        <StopList
          tourId={tour.id}
          stops={(stops ?? []).map((stop) => {
            const property = Array.isArray(stop.properties) ? stop.properties[0] : stop.properties;
            return {
              id: stop.id,
              position: stop.position,
              durationMinutes: stop.duration_minutes,
              brokerNotes: stop.broker_notes,
              title: property?.name ?? property?.address_line1 ?? 'Property',
              subtitle: [
                property?.address_line1,
                cityState(property?.city, property?.state) || null,
              ]
                .filter(Boolean)
                .join(' · '),
              details: [
                formatSf(property?.available_sf),
                formatRate(property?.rent_rate, property?.rent_type),
              ]
                .filter(Boolean)
                .join(' · '),
            };
          })}
        />

        {available.length ? (
          <form action={addStop} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="tour_id" value={tour.id} />
            <div className="min-w-56 flex-1">
              <label htmlFor="property_id" className={label}>
                Add a building
              </label>
              <select id="property_id" name="property_id" required className={input}>
                <option value="">Choose a property…</option>
                {available.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name ?? property.address_line1}
                    {cityState(property.city, property.state)
                      ? ` — ${cityState(property.city, property.state)}`
                      : ''}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={buttonPrimary}>
              Add stop
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Every property in your library is already on this tour.{' '}
            <Link href="/properties/new" className="underline">
              Add another
            </Link>
            .
          </p>
        )}
      </section>

      {/* Share links ----------------------------------------------------- */}
      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Client links
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Send one of these to your client. No account needed — they enter their name and
          they&apos;re on the tour. Revoking stops new people joining; anyone already on
          stays on.
        </p>

        <ul className="mt-4 space-y-3">
          {shares?.map((share) => (
            <ShareLink key={share.id} tourId={tour.id} share={share} origin={origin} />
          ))}
        </ul>

        <form action={createShare} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="tour_id" value={tour.id} />
          <div className="min-w-48 flex-1">
            <label htmlFor="label" className={label}>
              New link for
            </label>
            <input
              id="label"
              name="label"
              placeholder="Jane Doe"
              className={input}
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="allow_notes" defaultChecked /> Notes
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="allow_photos" defaultChecked /> Photos
          </label>
          <button type="submit" className={buttonPrimary}>
            Create link
          </button>
        </form>
      </section>

      {/* Tour settings --------------------------------------------------- */}
      <section className="mt-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Tour details
        </h2>
        <TourForm
          action={updateTour}
          tour={tour}
          clients={clients ?? []}
          submitLabel="Save changes"
        />
      </section>

      <div className="mt-12 border-t border-border pt-6">
        <form action={deleteTour}>
          <input type="hidden" name="id" value={tour.id} />
          <button type="submit" className={buttonDanger}>
            Delete tour
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            Removes the itinerary, links, notes and photos. The properties stay in your
            library.
          </p>
        </form>
      </div>
    </main>
  );
}
