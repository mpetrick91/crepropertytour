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
