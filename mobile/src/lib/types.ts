/**
 * Aliases over the generated schema types.
 *
 * Kept in step with the web app's src/lib/supabase/types.ts -- both talk to the
 * same database, so the shapes must not drift. `npm run sync:types` copies the
 * generated file across.
 */

import * as Crypto from 'expo-crypto';

import type { Database } from './database.types';

type Tables = Database['public']['Tables'];
type Views = Database['public']['Views'];
type Functions = Database['public']['Functions'];
type Enums = Database['public']['Enums'];

export type TourStatus = Enums['tour_status'];
export type ParticipantRole = Enums['participant_role'];
export type PropertyType = Enums['property_type'];
export type RentType = Enums['rent_type'];

export type Profile = Tables['profiles']['Row'];
export type Client = Tables['clients']['Row'];
export type Property = Tables['properties']['Row'];
export type Tour = Tables['tours']['Row'];
export type TourStop = Tables['tour_stops']['Row'];
export type TourShare = Tables['tour_shares']['Row'];
export type TourParticipant = Tables['tour_participants']['Row'];
export type StopNote = Tables['stop_notes']['Row'];
export type StopPhoto = Tables['stop_photos']['Row'];

export type PropertyInsert = Tables['properties']['Insert'];
export type TourInsert = Tables['tours']['Insert'];

/** Client-safe projections. Everything a guest is allowed to read. */
export type GuestTour = Views['guest_tours']['Row'];
export type GuestTourStop = Views['guest_tour_stops']['Row'];
export type GuestProperty = Views['guest_properties']['Row'];

export type ShareInvalidReason = 'not_found' | 'revoked' | 'expired';

export type TourSharePreview = Omit<Functions['preview_tour_share']['Returns'], 'reason'> & {
  reason: ShareInvalidReason | null;
};

export type TourJoinResult = Functions['join_tour']['Returns'];

export const TOUR_PHOTOS_BUCKET = 'tour-photos';

/**
 * Object key for a walkthrough photo. The leading tour id is not cosmetic --
 * every storage policy parses it -- so uploads must go through here.
 *
 * Uses expo-crypto rather than globalThis.crypto: Hermes does not ship
 * crypto.randomUUID, so the web app's version throws on device.
 */
export function tourPhotoPath(tourId: string, stopId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-96);
  return `${tourId}/${stopId}/${Crypto.randomUUID()}-${safeName}`;
}

export const PROPERTY_PHOTOS_BUCKET = 'property-photos';

/**
 * Object key for a building's cover photo. The leading broker id is what the
 * storage policy checks -- it is the whole of the access rule -- so uploads
 * must go through here rather than composing a path by hand.
 */
export function propertyPhotoPath(brokerId: string, propertyId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-96);
  return `${brokerId}/${propertyId}/${Crypto.randomUUID()}-${safeName}`;
}
