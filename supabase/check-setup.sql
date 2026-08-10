-- =====================================================================
-- Setup status check — READ ONLY.
--
-- Paste into the Supabase SQL Editor and Run. It changes nothing; it just
-- reports which parts of the setup have landed. Safe to run any time,
-- including on a project where nothing has been created yet.
-- =====================================================================

with
expected_tables (name) as (
  values ('profiles'), ('clients'), ('properties'), ('tours'), ('tour_stops'),
         ('tour_shares'), ('tour_participants'), ('stop_notes'), ('stop_photos')
),
expected_views (name) as (
  values ('guest_tours'), ('guest_tour_stops'), ('guest_properties')
),
-- to_regclass() returns null instead of raising when the object is absent,
-- so these run happily against a completely empty project.
tables_found as (
  select count(*) as n from expected_tables
  where to_regclass('public.' || name) is not null
),
views_found as (
  select count(*) as n from expected_views
  where to_regclass('public.' || name) is not null
),
policies_found as (
  select count(*) as n from pg_policies where schemaname = 'public'
),
storage_policies_found as (
  select count(*) as n from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname in (
      'Tour participants read tour photos', 'Tour participants upload tour photos',
      'Uploaders update own tour photos', 'Uploaders delete own tour photos',
      'Brokers manage all photos on own tours')
),
bucket_found as (
  select count(*) as n from storage.buckets where id = 'tour-photos'
),
functions_found as (
  select count(*) as n
  from (values
    ('public.join_tour(text,text,text)'),
    ('public.preview_tour_share(text)'),
    ('public.create_tour_share(uuid,text,boolean,boolean,timestamptz)'),
    ('public.reorder_tour_stops(uuid,uuid[])')
  ) as f(sig)
  where to_regprocedure(f.sig) is not null
),
-- Guarded so it does not explode before the schema exists: CASE only
-- evaluates the branch it picks, and query_to_xml runs its text lazily.
people as (
  select
    (select count(*) from auth.users where is_anonymous is not true) as brokers,
    case
      when to_regclass('public.profiles') is null then null
      else (xpath('/row/c/text()',
             query_to_xml('select count(*) as c from public.profiles', false, true, '')))[1]::text::bigint
    end as profiles
)
select step, status, detail from (
  select 1 as ord, 'Step 1' as step,
    case when (select n from tables_found) = 9 then 'DONE' else 'NOT DONE' end as status,
    'Database tables: ' || (select n from tables_found) || ' of 9' as detail
  union all
  select 2, 'Step 1',
    case when (select n from views_found) = 3 then 'DONE' else 'NOT DONE' end,
    'Client-safe views: ' || (select n from views_found) || ' of 3'
  union all
  select 3, 'Step 1',
    case when (select n from policies_found) >= 21 then 'DONE' else 'NOT DONE' end,
    'Security rules: ' || (select n from policies_found) || ' (expect 21)'
  union all
  select 4, 'Step 1',
    case when (select n from functions_found) = 4 then 'DONE' else 'NOT DONE' end,
    'Share-link functions: ' || (select n from functions_found) || ' of 4'
  union all
  select 5, 'Step 1',
    case when (select n from bucket_found) = 1 then 'DONE' else 'NOT DONE' end,
    'Photo storage bucket: ' || case when (select n from bucket_found) = 1 then 'created' else 'missing' end
  union all
  select 6, 'Step 1',
    case when (select n from storage_policies_found) = 5 then 'DONE' else 'NOT DONE' end,
    'Photo storage rules: ' || (select n from storage_policies_found) || ' of 5'
  union all
  select 7, 'Step 2',
    case when (select brokers from people) >= 1 then 'DONE' else 'NOT DONE' end,
    'Broker accounts: ' || (select brokers from people)
  union all
  select 8, 'Step 2',
    case
      when (select profiles from people) is null then 'NOT DONE'
      when (select profiles from people) >= (select brokers from people) then 'DONE'
      else 'PROBLEM'
    end,
    'Broker profiles: ' || coalesce((select profiles from people)::text, 'table not created yet')
      || ' (must be at least the number of broker accounts)'
) checks
order by ord;
