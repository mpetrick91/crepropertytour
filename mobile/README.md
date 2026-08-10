# CRE Property Tour — mobile app

Expo / React Native app for iOS and Android. Talks to the same Supabase project
as the website, so the schema, row-level security, share links and photo storage
are shared — there is no second backend.

## What is here

| Screen | Who it is for |
|---|---|
| `app/login.tsx` | Broker magic-link sign-in |
| `app/tours/` | Tour list, builder, share links, recap |
| `app/properties/` | Building library, add and edit |
| `app/t/[token].tsx` | The client's whole experience: join, walk, note, photograph |

Brokers sign in. Clients never do — they open a link, get an anonymous Supabase
session, and trade the link token for a seat on that one tour. From then on
row-level security constrains them, not the token.

## Running it

```bash
cp .env.example .env      # same two values the website uses
npm install
npx expo start
```

Scan the QR code with Expo Go for a quick look. Anything touching deep links,
the camera, or a real sign-in needs a development build rather than Expo Go:

```bash
npx eas build --profile development --platform ios     # or android
```

## Deep links

A tour link is `https://crepropertytour.vercel.app/t/<token>`. Tapping it opens
the app directly once installed, via Universal Links on iOS and App Links on
Android. Without the app, the same URL opens the web version, which offers
"Get the app" or "Continue in browser" — a client is never blocked either way.

That handoff needs two files served from the website root, which the Next.js app
already has routes for. Both stay a 404 until their environment variable is set,
because publishing a malformed association file makes the OS cache the failure:

| Variable (set in Vercel) | Value |
|---|---|
| `IOS_APP_ID` | `<TeamID>.com.mpcorporaterealty.crepropertytour` |
| `ANDROID_CERT_FINGERPRINTS` | SHA-256 fingerprints, comma separated, from `eas credentials -p android` |
| `NEXT_PUBLIC_IOS_APP_URL` | App Store link, once published |
| `NEXT_PUBLIC_ANDROID_APP_URL` | Play Store link, once published |

Include Play App Signing's fingerprint too — Google re-signs uploads, so the
store build's fingerprint differs from a local one.

## Keeping types in step with the database

`src/lib/database.types.ts` is a copy of the website's generated types. After a
schema change, regenerate there and copy across:

```bash
cd .. && npm run db:types && cp src/lib/supabase/database.types.ts mobile/src/lib/database.types.ts
```

Aliases and helpers live in `src/lib/types.ts` and survive that copy.

## Notes on the port

- Hermes has no `crypto.randomUUID`, so photo keys use `expo-crypto`. The
  leading `<tour_id>/` in a key is load-bearing — every storage policy parses
  it — so build keys with `tourPhotoPath()`.
- The Supabase client sets `detectSessionInUrl: false`. There is no address bar
  on a phone; `app/_layout.tsx` reads the magic-link tokens off the deep link
  and hands them to `setSession` explicitly.
- Sessions persist in AsyncStorage, so a guest who joined last week is still on
  the tour when they reopen the app.
