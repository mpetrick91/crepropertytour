import { createClient } from '@/lib/supabase/server';
import type { TourSharePreview } from '@/lib/supabase/types';

import { JoinTourForm } from './join-tour-form';
import { GuestTourView } from './guest-tour-view';

export const metadata = { title: 'Your tour | CRE Property Tour' };

const INVALID_COPY: Record<string, string> = {
  not_found: "We couldn't find this tour link. Check the URL, or ask your broker to resend it.",
  revoked: 'This tour link has been turned off. Ask your broker for a new one.',
  expired: 'This tour link has expired. Ask your broker for a new one.',
};

export default async function GuestTourPage({ params }: PageProps<'/t/[token]'>) {
  const { token } = await params;
  const supabase = await createClient();

  // Callable while signed out -- this is what renders the invite before the
  // visitor has any session at all.
  const { data, error } = await supabase.rpc('preview_tour_share', { p_token: token });
  const preview = data as TourSharePreview | null;

  if (error || !preview?.valid || !preview.tour_id) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold">Tour link unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {INVALID_COPY[preview?.reason ?? 'not_found'] ?? INVALID_COPY.not_found}
          </p>
        </div>
      </main>
    );
  }

  // Already redeemed on this device? The guest views only return rows for
  // participants, so a hit here means they are on the tour.
  const { data: joinedTour } = await supabase
    .from('guest_tours')
    .select('id, title, tour_date, start_time, market, requirement_summary, status')
    .eq('id', preview.tour_id)
    .maybeSingle();

  if (joinedTour) {
    return <GuestTourView tour={joinedTour} />;
  }

  return <JoinTourForm token={token} preview={preview} />;
}
