'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import { createClient } from '@/lib/supabase/client';
import { TOUR_PHOTOS_BUCKET, tourPhotoPath } from '@/lib/supabase/types';
import { buttonPrimary, buttonSecondary, errorText, input } from '@/lib/ui';

type NoteView = {
  id: string;
  body: string;
  rating: number | null;
  authorName: string;
  isMine: boolean;
};

type PhotoView = {
  id: string;
  url: string | null;
  caption: string | null;
  isMine: boolean;
};

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export function StopCard({
  index,
  tourId,
  stopId,
  participantId,
  canAddNotes,
  canAddPhotos,
  title,
  address,
  facts,
  description,
  brochureUrl,
  notes,
  photos,
}: {
  index: number;
  tourId: string;
  stopId: string;
  participantId: string;
  canAddNotes: boolean;
  canAddPhotos: boolean;
  title: string;
  address: string;
  facts: string[];
  description: string | null;
  brochureUrl: string | null;
  notes: NoteView[];
  photos: PhotoView[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const [body, setBody] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;

    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: insertError } = await supabase.from('stop_notes').insert({
      tour_id: tourId,
      stop_id: stopId,
      participant_id: participantId,
      body: body.trim(),
      rating,
    });

    if (insertError) {
      setError(insertError.message);
      setBusy(false);
      return;
    }

    setBody('');
    setRating(null);
    setBusy(false);
    refresh();
  }

  async function deleteNote(noteId: string) {
    const supabase = createClient();
    const { error: deleteError } = await supabase.from('stop_notes').delete().eq('id', noteId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    refresh();
  }

  async function uploadPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      setError('That photo is larger than 15 MB.');
      event.target.value = '';
      return;
    }

    setUploading(true);
    setError(null);

    const supabase = createClient();
    // Straight from the phone to storage. The tour id has to lead the key --
    // that is what the storage policies check.
    const path = tourPhotoPath(tourId, stopId, file.name);

    const { error: uploadError } = await supabase.storage
      .from(TOUR_PHOTOS_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      event.target.value = '';
      return;
    }

    const { error: rowError } = await supabase.from('stop_photos').insert({
      tour_id: tourId,
      stop_id: stopId,
      participant_id: participantId,
      storage_path: path,
      size_bytes: file.size,
    });

    if (rowError) {
      // Do not leave an orphan object behind if the row insert is refused.
      await supabase.storage.from(TOUR_PHOTOS_BUCKET).remove([path]);
      setError(rowError.message);
    }

    setUploading(false);
    event.target.value = '';
    refresh();
  }

  return (
    <li className="rounded-lg border border-border p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent text-xs font-semibold text-white dark:text-[#0c0f13]">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-medium">{title}</h2>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-muted-foreground underline decoration-dotted"
          >
            {address}
          </a>
          {facts.length ? (
            <p className="mt-1 text-sm text-muted-foreground">{facts.join(' · ')}</p>
          ) : null}
          {description ? <p className="mt-2 text-sm">{description}</p> : null}
          {brochureUrl ? (
            <a
              href={brochureUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm underline"
            >
              Brochure
            </a>
          ) : null}
        </div>
      </div>

      {photos.length ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {photos.map((photo) =>
            photo.url ? (
              // Signed URLs expire, so the Image optimizer would cache and then
              // re-serve a dead target.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.id}
                src={photo.url}
                alt={photo.caption ?? 'Tour photo'}
                className="aspect-square w-full rounded-md object-cover"
              />
            ) : (
              <div
                key={photo.id}
                className="flex aspect-square items-center justify-center rounded-md bg-muted text-xs text-muted-foreground"
              >
                …
              </div>
            ),
          )}
        </div>
      ) : null}

      {notes.length ? (
        <ul className="mt-4 space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md bg-muted p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {note.isMine ? 'You' : note.authorName}
                </span>
                <div className="flex items-center gap-2">
                  {note.rating ? (
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      {'★'.repeat(note.rating)}
                    </span>
                  ) : null}
                  {note.isMine ? (
                    <button
                      type="button"
                      onClick={() => deleteNote(note.id)}
                      className="text-xs text-muted-foreground underline"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{note.body}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {canAddNotes ? (
        <form onSubmit={addNote} className="mt-4 space-y-2">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={2}
            placeholder="What stood out here?"
            className={input}
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1" role="group" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} out of 5`}
                  aria-pressed={rating === value}
                  onClick={() => setRating(rating === value ? null : value)}
                  className={`text-lg leading-none ${
                    rating && value <= rating
                      ? 'text-amber-500'
                      : 'text-muted-foreground opacity-40'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={busy || !body.trim()}
              className={`${buttonPrimary} ml-auto`}
            >
              {busy ? 'Saving…' : 'Add note'}
            </button>
          </div>
        </form>
      ) : null}

      {canAddPhotos ? (
        <div className="mt-3">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={uploadPhoto}
            className="hidden"
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
            className={buttonSecondary}
          >
            {uploading ? 'Uploading…' : 'Add photo'}
          </button>
        </div>
      ) : null}

      {error ? <p className={`mt-2 ${errorText}`}>{error}</p> : null}
    </li>
  );
}
