'use client';

import { useState } from 'react';

import { revokeShare } from '../actions';

type Share = {
  id: string;
  token: string;
  label: string | null;
  allow_notes: boolean;
  allow_photos: boolean;
  revoked_at: string | null;
};

export function ShareLink({
  tourId,
  share,
  origin,
}: {
  tourId: string;
  share: Share;
  origin: string;
}) {
  const [copied, setCopied] = useState(false);
  const url = `${origin}/t/${share.token}`;
  const revoked = Boolean(share.revoked_at);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked on insecure origins; the input is selectable.
    }
  }

  const permissions = [
    share.allow_notes ? 'notes' : null,
    share.allow_photos ? 'photos' : null,
  ].filter(Boolean);

  return (
    <li className={`rounded-lg border border-border p-3 ${revoked ? 'opacity-50' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{share.label ?? 'Tour link'}</p>
          <p className="text-xs text-muted-foreground">
            {revoked
              ? 'Revoked'
              : permissions.length
                ? `Can add ${permissions.join(' and ')}`
                : 'View only'}
          </p>
        </div>
        {!revoked ? (
          <form action={revokeShare}>
            <input type="hidden" name="tour_id" value={tourId} />
            <input type="hidden" name="share_id" value={share.id} />
            <button type="submit" className="text-xs text-muted-foreground underline">
              Revoke
            </button>
          </form>
        ) : null}
      </div>

      {!revoked ? (
        <div className="mt-2 flex gap-2">
          <input
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded-md border border-border bg-muted px-2 py-1.5 font-mono text-xs"
          />
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      ) : null}
    </li>
  );
}
