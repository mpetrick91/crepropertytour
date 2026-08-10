\set ON_ERROR_STOP on

-- Assertion helpers -----------------------------------------------------------

create or replace function public.t_ok(p_cond boolean, p_label text)
returns void language plpgsql as $$
begin
  if p_cond then
    raise notice 'PASS  %', p_label;
  else
    raise exception 'FAIL  %', p_label;
  end if;
end; $$;

-- Passes when the statement is refused outright OR silently touches no rows --
-- RLS denies writes both ways depending on whether a USING or WITH CHECK
-- clause is the one that fails.
create or replace function public.t_blocked(p_sql text, p_label text)
returns void language plpgsql as $$
declare
  v_rows bigint;
begin
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
    if v_rows > 0 then
      raise exception 'FAIL  % (statement affected % row(s))', p_label, v_rows;
    end if;
  exception
    when sqlstate '42501' or sqlstate '28000' or sqlstate '22023'
      or sqlstate '23514' or sqlstate '23503' or sqlstate '23505' or sqlstate 'P0001' then
      if position('FAIL' in sqlerrm) = 1 then raise; end if;
  end;
  raise notice 'PASS  %', p_label;
end; $$;

-- Seed identities -------------------------------------------------------------

insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'michael@cresa.com', false, '{"full_name":"Michael Petrick"}'),
  ('22222222-2222-2222-2222-222222222222', 'rival@other.com',   false, '{"full_name":"Other Broker"}'),
  ('33333333-3333-3333-3333-333333333333', null,                true,  '{}'),
  ('44444444-4444-4444-4444-444444444444', null,                true,  '{}');

select public.t_ok(
  (select count(*) from public.profiles) = 2,
  'profile auto-created for real users only (anonymous users get none)'
);

-- Broker A builds a tour -------------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111"}';

insert into public.clients (id, broker_id, name, company)
values ('c1111111-1111-1111-1111-111111111111', auth.uid(), 'Jane Doe', 'Acme Logistics');

insert into public.properties (id, broker_id, address_line1, city, state, rent_rate, rent_type, description, notes)
values
  ('a1111111-1111-1111-1111-111111111111', auth.uid(), '4600 Fisher Rd', 'Columbus', 'OH', 7.25, 'nnn',
   'Cross-dock with 32 docks.', 'INTERNAL: landlord is motivated, push to $6.50'),
  ('a2222222-2222-2222-2222-222222222222', auth.uid(), '2000 Westbelt Dr', 'Columbus', 'OH', 8.10, 'nnn',
   'Rear-load, 28ft clear.', 'INTERNAL: listing broker is slow to respond');

insert into public.tours (id, broker_id, client_id, title, tour_date, market, notes)
values ('70000000-0000-0000-0000-000000000001', auth.uid(), 'c1111111-1111-1111-1111-111111111111',
        'Acme Columbus Tour', '2026-08-14', 'Columbus, OH', 'INTERNAL: Jane leans toward Fisher Rd');

insert into public.tour_stops (id, tour_id, property_id, position, broker_notes) values
  ('50000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'a1111111-1111-1111-1111-111111111111', 1, 'INTERNAL: ask about the roof'),
  ('50000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 'a2222222-2222-2222-2222-222222222222', 2, 'INTERNAL: backup option only');

select public.t_ok(
  (select count(*) from public.tour_participants
   where tour_id = '70000000-0000-0000-0000-000000000001' and role = 'broker') = 1,
  'broker is auto-added as a participant on their own tour'
);

-- Resequencing the whole itinerary in one statement must not trip the index.
update public.tour_stops set position = 3 - position
where tour_id = '70000000-0000-0000-0000-000000000001';
select public.t_ok(true, 'tour stops resequence in a single statement (deferred unique constraint)');

select public.create_tour_share('70000000-0000-0000-0000-000000000001', 'Jane', true, true, null);
select public.t_ok(
  (select count(*) from public.tour_shares) = 1,
  'broker can mint a share link'
);
commit;

-- Broker B must not see any of it ---------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"22222222-2222-2222-2222-222222222222"}';
select public.t_ok((select count(*) from public.tours) = 0,       'other broker sees no tours');
select public.t_ok((select count(*) from public.properties) = 0,  'other broker sees no properties');
select public.t_ok((select count(*) from public.clients) = 0,     'other broker sees no clients');
select public.t_ok((select count(*) from public.tour_shares) = 0, 'other broker sees no share tokens');
select public.t_ok((select count(*) from public.guest_tours) = 0, 'other broker sees nothing through the guest views');
select public.t_ok((select count(*) from public.stop_notes) = 0,  'other broker sees no notes');
commit;

select token as share_token from public.tour_shares limit 1
\gset

-- An unauthenticated visitor previews the link --------------------------------

begin;
set local role anon;
select public.t_ok((select valid from public.preview_tour_share(:'share_token')),
                   'anon visitor can preview a valid share link');
select public.t_ok((select stop_count from public.preview_tour_share(:'share_token')) = 2,
                   'preview reports the stop count');
select public.t_ok((select broker_name from public.preview_tour_share(:'share_token')) = 'Michael Petrick',
                   'preview names the broker who sent it');
select public.t_ok(not (select valid from public.preview_tour_share('bogus-token')),
                   'anon visitor gets valid=false for an unknown token');
select public.t_ok((select count(*) from public.tours) = 0,       'anon cannot read tours');
select public.t_ok((select count(*) from public.tour_shares) = 0, 'anon cannot read share tokens');
select public.t_blocked($q$select count(*) from public.guest_tours$q$,
                        'anon has no grant on the guest views at all');
commit;

-- Guest redeems the link ------------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"33333333-3333-3333-3333-333333333333","is_anonymous":true}';

