import { createClient } from '@/lib/supabase/server';
import type { ShareInvalidReason, TourSharePreview } from '@/lib/supabase/types';

import { JoinTourForm } from './join-tour-form';
import { GuestTourView } from './guest-tour-view';

export const metadata = { title: 'Your tour | CRE Property Tour' };

const INVALID_COPY: Record<ShareInvalidReason, string> = {
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

  // Already redeemed on this device? A participant row is the proof -- the
  // guest views return nothing without one.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: participant } = user
    ? await supabase
        .from('tour_participants')
        .select('id, can_add_notes, can_add_photos')
        .eq('tour_id', preview.tour_id)
        .eq('user_id', user.id)
        .is('removed_at', null)
        .maybeSingle()
    : { data: null };

  if (participant) {
    const { data: tour } = await supabase
      .from('guest_tours')
      .select('id, title, status, tour_date, start_time, market, requirement_summary')
      .eq('id', preview.tour_id)
      .maybeSingle();

    if (tour) {
      return (
        <GuestTourView
          tour={tour}
          participantId={participant.id}
          canAddNotes={participant.can_add_notes}
          canAddPhotos={participant.can_add_photos}
        />
      );
    }
  }

  return <JoinTourForm token={token} preview={preview} />;
}
