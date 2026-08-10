-- Local development seed. Applied by `supabase db reset`, never in production.
--
-- Creates one broker (michael@example.com), a client, two Columbus industrial
-- properties, a tour with both on the itinerary, and a share link with the
-- fixed token below so the guest flow can be opened without hunting for a token:
--
--   http://localhost:3000/t/local-dev-share-token-000000
--
-- Sign in as the broker with the magic link at http://localhost:54324 (Inbucket).

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_anonymous
)
values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated', 'michael@example.com',
  crypt('password123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Michael Petrick","name":"Michael Petrick"}',
  false
)
on conflict (id) do nothing;

update public.profiles
set company = 'Cresa', phone = '614-555-0143'
where id = '11111111-1111-1111-1111-111111111111';

insert into public.clients (id, broker_id, name, company, email)
values (
  'c1111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'Jane Doe', 'Acme Logistics', 'jane@acmelogistics.example'
)
on conflict (id) do nothing;

insert into public.properties (
  id, broker_id, name, address_line1, city, state, postal_code,
  latitude, longitude, property_type, building_size_sf, available_sf,
  clear_height_ft, dock_doors, rent_rate, rent_type, op_ex,
  description, notes
)
values
  (
    'a1111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'Fisher Road Distribution Center', '4600 Fisher Rd', 'Columbus', 'OH', '43228',
    39.9612, -83.1207, 'industrial', 220000, 96000,
    32.0, 24, 7.25, 'nnn', 1.15,
    'Cross-dock configuration, 24 dock doors, 185 ft truck court, ESFR sprinkler.',
    'INTERNAL: landlord has carried this vacancy 11 months. Room to push on rate.'
  ),
  (
    'a2222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'Westbelt Business Park', '2000 Westbelt Dr', 'Columbus', 'OH', '43228',
    39.9548, -83.1461, 'industrial', 148000, 74000,
    28.0, 12, 8.10, 'nnn', 1.32,
    'Rear-load, 28 ft clear, 12 docks plus two drive-ins, heavy power.',
    'INTERNAL: listing broker is slow. Confirm OpEx before we quote it.'
  )
on conflict (id) do nothing;

insert into public.tours (
  id, broker_id, client_id, title, status, tour_date, start_time,
  market, requirement_summary, notes
)
values (
  '70000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111',
  'Acme Logistics — Columbus West', 'scheduled', current_date + 4, '09:30',
  'Columbus, OH',
  '75,000–100,000 SF distribution, 28 ft clear minimum, Q1 occupancy.',
  'INTERNAL: Jane is the decision maker. Her ops lead cares most about dock count.'
)
on conflict (id) do nothing;

insert into public.tour_stops (id, tour_id, property_id, position, duration_minutes, broker_notes)
values
  ('50000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001',
   'a1111111-1111-1111-1111-111111111111', 1, 45, 'INTERNAL: ask about the 2019 roof work'),
  ('50000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001',
   'a2222222-2222-2222-2222-222222222222', 2, 30, 'INTERNAL: backup option, weaker truck court')
on conflict (id) do nothing;

insert into public.tour_shares (id, tour_id, token, label, created_by)
values (
  '60000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  'local-dev-share-token-000000',
  'Jane Doe (local dev)',
  '11111111-1111-1111-1111-111111111111'
)
on conflict (id) do nothing;
