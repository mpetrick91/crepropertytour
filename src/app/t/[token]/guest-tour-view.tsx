import { createClient } from '@/lib/supabase/server';
import { TOUR_PHOTOS_BUCKET, type GuestTour } from '@/lib/supabase/types';
import { cityState, formatRate, formatSf, formatTourDate } from '@/lib/ui';

import { StopCard } from './stop-card';

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * What a client sees once they are on the tour. Every read here goes through
 * the guest_* views, which project only client-safe columns -- broker_notes and
 * the internal property notes are not selectable from this session at all.
 */
export async function GuestTourView({
  tour,
  participantId,
  canAddNotes,
  canAddPhotos,
}: {
  tour: GuestTour;
  participantId: string;
  canAddNotes: boolean;
  canAddPhotos: boolean;
}) {
  const supabase = await createClient();

  const { data: stops } = await supabase
    .from('guest_tour_stops')
    .select('id, property_id, position, scheduled_at, duration_minutes')
    .eq('tour_id', tour.id)
    .order('position');

  const propertyIds = stops?.map((stop) => stop.property_id) ?? [];

  const [{ data: properties }, { data: notes }, { data: photos }] = await Promise.all([
    propertyIds.length
      ? supabase.from('guest_properties').select('*').in('id', propertyIds)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from('stop_notes')
      .select('id, stop_id, body, rating, participant_id, tour_participants(display_name)')
      .eq('tour_id', tour.id)
      .order('created_at'),
    supabase
      .from('stop_photos')
      .select('id, stop_id, storage_path, caption, participant_id')
      .eq('tour_id', tour.id)
      .order('created_at'),
  ]);

  const paths = (photos ?? []).map((photo) => photo.storage_path);
  const { data: signed } = paths.length
    ? await supabase.storage
        .from(TOUR_PHOTOS_BUCKET)
        .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
    : { data: [] };

  const urlByPath = new Map(
    (signed ?? [])
      .filter((entry) => entry.signedUrl && entry.path)
      .map((entry) => [entry.path as string, entry.signedUrl]),
  );

  const byId = new Map((properties ?? []).map((property) => [property.id, property]));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{tour.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {[formatTourDate(tour.tour_date), tour.market].filter(Boolean).join(' · ') ||
          'Itinerary'}
      </p>
      {tour.requirement_summary ? (
        <p className="mt-3 rounded-lg bg-muted p-3 text-sm">{tour.requirement_summary}</p>
      ) : null}

      {!stops?.length ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Your broker hasn&apos;t added buildings to this tour yet.
        </p>
      ) : (
        <ol className="mt-6 space-y-4">
          {stops.map((stop, index) => {
            const property = byId.get(stop.property_id);

            return (
              <StopCard
                key={stop.id}
                index={index}
                tourId={tour.id}
                stopId={stop.id}
                participantId={participantId}
                canAddNotes={canAddNotes}
                canAddPhotos={canAddPhotos}
                title={property?.name ?? property?.address_line1 ?? 'Property'}
                address={[
                  property?.address_line1,
                  cityState(property?.city, property?.state) || null,
                ]
                  .filter(Boolean)
                  .join(', ')}
                facts={[
                  formatSf(property?.available_sf),
                  formatRate(property?.rent_rate, property?.rent_type),
                  property?.clear_height_ft ? `${property.clear_height_ft} ft clear` : null,
                  property?.dock_doors ? `${property.dock_doors} docks` : null,
                ].filter((fact): fact is string => Boolean(fact))}
                description={property?.description ?? null}
                brochureUrl={property?.brochure_url ?? null}
                notes={(notes ?? [])
                  .filter((note) => note.stop_id === stop.id)
                  .map((note) => {
                    const author = Array.isArray(note.tour_participants)
                      ? note.tour_participants[0]
                      : note.tour_participants;
                    return {
                      id: note.id,
                      body: note.body,
                      rating: note.rating,
                      authorName: author?.display_name ?? 'Someone',
                      isMine: note.participant_id === participantId,
                    };
                  })}
                photos={(photos ?? [])
                  .filter((photo) => photo.stop_id === stop.id)
                  .map((photo) => ({
                    id: photo.id,
                    url: urlByPath.get(photo.storage_path) ?? null,
                    caption: photo.caption,
                    isMine: photo.participant_id === participantId,
                  }))}
              />
            );
          })}
        </ol>
      )}
    </main>
  );
}
