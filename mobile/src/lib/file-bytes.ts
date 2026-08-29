import { File } from 'expo-file-system';

/**
 * The bytes of a picked photo.
 *
 * `fetch(uri).arrayBuffer()` is the obvious way to do this and does not work
 * on a device: React Native's fetch does not implement arrayBuffer over a
 * `file://` response, so it yields an empty buffer. The upload then "succeeds"
 * with nothing in it, and the photo comes back blank -- which is exactly what
 * it did.
 *
 * expo-file-system reads the file directly, one photo at a time, so selecting
 * a dozen does not hold a dozen decoded images in memory at once.
 */
export async function readFileBytes(uri: string): Promise<Uint8Array> {
  const bytes = await new File(uri).bytes();

  if (!bytes.byteLength) {
    throw new Error('That photo could not be read from your device.');
  }
  return bytes;
}
