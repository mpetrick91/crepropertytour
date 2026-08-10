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
