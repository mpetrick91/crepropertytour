-- =====================================================================
-- CRE Property Tour — complete database setup
--
-- Paste this whole file into the Supabase SQL Editor and press Run.
-- It is the five migration files in supabase/migrations/ concatenated in
-- order, so running it once on a fresh project produces the same result
-- as running the migrations.
--
-- Safe to run once on a NEW project. Re-running it on a project that
-- already has these tables will error on the first `create table` --
-- that is intentional, so it cannot silently damage live data.
--
-- The storage section is last on purpose: if your project restricts
-- policy creation on storage.objects, everything above it has already
-- succeeded and only the photo bucket needs setting up by hand.
-- =====================================================================



-- =====================================================================
-- 20260810120000_initial_schema.sql
-- =====================================================================

-- Core schema for CRE Property Tour.
--
-- Model: a broker (an authenticated Supabase user) owns clients, properties and
-- tours. A tour is an ordered list of stops, each pointing at a property.
-- Clients join a tour through an unguessable share link -- they never create an
-- account. Everything a guest writes (notes, photos) is attributed to a
-- participant row so the broker can consolidate feedback per stop afterwards.

create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.tour_status as enum (
  'draft',
  'scheduled',
  'in_progress',
  'completed',
  'archived'
);

create type public.participant_role as enum (
  'broker',
  'guest'
);

create type public.property_type as enum (
  'office',
  'industrial',
  'flex',
  'retail',
  'land',
  'other'
);

-- How a quoted rate should be read. Mirrors how rates come across on brochures.
create type public.rent_type as enum (
  'base',
  'nnn',
  'gross',
  'modified_gross',
  'negotiable'
);

-- ---------------------------------------------------------------------------
-- Shared trigger helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per broker. Anonymous (guest) users deliberately do NOT
-- get a profile -- that absence is what keeps them out of broker-owned data.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  company text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Provision a profile whenever a real (non-anonymous) user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_anonymous then
    return new;
  end if;

  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- clients: the tenant/company a broker is running a search for.
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  broker_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_broker_id_idx on public.clients (broker_id);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- properties: the broker's own record of a building/suite. Sourced from CoStar
-- exports, brochures or listing-broker confirmations.
-- ---------------------------------------------------------------------------

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  broker_id uuid not null references public.profiles (id) on delete cascade,

  name text,
  address_line1 text not null,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text not null default 'US',
  latitude double precision,
  longitude double precision,

  property_type public.property_type not null default 'other',
  building_size_sf integer,
  available_sf integer,
  office_sf integer,
  clear_height_ft numeric(5, 1),
  dock_doors integer,
  drive_in_doors integer,
  power text,
  year_built integer,
  parking text,

  -- Quoted economics. Rates are per SF per year unless the brochure says
  -- otherwise; rent_type records how the number should be read.
  rent_rate numeric(10, 2),
  rent_type public.rent_type,
  op_ex numeric(10, 2),
  available_date date,
  lease_term text,

  listing_broker_name text,
  listing_broker_company text,
  listing_broker_email text,
  listing_broker_phone text,

  brochure_url text,
  listing_url text,

  -- `description` is client-facing and surfaced on the guest tour view.
  -- `notes` is the broker's internal record and is never exposed to guests.
  description text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint properties_building_size_sf_check check (building_size_sf is null or building_size_sf >= 0),
  constraint properties_available_sf_check check (available_sf is null or available_sf >= 0),
  constraint properties_latitude_check check (latitude is null or latitude between -90 and 90),
  constraint properties_longitude_check check (longitude is null or longitude between -180 and 180)
);

create index properties_broker_id_idx on public.properties (broker_id);

create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tours
-- ---------------------------------------------------------------------------

