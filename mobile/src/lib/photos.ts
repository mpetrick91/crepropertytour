import { supabase } from './supabase';
import { PROPERTY_PHOTOS_BUCKET, TOUR_PHOTOS_BUCKET } from './types';

/** Long enough to walk a tour without re-signing, short enough that a leaked link dies. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Photos live in a private bucket, so they are read through expiring signed
 * links. Signed in one batch rather than one request per photo.
 */
export async function signedPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  if (!paths.length) return new Map();

  const { data } = await supabase.storage
    .from(TOUR_PHOTOS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  const entries: [string, string][] = [];
  for (const entry of data ?? []) {
    // Supabase reports per-path failures inline rather than throwing, so a
    // single missing object must not take out the whole batch.
    if (entry.path && entry.signedUrl) entries.push([entry.path, entry.signedUrl]);
  }
  return new Map(entries);
}

/**
 * Signed links for a building's photos, in one request rather than one each.
 * A path that cannot be signed is left out rather than throwing, so one
 * missing object shows as a single blank tile instead of an empty gallery.
 */
export async function signedPropertyPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  if (!paths.length) return new Map();

  const { data } = await supabase.storage
    .from(PROPERTY_PHOTOS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  const entries: [string, string][] = [];
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) entries.push([entry.path, entry.signedUrl]);
  }
  return new Map(entries);
}