select public.t_ok(
  (select participant_id from public.join_tour(:'share_token', 'Jane Doe', 'Acme Logistics')) is not null,
  'anonymous guest joins the tour with a token and a display name'
);
select public.join_tour(:'share_token', 'Jane Doe', 'Acme Logistics');
select public.t_ok(
  (select count(*) from public.tour_participants
   where user_id = '33333333-3333-3333-3333-333333333333') = 1,
  'reopening the same link is idempotent'
);
commit;

-- What the guest can and cannot see -------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"33333333-3333-3333-3333-333333333333","is_anonymous":true}';

select public.t_ok((select count(*) from public.guest_tours) = 1,      'guest reads their tour via guest_tours');
select public.t_ok((select count(*) from public.guest_tour_stops) = 2, 'guest reads the itinerary via guest_tour_stops');
select public.t_ok((select count(*) from public.guest_properties) = 2, 'guest reads the buildings via guest_properties');
select public.t_ok((select count(*) from public.guest_properties where description is not null) = 2,
                   'guest sees the client-facing description');

-- The point of the view layer: no broker-internal text reaches a guest.
select public.t_ok((select count(*) from public.tours) = 0,       'guest CANNOT read tours base table (tours.notes is internal)');
select public.t_ok((select count(*) from public.tour_stops) = 0,  'guest CANNOT read tour_stops base table (broker_notes is internal)');
select public.t_ok((select count(*) from public.properties) = 0,  'guest CANNOT read properties base table (properties.notes is internal)');
select public.t_ok((select count(*) from public.tour_shares) = 0, 'guest CANNOT read share tokens');
select public.t_ok((select count(*) from public.clients) = 0,     'guest CANNOT read the broker client list');
select public.t_ok((select count(*) from public.profiles) = 0,    'guest CANNOT read broker profiles');
select public.t_ok((select count(*) from public.tour_participants) = 2,
                   'guest CAN see the roster of their own tour');

insert into public.stop_notes (tour_id, stop_id, participant_id, body, rating)
values ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
        public.current_participant_id('70000000-0000-0000-0000-000000000001'),
        'Ceiling height works. Office is dated.', 4);
select public.t_ok(true, 'guest can add a note stamped with their own participant id');

insert into public.stop_photos (tour_id, stop_id, participant_id, storage_path)
values ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
        public.current_participant_id('70000000-0000-0000-0000-000000000001'),
        '70000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/shot1.jpg');
select public.t_ok(true, 'guest can register a photo under their own tour prefix');
commit;

-- Guest write-path negatives ---------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"33333333-3333-3333-3333-333333333333"}';

select public.t_blocked(
  $q$insert into public.stop_photos (tour_id, stop_id, participant_id, storage_path)
     values ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
             public.current_participant_id('70000000-0000-0000-0000-000000000001'),
             'some-other-tour/shot2.jpg')$q$,
  'guest CANNOT register a photo path outside their own tour prefix');

select public.t_blocked(
  $q$insert into public.tour_participants (tour_id, user_id, display_name, role)
     values ('70000000-0000-0000-0000-000000000001',
             '44444444-4444-4444-4444-444444444444', 'Sneaky', 'broker')$q$,
  'guest CANNOT insert participant rows directly (must go through join_tour)');

