-- Several photos per building, not one.
--
-- A single `photo_path` column could only ever hold a cover shot, and a broker
-- walking a building takes the dock apron, the office, the clear height and the
-- yard. That is a list, so it becomes a table -- ordered, because the first one
-- is the cover and the order is the broker's judgement of what matters.
--
-- The column it replaces is dropped at the end, after its value is carried
-- across, so a project that already has cover photos keeps them.

create table public.property_photos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,

  -- Object key in the `property-photos` bucket, always `<broker_id>/...`.
  storage_path text not null unique,
  caption text,

  -- Position 0 is the cover. Not unique: reordering a gallery briefly puts two
  -- photos on the same index, and a constraint here would only make that
  -- harder without protecting anything -- the order is presentation, not truth.
  position integer not null default 0,

  width integer,
  height integer,
  size_bytes integer,

  created_at timestamptz not null default now(),

  constraint property_photos_position_check check (position >= 0)
);

create index property_photos_property_id_idx
  on public.property_photos (property_id, position);

alter table public.property_photos enable row level security;

-- Ownership is the property's ownership. Checked through a subquery rather
-- than a denormalised broker_id: a photo cannot outlive its building, and one
-- source of truth for who owns what is worth a join.
create policy "Brokers manage own property photos"
  on public.property_photos for all
  to authenticated
  using (
    exists (
      select 1
      from public.properties p
      where p.id = property_id
        and p.broker_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.properties p
      where p.id = property_id
        and p.broker_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Carry the single cover photo across, then retire the column.
-- ---------------------------------------------------------------------------

insert into public.property_photos (property_id, storage_path, position)
select id, photo_path, 0
from public.properties
where photo_path is not null
on conflict (storage_path) do nothing;

alter table public.properties
  drop column if exists photo_path;