create table public.tours (
  id uuid primary key default gen_random_uuid(),
  broker_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,

  title text not null,
  status public.tour_status not null default 'draft',
  tour_date date,
  start_time time,
  market text,
  requirement_summary text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tours_broker_id_idx on public.tours (broker_id);
create index tours_client_id_idx on public.tours (client_id);

create trigger tours_set_updated_at
  before update on public.tours
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tour_stops: the ordered itinerary.
-- ---------------------------------------------------------------------------

create table public.tour_stops (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete restrict,

  position integer not null,
  scheduled_at timestamptz,
  duration_minutes integer,
  broker_notes text,
  visited_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tour_stops_position_check check (position >= 0),
  constraint tour_stops_unique_property unique (tour_id, property_id)
);

-- Ordering is unique per tour, but deferrable so a whole itinerary can be
-- resequenced in one statement without tripping over itself mid-update.
alter table public.tour_stops
  add constraint tour_stops_unique_position unique (tour_id, position)
  deferrable initially deferred;

create index tour_stops_tour_id_idx on public.tour_stops (tour_id, position);
create index tour_stops_property_id_idx on public.tour_stops (property_id);

create trigger tour_stops_set_updated_at
  before update on public.tour_stops
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tour_shares: the link a client opens. One tour can have several (e.g. one
-- for the CEO, one for facilities) so a single link can be revoked in isolation.
-- ---------------------------------------------------------------------------

create table public.tour_shares (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours (id) on delete cascade,
  token text not null unique,
  label text,
  allow_notes boolean not null default true,
  allow_photos boolean not null default true,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint tour_shares_token_length_check check (char_length(token) between 16 and 128)
);

create index tour_shares_tour_id_idx on public.tour_shares (tour_id);

-- ---------------------------------------------------------------------------
-- tour_participants: who is on the tour. The broker gets a row on tour create;
-- each guest gets one when they redeem a share link after an anonymous sign-in.
-- ---------------------------------------------------------------------------

create table public.tour_participants (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  share_id uuid references public.tour_shares (id) on delete set null,

  role public.participant_role not null default 'guest',
  display_name text not null,
  company text,
  removed_at timestamptz,

  -- Copied from the share link at join time so a single policy check covers
  -- "is this person allowed to contribute this kind of thing".
  can_add_notes boolean not null default true,
  can_add_photos boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tour_participants_unique_user unique (tour_id, user_id),
  constraint tour_participants_display_name_check check (char_length(trim(display_name)) between 1 and 80)
);

create index tour_participants_tour_id_idx on public.tour_participants (tour_id);
create index tour_participants_user_id_idx on public.tour_participants (user_id);

create trigger tour_participants_set_updated_at
  before update on public.tour_participants
  for each row execute function public.set_updated_at();

-- The broker is a participant on their own tour, so their notes and photos
-- flow through exactly the same tables as the client's.
create or replace function public.add_broker_as_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tour_participants (tour_id, user_id, role, display_name, company)
  select
    new.id,
    new.broker_id,
    'broker',
    coalesce(nullif(trim(p.full_name), ''), nullif(p.email, ''), 'Broker'),
    p.company
  from public.profiles p
  where p.id = new.broker_id
  on conflict (tour_id, user_id) do nothing;

  return new;
end;
$$;

create trigger tours_add_broker_participant
  after insert on public.tours
  for each row execute function public.add_broker_as_participant();

-- ---------------------------------------------------------------------------
-- stop_notes / stop_photos: what participants capture while walking a building.
-- tour_id is denormalised onto both so RLS and storage checks stay single-hop.
-- ---------------------------------------------------------------------------

create table public.stop_notes (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours (id) on delete cascade,
  stop_id uuid not null references public.tour_stops (id) on delete cascade,
  participant_id uuid not null references public.tour_participants (id) on delete cascade,

  body text not null,
  rating smallint,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stop_notes_body_check check (char_length(trim(body)) > 0),
  constraint stop_notes_rating_check check (rating is null or rating between 1 and 5)
);

create index stop_notes_tour_id_idx on public.stop_notes (tour_id);
create index stop_notes_stop_id_idx on public.stop_notes (stop_id, created_at);
create index stop_notes_participant_id_idx on public.stop_notes (participant_id);

create trigger stop_notes_set_updated_at
  before update on public.stop_notes
  for each row execute function public.set_updated_at();

create table public.stop_photos (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours (id) on delete cascade,
  stop_id uuid not null references public.tour_stops (id) on delete cascade,
  participant_id uuid not null references public.tour_participants (id) on delete cascade,

  -- Object key inside the private `tour-photos` bucket, always `<tour_id>/...`.
  storage_path text not null unique,
  caption text,
  width integer,
  height integer,
  size_bytes integer,
  taken_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stop_photos_tour_id_idx on public.stop_photos (tour_id);
create index stop_photos_stop_id_idx on public.stop_photos (stop_id, created_at);
create index stop_photos_participant_id_idx on public.stop_photos (participant_id);

create trigger stop_photos_set_updated_at
  before update on public.stop_photos
  for each row execute function public.set_updated_at();

-- Keep the denormalised tour_id honest: it must match the stop's own tour, and
-- the participant must belong to that same tour.
create or replace function public.enforce_contribution_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stop_tour_id uuid;
  v_participant_tour_id uuid;
begin
  select tour_id into v_stop_tour_id
  from public.tour_stops
  where id = new.stop_id;

  if v_stop_tour_id is null or v_stop_tour_id <> new.tour_id then
    raise exception 'stop % does not belong to tour %', new.stop_id, new.tour_id;
  end if;

  select tour_id into v_participant_tour_id
  from public.tour_participants
  where id = new.participant_id;

  if v_participant_tour_id is null or v_participant_tour_id <> new.tour_id then
    raise exception 'participant % does not belong to tour %', new.participant_id, new.tour_id;
  end if;

  return new;
end;
$$;

create trigger stop_notes_enforce_consistency
  before insert or update on public.stop_notes
  for each row execute function public.enforce_contribution_consistency();

create trigger stop_photos_enforce_consistency
  before insert or update on public.stop_photos
  for each row execute function public.enforce_contribution_consistency();

-- =====================================================================
-- 20260810120100_rls_policies.sql
-- =====================================================================

-- Row Level Security.
--
-- Two kinds of authenticated user share this database:
--
--   * brokers  -- real accounts, own their clients/properties/tours, and have a
--                 row in public.profiles.
--   * guests   -- anonymous sign-ins created when a client opens a share link.
--                 No profile row, no ownership, and access strictly limited to
--                 the one tour they redeemed a token for.
--
-- Broker-internal text (tour_stops.broker_notes, properties.notes, tours.notes,
-- share tokens) must never reach a guest. Rather than trying to hide columns
-- with RLS -- which is row-level, not column-level -- guests are denied SELECT
-- on those base tables entirely and read the tour through the `guest_*` views
-- at the bottom of this file, which project only client-safe columns.

-- ---------------------------------------------------------------------------
-- Helper predicates.
--
-- All SECURITY DEFINER: policies on tour_participants need to query
-- tour_participants, which would recurse if the helper were subject to RLS.
-- ---------------------------------------------------------------------------

create or replace function public.is_tour_owner(p_tour_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tours t
    where t.id = p_tour_id
      and t.broker_id = (select auth.uid())
  );
$$;

create or replace function public.is_tour_participant(p_tour_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tour_participants tp
    where tp.tour_id = p_tour_id
      and tp.user_id = (select auth.uid())
      and tp.removed_at is null
  );
$$;

-- The caller's participant row on a given tour, used to stamp contributions.
create or replace function public.current_participant_id(p_tour_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select tp.id
  from public.tour_participants tp
  where tp.tour_id = p_tour_id
    and tp.user_id = (select auth.uid())
    and tp.removed_at is null;
$$;

create or replace function public.can_contribute(p_tour_id uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tour_participants tp
    join public.tours t on t.id = tp.tour_id
    where tp.tour_id = p_tour_id
      and tp.user_id = (select auth.uid())
      and tp.removed_at is null
      and t.status <> 'archived'
      and case p_kind
            when 'note' then tp.can_add_notes
            when 'photo' then tp.can_add_photos
            else false
          end
  );
$$;

-- Non-null uuid cast that yields null instead of raising, for storage paths
-- whose first segment may be anything a client uploads.
create or replace function public.safe_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::uuid;
exception
  when others then
    return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere. No table is left open.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.properties enable row level security;
alter table public.tours enable row level security;
alter table public.tour_stops enable row level security;
alter table public.tour_shares enable row level security;
alter table public.tour_participants enable row level security;
alter table public.stop_notes enable row level security;
alter table public.stop_photos enable row level security;

-- ---------------------------------------------------------------------------
-- profiles -- a broker sees and edits only their own.
-- ---------------------------------------------------------------------------

create policy "Users read own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Users update own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Users insert own profile"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- clients -- broker-owned, never guest-visible.
-- ---------------------------------------------------------------------------

create policy "Brokers manage own clients"
  on public.clients for all
  to authenticated
  using (broker_id = (select auth.uid()))
  with check (broker_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- properties -- broker-owned. Guests read the client-safe projection via
-- public.guest_properties instead.
-- ---------------------------------------------------------------------------

create policy "Brokers manage own properties"
  on public.properties for all
  to authenticated
  using (broker_id = (select auth.uid()))
  with check (broker_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- tours / tour_stops -- broker-owned base tables.
-- ---------------------------------------------------------------------------

create policy "Brokers manage own tours"
  on public.tours for all
  to authenticated
  using (broker_id = (select auth.uid()))
  with check (broker_id = (select auth.uid()));

create policy "Brokers manage own tour stops"
  on public.tour_stops for all
  to authenticated
  using (public.is_tour_owner(tour_id))
  with check (public.is_tour_owner(tour_id));

-- ---------------------------------------------------------------------------
-- tour_shares -- tokens are secrets. Owner only, no guest access at all.
-- ---------------------------------------------------------------------------

create policy "Brokers manage own tour shares"
  on public.tour_shares for all
  to authenticated
  using (public.is_tour_owner(tour_id))
  with check (public.is_tour_owner(tour_id) and created_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- tour_participants -- everyone on a tour can see who else is on it (names and
-- company only; the table holds nothing sensitive). Rows are created by
-- public.join_tour(), never by direct insert.
-- ---------------------------------------------------------------------------

create policy "Participants read the roster"
  on public.tour_participants for select
  to authenticated
  using (public.is_tour_participant(tour_id));

create policy "Participants rename themselves"
  on public.tour_participants for update
  to authenticated
  using (user_id = (select auth.uid()) and removed_at is null)
  with check (user_id = (select auth.uid()));

create policy "Brokers manage the roster"
  on public.tour_participants for all
  to authenticated
  using (public.is_tour_owner(tour_id))
  with check (public.is_tour_owner(tour_id));

-- ---------------------------------------------------------------------------
-- stop_notes / stop_photos -- the shared record of the walkthrough.
--
-- Everyone on the tour reads everything (client stakeholders comparing takes
-- during the drive between buildings is the point). You may only write rows
-- stamped with your own participant id, and only edit or delete your own.
-- The broker, as owner, can moderate anything on their tour.
-- ---------------------------------------------------------------------------

create policy "Participants read tour notes"
  on public.stop_notes for select
  to authenticated
  using (public.is_tour_participant(tour_id));

create policy "Participants add own notes"
  on public.stop_notes for insert
  to authenticated
  with check (
    participant_id = public.current_participant_id(tour_id)
    and public.can_contribute(tour_id, 'note')
  );

create policy "Participants edit own notes"
  on public.stop_notes for update
  to authenticated
  using (participant_id = public.current_participant_id(tour_id))
  with check (participant_id = public.current_participant_id(tour_id));

create policy "Participants delete own notes"
  on public.stop_notes for delete
  to authenticated
  using (participant_id = public.current_participant_id(tour_id));

create policy "Brokers moderate tour notes"
  on public.stop_notes for all
  to authenticated
  using (public.is_tour_owner(tour_id))
  with check (public.is_tour_owner(tour_id));

create policy "Participants read tour photos"
  on public.stop_photos for select
  to authenticated
  using (public.is_tour_participant(tour_id));

create policy "Participants add own photos"
  on public.stop_photos for insert
  to authenticated
  with check (
    participant_id = public.current_participant_id(tour_id)
    and public.can_contribute(tour_id, 'photo')
    and public.safe_uuid(split_part(storage_path, '/', 1)) = tour_id
  );

create policy "Participants edit own photos"
  on public.stop_photos for update
  to authenticated
  using (participant_id = public.current_participant_id(tour_id))
  with check (participant_id = public.current_participant_id(tour_id));

create policy "Participants delete own photos"
  on public.stop_photos for delete
  to authenticated
  using (participant_id = public.current_participant_id(tour_id));

create policy "Brokers moderate tour photos"
  on public.stop_photos for all
  to authenticated
  using (public.is_tour_owner(tour_id))
  with check (public.is_tour_owner(tour_id));

-- ---------------------------------------------------------------------------
-- Guest read surface.
--
-- These views run with the definer's rights (security_invoker is off, the
-- default), so they bypass the owner-only policies above. Access is gated by
-- the is_tour_participant() predicate baked into each WHERE clause, and the
-- column list is the contract: anything broker-internal is simply not selected.
-- ---------------------------------------------------------------------------

create view public.guest_tours as
select
  t.id,
  t.title,
  t.status,
  t.tour_date,
  t.start_time,
  t.market,
  t.requirement_summary
from public.tours t
where public.is_tour_participant(t.id);

create view public.guest_tour_stops as
select
  s.id,
  s.tour_id,
  s.property_id,
  s.position,
  s.scheduled_at,
  s.duration_minutes,
  s.visited_at
from public.tour_stops s
where public.is_tour_participant(s.tour_id);

create view public.guest_properties as
select
  p.id,
  p.name,
  p.address_line1,
  p.address_line2,
  p.city,
  p.state,
  p.postal_code,
  p.country,
  p.latitude,
  p.longitude,
  p.property_type,
  p.building_size_sf,
  p.available_sf,
  p.office_sf,
  p.clear_height_ft,
  p.dock_doors,
  p.drive_in_doors,
  p.power,
  p.year_built,
  p.parking,
  p.rent_rate,
  p.rent_type,
  p.op_ex,
  p.available_date,
  p.lease_term,
  p.brochure_url,
  p.description
from public.properties p
where exists (
  select 1
  from public.tour_stops s
  where s.property_id = p.id
    and public.is_tour_participant(s.tour_id)
);

revoke all on public.guest_tours from anon, authenticated;
revoke all on public.guest_tour_stops from anon, authenticated;
revoke all on public.guest_properties from anon, authenticated;

grant select on public.guest_tours to authenticated;
grant select on public.guest_tour_stops to authenticated;
grant select on public.guest_properties to authenticated;

-- =====================================================================
-- 20260810120200_share_links.sql
-- =====================================================================

-- Share links: how a client gets onto a tour without ever creating an account.
--
-- Flow:
--   1. Broker creates a share  -> public.create_tour_share() returns a token.
--   2. Client opens /t/<token> -> public.preview_tour_share() renders the tour
--                                 header for an unauthenticated visitor.
--   3. Client enters their name -> the browser does an anonymous sign-in, then
--                                 calls public.join_tour(), which trades the
--                                 token for a tour_participants row.
--   4. From then on the guest is an ordinary authenticated user and every read
--      and write is governed by the RLS policies, not by the token.

-- URL-safe random token. 24 bytes of entropy, base64url, no padding.
create or replace function public.generate_share_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select rtrim(
    translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'),
    '='
  );
$$;

alter table public.tour_shares
  alter column token set default public.generate_share_token();

-- A share is redeemable only while it is neither revoked nor expired.
create or replace function public.share_is_active(s public.tour_shares)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select s.revoked_at is null
     and (s.expires_at is null or s.expires_at > now());
$$;

-- ---------------------------------------------------------------------------
-- create_tour_share -- broker-only. Runs as invoker so the tour_shares RLS
-- policy is what actually authorises it.
-- ---------------------------------------------------------------------------

create or replace function public.create_tour_share(
  p_tour_id uuid,
  p_label text default null,
  p_allow_notes boolean default true,
  p_allow_photos boolean default true,
  p_expires_at timestamptz default null
)
returns public.tour_shares
language plpgsql
set search_path = ''
as $$
declare
  v_share public.tour_shares;
begin
  insert into public.tour_shares (
    tour_id, token, label, allow_notes, allow_photos, expires_at, created_by
  )
  values (
    p_tour_id,
    public.generate_share_token(),
    nullif(trim(coalesce(p_label, '')), ''),
    p_allow_notes,
    p_allow_photos,
    p_expires_at,
    (select auth.uid())
  )
  returning * into v_share;

  return v_share;
end;
$$;

-- ---------------------------------------------------------------------------
-- preview_tour_share -- the only thing an unauthenticated visitor may call.
-- Returns just enough to render "You've been invited to tour 3 buildings in
-- Columbus on Aug 14", and never leaks the token back or anything internal.
-- ---------------------------------------------------------------------------

create type public.tour_share_preview as (
  valid boolean,
  reason text,
  tour_id uuid,
  tour_title text,
  tour_date date,
  start_time time,
  market text,
  stop_count integer,
  broker_name text,
  broker_company text,
  allow_notes boolean,
  allow_photos boolean
);

create or replace function public.preview_tour_share(p_token text)
returns public.tour_share_preview
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_share public.tour_shares;
  v_tour public.tours;
  v_profile public.profiles;
  v_result public.tour_share_preview;
begin
  select * into v_share
  from public.tour_shares
  where token = p_token;

  if not found then
    return (false, 'not_found', null, null, null, null, null, null, null, null, null, null)::public.tour_share_preview;
  end if;

  if v_share.revoked_at is not null then
    return (false, 'revoked', null, null, null, null, null, null, null, null, null, null)::public.tour_share_preview;
  end if;

  if v_share.expires_at is not null and v_share.expires_at <= now() then
    return (false, 'expired', null, null, null, null, null, null, null, null, null, null)::public.tour_share_preview;
  end if;

  select * into v_tour from public.tours where id = v_share.tour_id;
  select * into v_profile from public.profiles where id = v_tour.broker_id;

  v_result := (
    true,
    null,
    v_tour.id,
    v_tour.title,
    v_tour.tour_date,
    v_tour.start_time,
    v_tour.market,
    (select count(*)::integer from public.tour_stops s where s.tour_id = v_tour.id),
    v_profile.full_name,
    v_profile.company,
    v_share.allow_notes,
    v_share.allow_photos
  )::public.tour_share_preview;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_tour -- trades a valid token for a participant row on the caller's
-- current (usually anonymous) identity. Idempotent: reopening the link on the
-- same device returns the existing participant instead of duplicating it.
-- ---------------------------------------------------------------------------

create type public.tour_join_result as (
  tour_id uuid,
  participant_id uuid,
  display_name text,
  role public.participant_role,
  can_add_notes boolean,
  can_add_photos boolean
);

create or replace function public.join_tour(
  p_token text,
  p_display_name text,
  p_company text default null
)
returns public.tour_join_result
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_share public.tour_shares;
  v_name text := nullif(trim(coalesce(p_display_name, '')), '');
  v_participant public.tour_participants;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if v_name is null then
    raise exception 'display name is required' using errcode = '22023';
  end if;

  select * into v_share
  from public.tour_shares
  where token = p_token;

  if not found or not public.share_is_active(v_share) then
    raise exception 'this tour link is no longer valid' using errcode = '42501';
  end if;

  select * into v_participant
  from public.tour_participants
  where tour_id = v_share.tour_id
    and user_id = v_uid;

  if found then
    -- Already on the tour (broker reopening their own link, or a guest coming
    -- back). Refresh their name but never escalate or downgrade their role.
    update public.tour_participants
    set display_name = v_name,
        company = coalesce(nullif(trim(coalesce(p_company, '')), ''), company),
        removed_at = null
    where id = v_participant.id
    returning * into v_participant;
  else
    insert into public.tour_participants (
      tour_id, user_id, share_id, role, display_name, company,
      can_add_notes, can_add_photos
    )
    values (
      v_share.tour_id,
      v_uid,
      v_share.id,
      'guest',
      v_name,
      nullif(trim(coalesce(p_company, '')), ''),
      v_share.allow_notes,
      v_share.allow_photos
    )
    returning * into v_participant;
  end if;

  return (
    v_participant.tour_id,
    v_participant.id,
    v_participant.display_name,
    v_participant.role,
    v_participant.can_add_notes,
    v_participant.can_add_photos
  )::public.tour_join_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execute grants. Default is EXECUTE to PUBLIC, which would hand anonymous
-- visitors the SECURITY DEFINER helpers -- so revoke first, then grant narrowly.
-- ---------------------------------------------------------------------------

revoke execute on function public.generate_share_token() from public;
revoke execute on function public.share_is_active(public.tour_shares) from public;
revoke execute on function public.create_tour_share(uuid, text, boolean, boolean, timestamptz) from public;
revoke execute on function public.preview_tour_share(text) from public;
revoke execute on function public.join_tour(text, text, text) from public;
revoke execute on function public.is_tour_owner(uuid) from public;
revoke execute on function public.is_tour_participant(uuid) from public;
revoke execute on function public.current_participant_id(uuid) from public;
revoke execute on function public.can_contribute(uuid, text) from public;

grant execute on function public.create_tour_share(uuid, text, boolean, boolean, timestamptz) to authenticated;
grant execute on function public.join_tour(text, text, text) to authenticated;

-- The RLS policies call these, and a policy's function calls are permission
-- checked against the invoking role -- so `authenticated` needs EXECUTE or
-- every policied query fails. They only ever report on the caller's own
-- access, so granting them is not a disclosure.
grant execute on function public.is_tour_owner(uuid) to authenticated;
grant execute on function public.is_tour_participant(uuid) to authenticated;
grant execute on function public.current_participant_id(uuid) to authenticated;
grant execute on function public.can_contribute(uuid, text) to authenticated;

-- The one call an unauthenticated visitor is allowed to make.
grant execute on function public.preview_tour_share(text) to anon, authenticated;

-- =====================================================================
-- 20260810120400_tour_ordering.sql
-- =====================================================================

-- Reordering an itinerary.
--
-- tour_stops.position is unique per tour, so moving a stop by writing rows one
-- at a time collides with whatever currently holds the target position. The
-- unique constraint is DEFERRABLE INITIALLY DEFERRED precisely so the whole new
-- order can be written in a single statement and checked once at commit.
--
-- SECURITY INVOKER: the tour_stops policies are what authorise this, so a
-- broker can only ever resequence their own tour.

create or replace function public.reorder_tour_stops(
  p_tour_id uuid,
  p_stop_ids uuid[]
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_updated integer;
  v_total integer;
begin
  select count(*) into v_total
  from public.tour_stops
  where tour_id = p_tour_id;

  if v_total <> coalesce(array_length(p_stop_ids, 1), 0) then
    raise exception 'reorder must list every stop on the tour (% given, % on tour)',
      coalesce(array_length(p_stop_ids, 1), 0), v_total
      using errcode = '22023';
  end if;

  update public.tour_stops s
  set position = ordered.ord
  from unnest(p_stop_ids) with ordinality as ordered(stop_id, ord)
  where s.id = ordered.stop_id
    and s.tour_id = p_tour_id;

  get diagnostics v_updated = row_count;

  -- A stop id from another tour (or one RLS hides) simply matches nothing, so
  -- compare counts rather than trusting the input.
  if v_updated <> v_total then
    raise exception 'reorder did not match every stop on the tour'
      using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.reorder_tour_stops(uuid, uuid[]) from public;
grant execute on function public.reorder_tour_stops(uuid, uuid[]) to authenticated;

-- Next free position on a tour, so adding a stop does not need a round trip.
create or replace function public.next_stop_position(p_tour_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(max(position), 0) + 1
  from public.tour_stops
  where tour_id = p_tour_id;
$$;

revoke execute on function public.next_stop_position(uuid) from public;
grant execute on function public.next_stop_position(uuid) to authenticated;

-- =====================================================================
-- 20260810120300_storage.sql
-- =====================================================================

-- Private bucket for photos taken on a walkthrough.
--
-- Object keys are always `<tour_id>/<stop_id>/<uuid>.<ext>`. The leading tour id
-- is what every policy below keys off, which lets a guest upload straight from
-- their phone to storage -- no service-role round trip through the app server.
--
-- The bucket is private: images are read through short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tour-photos',
  'tour-photos',
  false,
  15728640, -- 15 MB, comfortably above a phone photo
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Tour participants read tour photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'tour-photos'
    and public.is_tour_participant(
      public.safe_uuid((storage.foldername(name))[1])
    )
  );

create policy "Tour participants upload tour photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'tour-photos'
    and public.can_contribute(
      public.safe_uuid((storage.foldername(name))[1]),
      'photo'
    )
  );

create policy "Uploaders update own tour photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'tour-photos'
    and owner_id = (select auth.uid())::text
  )
  with check (
    bucket_id = 'tour-photos'
    and owner_id = (select auth.uid())::text
  );

create policy "Uploaders delete own tour photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'tour-photos'
    and owner_id = (select auth.uid())::text
  );

create policy "Brokers manage all photos on own tours"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'tour-photos'
    and public.is_tour_owner(
      public.safe_uuid((storage.foldername(name))[1])
    )
  )
  with check (
    bucket_id = 'tour-photos'
    and public.is_tour_owner(
      public.safe_uuid((storage.foldername(name))[1])
    )
  );
