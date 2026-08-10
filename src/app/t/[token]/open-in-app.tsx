'use client';

import { useState, useSyncExternalStore } from 'react';

const APP_STORE_URL = process.env.NEXT_PUBLIC_IOS_APP_URL ?? null;
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_ANDROID_APP_URL ?? null;

type Platform = 'ios' | 'android' | 'other';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

/**
 * The door between the web fallback and the app.
 *
 * A phone with the app installed never reaches this component -- the OS
 * intercepts the link first (Universal Links / App Links) and opens the app
 * straight at the tour. So anyone seeing this either has no app or is on a
 * desktop, and both need a real choice rather than a dead end: install, or
 * carry on here. Nobody is ever blocked from seeing the tour.
 */
export function OpenInApp({ token }: { token: string }) {
  const [dismissed, setDismissed] = useState(false);

  // The user agent is a client-only value that never changes, not state to
  // synchronise -- so it is read as an external snapshot rather than assigned
  // from an effect. The server snapshot is 'other', which renders nothing, so
  // the markup matches on hydration and no store link flashes on desktop.
  const platform = useSyncExternalStore<Platform>(
    () => () => {},
    detectPlatform,
    () => 'other',
  );

  const storeUrl =
    platform === 'ios' ? APP_STORE_URL : platform === 'android' ? PLAY_STORE_URL : null;

  // Nothing useful to offer until the app is published to that platform's store.
  if (dismissed || !storeUrl) return null;

  return (
    <div className="mb-6 rounded-lg border border-border bg-muted p-4">
      <p className="text-sm font-medium">Open this tour in the app</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Better for walking a building: take photos straight from the camera and keep your
        notes together.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={storeUrl}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white dark:text-[#0c0f13]"
        >
          Get the app
        </a>
        <a
          href={`crepropertytour://t/${token}`}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium"
        >
          I already have it
        </a>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-md px-3 py-2 text-sm text-muted-foreground"
        >
          Continue in browser
        </button>
      </div>
    </div>
  );
}
