import { supabase } from './supabase';
import { TOUR_PHOTOS_BUCKET } from './types';

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
