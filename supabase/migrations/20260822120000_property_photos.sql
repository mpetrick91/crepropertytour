-- A cover photo for a building.
--
-- A property page without an image is a spec sheet; brokers recognise buildings
-- by sight long before they recognise an address. This stores the object key
-- rather than a URL, because the bucket is private and every read goes through
-- a short-lived signed link -- the same arrangement the tour photos use.

alter table public.properties
  add column if not exists photo_path text;

comment on column public.properties.photo_path is
  'Object key in the `property-photos` bucket. Always `<broker_id>/<property_id>/<uuid>.<ext>`.';

-- ---------------------------------------------------------------------------
-- Bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-photos',
  'property-photos',
  false,
  15728640, -- 15 MB, comfortably above a phone photo
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- The leading path segment is the owning broker's id, which is the whole of
-- the access rule: a broker reaches their own folder and nothing else. Guests
-- are not granted access here at all -- the guest tour view exposes a
-- property's client-facing text, and widening it to images is a separate
-- decision that should be made deliberately rather than inherited from this
-- migration.

create policy "Brokers read own property photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Brokers upload own property photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Brokers update own property photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Brokers delete own property photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
