import { createClient } from '@/lib/supabase/server';
import type { GuestTour } from '@/lib/supabase/types';

/**
 * What a client sees once they are on the tour. Reads come from the guest_*
 * views, which project only client-safe columns -- broker_notes and the
 * internal property notes are not selectable from here at all.
 *
 * Note capture and photo upload build on this in the next phase; the tables,
 * policies and storage bucket they need are already live.
 */
export async function GuestTourView({ tour }: { tour: GuestTour }) {
  const supabase = await createClient();

  const { data: stops } = await supabase
    .from('guest_tour_stops')
    .select('id, property_id, position, scheduled_at')
    .eq('tour_id', tour.id)
    .order('position');

  const propertyIds = stops?.map((stop) => stop.property_id) ?? [];
  const { data: properties } = propertyIds.length
    ? await supabase
        .from('guest_properties')
        .select('id, name, address_line1, city, state, building_size_sf, available_sf, description')
        .in('id', propertyIds)
    : { data: [] };

  const byId = new Map((properties ?? []).map((property) => [property.id, property]));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{tour.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {[tour.market, tour.tour_date].filter(Boolean).join(' · ') || 'Itinerary'}
      </p>

      <ol className="mt-6 space-y-3">
        {stops?.map((stop, index) => {
          const property = byId.get(stop.property_id);
          const location = [property?.city, property?.state].filter(Boolean).join(', ');

          return (
            <li key={stop.id} className="rounded-lg border border-border p-4">
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent text-xs font-semibold text-white dark:text-[#0c0f13]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-medium">
                    {property?.name ?? property?.address_line1 ?? 'Property'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {property?.address_line1}
                    {location ? ` · ${location}` : ''}
                  </p>
                  {property?.available_sf ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {property.available_sf.toLocaleString()} SF available
                    </p>
                  ) : null}
                  {property?.description ? (
                    <p className="mt-2 text-sm">{property.description}</p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {!stops?.length && (
        <p className="mt-6 text-sm text-muted-foreground">
          Your broker hasn&apos;t added buildings to this tour yet.
        </p>
      )}
    </main>
  );
}
