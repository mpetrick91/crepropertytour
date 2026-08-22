/**
 * Geometry, with no platform behind it.
 *
 * Kept apart from geo.ts so the arithmetic that decides which building you are
 * standing at can be tested on its own, without a device or a location
 * provider in the way.
 */

export type Point = { latitude: number; longitude: number };

/**
 * How close counts as "here". Big enough to cover a parking lot and the drift
 * of a phone GPS between buildings, small enough that two options on the same
 * business park do not both match.
 */
export const ARRIVAL_METRES = 120;

/** Beyond this, a fix is too vague to switch stops on. */
export const MAX_ACCURACY_METRES = 75;

/** Metres between two coordinates. Haversine; the earth is close enough to round. */
export function distanceMetres(a: Point, b: Point): number {
  const R = 6_371_000;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type Located<T> = T & Point;

/**
 * The closest candidate and how far away it is. Returns null only when there
 * are no candidates -- the caller decides whether the distance is close enough
 * to act on, because "nearest" and "arrived" are different questions.
 */
export function nearest<T>(
  from: Point,
  candidates: Located<T>[],
): { item: Located<T>; metres: number } | null {
  let best: { item: Located<T>; metres: number } | null = null;

  for (const candidate of candidates) {
    const metres = distanceMetres(from, candidate);
    if (!best || metres < best.metres) best = { item: candidate, metres };
  }

  return best;
}

/** "40 m" up close, "1.2 km" further out. */
export function formatDistance(metres: number): string {
  if (metres < 950) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}
