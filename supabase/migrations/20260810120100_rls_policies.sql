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
