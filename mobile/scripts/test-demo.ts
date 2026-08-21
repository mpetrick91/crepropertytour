/**
 * Tests for demo mode's local database.
 *
 * No test runner is configured in this project, so run it directly:
 *   cd mobile && npx tsx scripts/test-demo.ts
 *
 * The queries below are copied verbatim from the screens, so a change that
 * breaks one of them breaks a screen.
 */

import Module from 'node:module';

// Stand in for the two native modules the demo client imports.
const store = new Map<string, string>();
const mocks: Record<string, unknown> = {
  '@react-native-async-storage/async-storage': {
    __esModule: true,
    default: {
      getItem: async (k: string) => store.get(k) ?? null,
      setItem: async (k: string, v: string) => void store.set(k, v),
      removeItem: async (k: string) => void store.delete(k),
    },
  },
  'expo-crypto': {
    __esModule: true,
    getRandomBytes: (n: number) => Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256)),
  },
};
const originalResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request in mocks) return request;
  return originalResolve.call(this, request, ...rest);
};
const originalLoad = (Module as any)._load;
(Module as any)._load = function (request: string, ...rest: unknown[]) {
  if (request in mocks) return mocks[request];
  return originalLoad.call(this, request, ...rest);
};

const { createDemoClient } = require('../src/lib/demo/client');

let failures = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (ok) console.log('  ok   ' + label);
  else { failures++; console.log('  FAIL ' + label, detail === undefined ? '' : JSON.stringify(detail)); }
};

(async () => {
  const db = createDemoClient();

  console.log('boots straight in');
  const { data: sess } = await db.auth.getSession();
  check('a session exists with no sign-in', Boolean(sess.session), sess);
  const { data: u } = await db.auth.getUser();
  check('user is not anonymous (so isBroker is true)', u.user.is_anonymous === false);
  await new Promise<void>((r) => db.auth.onAuthStateChange(() => r()));
  check('onAuthStateChange fires', true);

  console.log('screens');
  const tours = await db.from('tours').select('id, title, clients(name), tour_stops(count)');
  check('tour list populated', tours.data.length === 1 && tours.data[0].clients.name === 'Ridgeline Logistics');
  const tourId = tours.data[0].id;

  console.log('nested embeds — the tour card shows its buildings in one query');
  const withBuildings = await db.from('tours').select(
    'id, title, tour_stops(id, position, properties(name, address_line1)), stop_notes(count)',
  );
  const withStops = withBuildings.data[0];
  check('stops come back in itinerary order',
    withStops.tour_stops.map((s: any) => s.position).join(',') === '0,1,2',
    withStops.tour_stops.map((s: any) => s.position));
  check('each stop carries its property', withStops.tour_stops[0].properties.name.startsWith('Gateway'));
  check('the nested embed projects only what was asked',
    Object.keys(withStops.tour_stops[0].properties).join(',') === 'name,address_line1',
    Object.keys(withStops.tour_stops[0].properties));
  check('a count alongside a nested embed still works', withStops.stop_notes[0].count === 2);

  console.log('rpc');
  const pos = await db.rpc('next_stop_position', { p_tour_id: tourId });
  check('next position after 3 stops is 3', pos.data === 3, pos);
  const share = await db.rpc('create_tour_share', { p_tour_id: tourId, p_label: 'CFO' });
  check('share created with token', typeof share.data.token === 'string' && share.data.token.length > 10);
  const preview = await db.rpc('preview_tour_share', { p_token: share.data.token });
  check('share previews the tour', preview.data.title.includes('Ridgeline'), preview.data);
  const joined = await db.rpc('join_tour', { p_token: share.data.token, p_display_name: 'Angela' });
  check('guest joins', joined.data.display_name === 'Angela' && joined.data.role === 'guest');
  const unknown = await db.rpc('nope', {});
  check('unknown function errors rather than throwing', unknown.error !== null);

  console.log('reorder');
  const before = await db.from('tour_stops').select('id, position').eq('tour_id', tourId).order('position');
  const reversed = before.data.map((s: any) => s.id).reverse();
  await db.rpc('reorder_tour_stops', { p_tour_id: tourId, p_stop_ids: reversed });
  const after = await db.from('tour_stops').select('id, position').eq('tour_id', tourId).order('position');
  check('stops reordered', after.data[0].id === reversed[0], after.data.map((s: any) => s.position));

  console.log('storage');
  const up = await db.storage.from('x').upload('t/s/a.jpg', new Uint8Array(10));
  check('upload succeeds', up.error === null);
  const signed = await db.storage.from('x').createSignedUrls(['t/s/a.jpg', 'missing.jpg']);
  check('signed url for uploaded, empty for missing',
    signed.data[0].signedUrl !== '' && signed.data[1].signedUrl === '', signed.data);

  console.log('persistence');
  await db.from('tours').update({ title: 'Renamed tour' }).eq('id', tourId);
  await new Promise((r) => setTimeout(r, 400));
  const db2 = createDemoClient();
  await db2.restore();
  const restored = await db2.from('tours').select('title').eq('id', tourId).maybeSingle();
  check('edits survive a reload', restored.data.title === 'Renamed tour', restored.data);

  await db2.reset();
  const afterReset = await db2.from('tours').select('title').eq('id', tourId).maybeSingle();
  check('reset restores the sample tour', afterReset.data.title.includes('Ridgeline'), afterReset.data);

  console.log(failures ? `\n${failures} FAILURES` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
