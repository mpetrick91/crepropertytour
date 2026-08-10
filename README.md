# CRE Property Tour

Build a property tour itinerary, send the client one link, and get every note and
photo from the walkthrough back in one place.

**Where this is.** Phase 1 built the Supabase foundation — schema, row-level
security, share links, photo storage, broker auth. Phase 2 built the app on top
of it:

- **Properties** — a building library with the fields that come off a brochure
  or a CoStar export: SF, clear height, docks, rate and rent type, OpEx,
  listing contact.
- **Tours** — build an itinerary, reorder stops, attach a client, mint and
  revoke share links.
- **On the tour** — the client opens the link on their phone, adds notes with a
  1–5 rating, and uploads photos straight from the camera.
- **Recap** — every note and photo consolidated by stop, yours alongside
  theirs.

## The access model

Two kinds of user share one database:

| | Brokers | Clients (guests) |
|---|---|---|
| Account | Yes — magic-link email sign-in | **No account, ever** |
| Identity | Supabase user with a `profiles` row | Supabase *anonymous* user, no profile |
| How they get in | `/login` | The `/t/<token>` link you send them |
| Can see | Everything they own | Only the tour they redeemed a token for |
| Can write | Anything on their own tours | Notes and photos on that one tour |

A client opening a share link gets an anonymous Supabase session, then trades the
token for a row in `tour_participants`. From that moment they are an ordinary
authenticated user and **RLS**, not the token, is what constrains them. Revoking
a link stops new people joining; it does not evict anyone already on the tour.

### Broker-internal text never reaches a guest

`tours.notes`, `tour_stops.broker_notes` and `properties.notes` are yours —
negotiating position, what the landlord will take, which listing broker is slow.
RLS is row-level and cannot hide a column, so guests are denied `SELECT` on those
base tables outright and read the tour through three views instead:

- `guest_tours`
- `guest_tour_stops`
- `guest_properties`

Each view projects only client-safe columns and gates rows on
`is_tour_participant()`. Adding a broker-internal column to a base table is
therefore safe by default — it is invisible to guests until someone explicitly
adds it to a view. Use `properties.description` for the client-facing blurb.

## Schema

```
profiles ─┬─ clients
          ├─ properties ──┐
          └─ tours ───────┼─ tour_stops ─┬─ stop_notes
                          │              └─ stop_photos
                          ├─ tour_shares      (the link you send)
                          └─ tour_participants (who is on the tour)
```

`stop_notes` and `stop_photos` both carry `tour_id` alongside `stop_id` so RLS
and the storage policies stay single-hop; a trigger rejects any row whose
`tour_id` disagrees with its stop or its participant.

Photos live in the private `tour-photos` bucket under
`<tour_id>/<stop_id>/<uuid>-<name>`. That leading tour id is load-bearing —
every storage policy parses it — so build keys with `tourPhotoPath()` from
`src/lib/supabase/types.ts`. Images are served through short-lived signed URLs.

## Setup

### 1. Environment

```bash
cp .env.example .env.local
```

Fill it from the Supabase dashboard: the URL is under **Project Settings → Data
API**, the key is the **Publishable key** under **Project Settings → API Keys**
(older projects call it the `anon` key). The optional
secret / `service_role` key bypasses RLS and is not used by the app — leave it unset.

### 2. Turn on anonymous sign-ins

The guest flow does not work without this. In the dashboard:
**Authentication → Sign In / Up → Anonymous sign-ins → enable.**

While you are there, set **Authentication → URL Configuration → Site URL** to
your deployed origin and add `http://localhost:3000/auth/callback` to the
redirect allow-list.

### 3. Push the schema

Without a terminal: open `supabase/setup.sql`, copy the whole file, paste it into
the dashboard's **SQL Editor** and run it once. That file is the migrations
concatenated in order and produces the same schema.

With the CLI, which is what you want once the project is live and migrations
start stacking up:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run db:push
```

Then regenerate the types so they track the live schema:

```bash
npm run db:types
```

That overwrites `src/lib/supabase/database.types.ts`. Hand-written aliases live
in `src/lib/supabase/types.ts` and survive regeneration — import from there.

### 4. Run it

```bash
npm run dev
```

## Working locally

With Docker running you can develop against a local stack instead of the hosted
project:

```bash
npm run db:start   # boots Postgres, Auth, Storage, Studio
npm run db:reset   # re-applies every migration, then supabase/seed.sql
```

The seed creates a broker (`michael@example.com`), two Columbus industrial
properties, a scheduled tour, and a share link with a fixed token:

- Broker: sign in at `/login`, then grab the magic link from Inbucket at
  <http://localhost:54324>
- Guest: <http://localhost:3000/t/local-dev-share-token-000000>

## Tests

The security model is the part worth testing, so it has a suite:

```bash
npm run db:test
```

70 assertions covering tenant isolation between brokers, what a guest can and
cannot read, the internal-notes boundary, storage path enforcement, join
idempotency, revocation, itinerary reordering permissions, one guest editing
another's notes, view-only links, archived tours, and the data-integrity
triggers. It runs against the local stack by default;
`DATABASE_URL=... ./scripts/run-rls-tests.sh --shim` runs it against a bare
Postgres using the stand-in schemas in `supabase/tests/00_supabase_shim.sql`.

**The suite writes and deletes rows — never point it at a database with real
tours in it.**

Also: `npm run typecheck`, `npm run lint`, `npm run build`.

## Layout

```
src/
  proxy.ts                     session refresh + broker route guard
  lib/env.ts                   env access with useful failure messages
  lib/supabase/
    client.ts                  browser client
    server.ts                  server client + getBroker()
    proxy.ts                   the session-refresh implementation
    admin.ts                   service-role client (bypasses RLS)
    database.types.ts          generated — do not hand-edit
    types.ts                   hand-written aliases and helpers
  lib/form.ts                  FormData coercion for server actions
  lib/ui.ts                    shared class strings and formatters
  app/
    login/                     magic-link sign-in
    auth/callback/             code-for-session exchange
    (broker)/                  everything behind sign-in
      dashboard/
      properties/              library, create, edit
      tours/                   list, builder, share links, recap
    t/[token]/                 guest join + tour view + capture
supabase/
  migrations/                  schema, RLS, share links, storage, ordering
  tests/                       RLS assertions
  seed.sql                     local dev data
```
