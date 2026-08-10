'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  checkbox,
  enumeration,
  requiredText,
  runAction,
  text,
  ValidationError,
  type ActionState,
} from '@/lib/form';
import { createClient, getBroker } from '@/lib/supabase/server';
import type { TourStatus } from '@/lib/supabase/types';

const TOUR_STATUSES: readonly TourStatus[] = [
  'draft',
  'scheduled',
  'in_progress',
  'completed',
  'archived',
];

export async function createTour(_prev: ActionState, form: FormData): Promise<ActionState> {
  let newId: string | null = null;

  const result = await runAction(async () => {
    const broker = await getBroker();
    if (!broker) throw new ValidationError('Your session expired. Sign in again.');

    const supabase = await createClient();

    // The client picker doubles as a "new client" field so a tour can be set up
    // without a detour through a separate screen.
    let clientId = text(form, 'client_id');
    const newClientName = text(form, 'new_client_name');

    if (!clientId && newClientName) {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          broker_id: broker.id,
          name: newClientName,
          company: text(form, 'new_client_company'),
        })
        .select('id')
        .single();
      if (error) throw new ValidationError(error.message);
      clientId = data.id;
    }

    const { data, error } = await supabase
      .from('tours')
      .insert({
        broker_id: broker.id,
        client_id: clientId,
        title: requiredText(form, 'title', 'Tour name'),
        status: enumeration(form, 'status', TOUR_STATUSES) ?? 'draft',
        tour_date: text(form, 'tour_date'),
        start_time: text(form, 'start_time'),
        market: text(form, 'market'),
        requirement_summary: text(form, 'requirement_summary'),
        notes: text(form, 'notes'),
      })
      .select('id')
      .single();

    if (error) throw new ValidationError(error.message);
    newId = data.id;
  });

  if (result && 'ok' in result && newId) {
    revalidatePath('/tours');
    redirect(`/tours/${newId}`);
  }
  return result;
}

export async function updateTour(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const id = requiredText(form, 'id', 'Tour id');
    const supabase = await createClient();

    const { error } = await supabase
      .from('tours')
      .update({
        client_id: text(form, 'client_id'),
        title: requiredText(form, 'title', 'Tour name'),
        status: enumeration(form, 'status', TOUR_STATUSES) ?? 'draft',
        tour_date: text(form, 'tour_date'),
        start_time: text(form, 'start_time'),
        market: text(form, 'market'),
        requirement_summary: text(form, 'requirement_summary'),
        notes: text(form, 'notes'),
      })
      .eq('id', id);

    if (error) throw new ValidationError(error.message);

    revalidatePath('/tours');
    revalidatePath(`/tours/${id}`);
  });
}

export async function addStop(form: FormData): Promise<void> {
  const tourId = requiredText(form, 'tour_id', 'Tour id');
  const propertyId = requiredText(form, 'property_id', 'Property');

  const supabase = await createClient();

  const { data: position, error: positionError } = await supabase.rpc('next_stop_position', {
    p_tour_id: tourId,
  });
  if (positionError) {
    redirect(`/tours/${tourId}?error=${encodeURIComponent(positionError.message)}`);
  }

  const { error } = await supabase.from('tour_stops').insert({
    tour_id: tourId,
    property_id: propertyId,
    position: position ?? 1,
  });

  if (error) {
    // The most likely cause by far is the (tour_id, property_id) uniqueness
    // guard, so say that rather than echoing the constraint name.
    const message =
      error.code === '23505'
        ? 'That property is already on this tour.'
        : error.message;
    redirect(`/tours/${tourId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/tours/${tourId}`);
}

export async function removeStop(form: FormData): Promise<void> {
  const tourId = requiredText(form, 'tour_id', 'Tour id');
  const stopId = requiredText(form, 'stop_id', 'Stop id');

  const supabase = await createClient();
  const { error } = await supabase.from('tour_stops').delete().eq('id', stopId);

  if (error) {
    redirect(`/tours/${tourId}?error=${encodeURIComponent(error.message)}`);
  }

  // Close the gap the removed stop left behind.
  const { data: remaining } = await supabase
    .from('tour_stops')
    .select('id')
    .eq('tour_id', tourId)
    .order('position');

  if (remaining?.length) {
    await supabase.rpc('reorder_tour_stops', {
      p_tour_id: tourId,
      p_stop_ids: remaining.map((stop) => stop.id),
    });
  }

  revalidatePath(`/tours/${tourId}`);
}

export async function moveStop(form: FormData): Promise<void> {
  const tourId = requiredText(form, 'tour_id', 'Tour id');
  const stopId = requiredText(form, 'stop_id', 'Stop id');
  const direction = form.get('direction') === 'up' ? -1 : 1;

  const supabase = await createClient();
  const { data: stops } = await supabase
    .from('tour_stops')
    .select('id')
    .eq('tour_id', tourId)
    .order('position');

  if (!stops?.length) return;

  const from = stops.findIndex((stop) => stop.id === stopId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= stops.length) return;

  const ordered = stops.map((stop) => stop.id);
  [ordered[from], ordered[to]] = [ordered[to], ordered[from]];

  const { error } = await supabase.rpc('reorder_tour_stops', {
    p_tour_id: tourId,
    p_stop_ids: ordered,
  });

  if (error) {
    redirect(`/tours/${tourId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/tours/${tourId}`);
}

export async function saveStopNotes(form: FormData): Promise<void> {
  const tourId = requiredText(form, 'tour_id', 'Tour id');
  const stopId = requiredText(form, 'stop_id', 'Stop id');

  const supabase = await createClient();
  await supabase
    .from('tour_stops')
    .update({
      broker_notes: text(form, 'broker_notes'),
      duration_minutes: text(form, 'duration_minutes')
        ? Number.parseInt(text(form, 'duration_minutes') as string, 10)
        : null,
    })
    .eq('id', stopId);

  revalidatePath(`/tours/${tourId}`);
}

export async function createShare(form: FormData): Promise<void> {
  const tourId = requiredText(form, 'tour_id', 'Tour id');

  const supabase = await createClient();
  const { error } = await supabase.rpc('create_tour_share', {
    p_tour_id: tourId,
    p_label: text(form, 'label'),
    p_allow_notes: checkbox(form, 'allow_notes'),
    p_allow_photos: checkbox(form, 'allow_photos'),
    p_expires_at: null,
  });

  if (error) {
    redirect(`/tours/${tourId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/tours/${tourId}`);
}

export async function revokeShare(form: FormData): Promise<void> {
  const tourId = requiredText(form, 'tour_id', 'Tour id');
  const shareId = requiredText(form, 'share_id', 'Share id');

  const supabase = await createClient();
  await supabase
    .from('tour_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', shareId);

  revalidatePath(`/tours/${tourId}`);
}

export async function deleteTour(form: FormData): Promise<void> {
  const id = requiredText(form, 'id', 'Tour id');

  const supabase = await createClient();
  const { error } = await supabase.from('tours').delete().eq('id', id);

  if (error) {
    redirect(`/tours/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/tours');
  redirect('/tours');
}
