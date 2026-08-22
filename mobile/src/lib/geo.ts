import * as Location from 'expo-location';

import type { Point } from './distance';

/**
 * Working out which building you are standing in front of.
 *
 * Deliberately foreground-only: this watches your position while the tour is
 * open on screen and stops the moment it is not. Background geofencing would
 * follow a broker around all day for a feature that matters for three hours,
 * and would put the app in front of the App Store review that asks why it
 * needs to. Walking a tour means the phone is out anyway.
 *
 * The arithmetic lives in distance.ts, which has no platform behind it.
 */

export { ARRIVAL_METRES, distanceMetres, formatDistance, MAX_ACCURACY_METRES, nearest } from './distance';
export type { Located, Point } from './distance';

export type PermissionOutcome =
  | { granted: true }
  | { granted: false; message: string };

export async function requestForegroundLocation(): Promise<PermissionOutcome> {
  const existing = await Location.getForegroundPermissionsAsync();
  const permission = existing.granted
    ? existing
    : await Location.requestForegroundPermissionsAsync();

  if (permission.granted) return { granted: true };

  return {
    granted: false,
    message: permission.canAskAgain
      ? 'Location is needed to follow the tour. Allow it when the prompt appears.'
      : 'Location is off for this app. Turn it on in Settings → Privacy → Location Services to follow the tour automatically.',
  };
}

/**
 * Turns an address into coordinates using the platform's own geocoder -- no
 * API key, no billing account. Returns null rather than throwing: a building
 * that cannot be placed simply does not take part in the automatic switching.
 */
export async function geocodeAddress(address: string): Promise<Point | null> {
  try {
    const results = await Location.geocodeAsync(address);
    const first = results[0];
    return first ? { latitude: first.latitude, longitude: first.longitude } : null;
  } catch {
    return null;
  }
}

export { Location };

/**
 * Fills in coordinates for an address that has none.
 *
 * Called when a building is saved, because automatic switching is only
 * possible for buildings the app can place. Failure is silent by design: a
 * geocoder that cannot find an address must not stop a broker saving it, so
 * the row is written without coordinates and simply sits out the following.
 */
export async function withCoordinates<
  T extends {
    address_line1: string;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  },
>(draft: T): Promise<T> {
  if (draft.latitude != null && draft.longitude != null) return draft;

  const address = [draft.address_line1, draft.city, draft.state, draft.postal_code]
    .filter(Boolean)
    .join(', ');
  if (!address.trim()) return draft;

  const point = await geocodeAddress(address);
  return point ? { ...draft, latitude: point.latitude, longitude: point.longitude } : draft;
}