select public.t_blocked(
  $q$update public.tour_stops set broker_notes = 'x'
     where id = '50000000-0000-0000-0000-000000000001'$q$,
  'guest CANNOT modify the itinerary');

select public.t_blocked(
  $q$update public.tours set title = 'hijacked'
     where id = '70000000-0000-0000-0000-000000000001'$q$,
  'guest CANNOT rename the tour');

select public.t_blocked(
  $q$insert into public.stop_notes (tour_id, stop_id, participant_id, body)
     select '70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', id, 'impersonated'
     from public.tour_participants where role = 'broker'$q$,
  'guest CANNOT post a note under the broker''s participant id');
commit;

-- Storage object policies ------------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"33333333-3333-3333-3333-333333333333"}';

insert into storage.objects (bucket_id, name, owner_id)
values ('tour-photos',
        '70000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/shot1.jpg',
        '33333333-3333-3333-3333-333333333333');
select public.t_ok(true, 'guest can upload into the tour-photos prefix for their tour');

select public.t_blocked(
  $q$insert into storage.objects (bucket_id, name, owner_id)
     values ('tour-photos', '00000000-0000-0000-0000-0000000000ff/x.jpg',
             '33333333-3333-3333-3333-333333333333')$q$,
  'guest CANNOT upload into another tour''s prefix');

select public.t_blocked(
  $q$insert into storage.objects (bucket_id, name, owner_id)
     values ('tour-photos', 'not-a-uuid/x.jpg', '33333333-3333-3333-3333-333333333333')$q$,
  'a non-uuid storage prefix is rejected rather than erroring the request');
commit;

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"44444444-4444-4444-4444-444444444444"}';
select public.t_ok((select count(*) from storage.objects) = 0,
                   'un-joined anonymous user sees no stored photos');
commit;

-- A second anonymous device that never redeemed the token ---------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"44444444-4444-4444-4444-444444444444","is_anonymous":true}';
select public.t_ok((select count(*) from public.guest_tours) = 0,      'un-joined anonymous user sees no tours');
select public.t_ok((select count(*) from public.guest_properties) = 0, 'un-joined anonymous user sees no properties');
select public.t_ok((select count(*) from public.stop_notes) = 0,       'un-joined anonymous user sees no notes');
commit;

-- Revocation -------------------------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111"}';
update public.tour_shares set revoked_at = now();
commit;

begin;
set local role anon;
select public.t_ok(
  (select reason from public.preview_tour_share(:'share_token')) = 'revoked',
  'a revoked link previews as invalid with reason=revoked');
commit;

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"44444444-4444-4444-4444-444444444444"}';
select public.t_blocked(
  format('select public.join_tour(%L, %L)', :'share_token', 'Late Joiner'),
  'a revoked link can no longer be redeemed');
commit;

-- Guests already on the tour keep working after revocation ---------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"33333333-3333-3333-3333-333333333333"}';
select public.t_ok((select count(*) from public.guest_tours) = 1,
                   'a guest who already joined is unaffected by revoking the link');
commit;

-- Broker consolidates -----------------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111"}';
select public.t_ok((select count(*) from public.stop_notes) = 1,
                   'broker reads the guest note back on their own tour');
select public.t_ok((select count(*) from public.stop_photos) = 1,
                   'broker reads the guest photo back on their own tour');
select public.t_ok((select body from public.stop_notes limit 1) = 'Ceiling height works. Office is dated.',
                   'the consolidated note carries the guest text through verbatim');
select public.t_ok((select count(*) from storage.objects) = 1,
                   'broker can see photos uploaded to their own tour');
commit;

-- Data-integrity guards ----------------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111"}';
select public.t_blocked(
  $q$insert into public.stop_notes (tour_id, stop_id, participant_id, body)
     select extensions.gen_random_uuid(), '50000000-0000-0000-0000-000000000002', id, 'bad'
     from public.tour_participants where role = 'guest' limit 1$q$,
  'a note whose tour_id disagrees with its stop is rejected');

select public.t_blocked(
  $q$insert into public.stop_notes (tour_id, stop_id, participant_id, body)
     values ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
             public.current_participant_id('70000000-0000-0000-0000-000000000001'), '   ')$q$,
  'an empty note body is rejected');
commit;

select 'ALL TESTS PASSED' as result;
