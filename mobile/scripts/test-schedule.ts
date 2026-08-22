/**
 * Tests for the itinerary clock and the arithmetic behind "you're here".
 *
 * No test runner is configured, so run it directly:
 *   cd mobile && npx tsx scripts/test-schedule.ts
 */

import { buildSchedule, formatWindow } from '../src/lib/schedule';
import { distanceMetres, nearest } from '../src/lib/distance';
let bad = 0;
const ok = (l: string, c: boolean, d?: unknown) => { if (c) console.log('  ok   '+l); else { bad++; console.log('  FAIL '+l, JSON.stringify(d)); } };

const stops = [
  { id: 'a', scheduled_at: null, duration_minutes: 45 },
  { id: 'b', scheduled_at: null, duration_minutes: 45 },
  { id: 'c', scheduled_at: null, duration_minutes: 20 },
];
const s = buildSchedule(stops, '2026-08-24', '09:30:00');
ok('first stop is the tour start', s.get('a')!.arrival!.getHours() === 9 && s.get('a')!.arrival!.getMinutes() === 30, s.get('a')!.arrival?.toString());
ok('second stop is +45 +15 travel = 10:30', s.get('b')!.arrival!.getHours() === 10 && s.get('b')!.arrival!.getMinutes() === 30, s.get('b')!.arrival?.toString());
ok('third stop is 11:30', s.get('c')!.arrival!.getHours() === 11 && s.get('c')!.arrival!.getMinutes() === 30, s.get('c')!.arrival?.toString());
ok('window text', formatWindow(s.get('a')!.arrival!, 45).includes('–'), formatWindow(s.get('a')!.arrival!, 45));

const pinned = buildSchedule(
  [stops[0], { id: 'b', scheduled_at: new Date('2026-08-24T13:00:00').toISOString(), duration_minutes: 30 }, stops[2]],
  '2026-08-24', '09:30:00');
ok('a pinned stop wins over the running total', pinned.get('b')!.arrival!.getHours() === 13, pinned.get('b')!.arrival?.toString());
ok('pinned is flagged', pinned.get('b')!.pinned === true);
ok('stops after a pin follow from it (13:00 +30 +15 = 13:45)',
   pinned.get('c')!.arrival!.getHours() === 13 && pinned.get('c')!.arrival!.getMinutes() === 45, pinned.get('c')!.arrival?.toString());

const noDate = buildSchedule(stops, null, '09:30:00');
ok('no tour date means no times, not a crash', noDate.get('a')!.arrival === null);
ok('duration still known without a date', noDate.get('a')!.minutes === 45);

const missingDuration = buildSchedule([{ id: 'x', scheduled_at: null, duration_minutes: null }], '2026-08-24', '09:00:00');
ok('missing duration falls back to 45', missingDuration.get('x')!.minutes === 45);

const garbage = buildSchedule([{ id: 'g', scheduled_at: 'not-a-date', duration_minutes: 30 }], '2026-08-24', '09:00:00');
ok('an unparseable scheduled_at falls back rather than yielding Invalid Date',
   garbage.get('g')!.arrival !== null && !Number.isNaN(garbage.get('g')!.arrival!.getTime()), String(garbage.get('g')!.arrival));

// Grand Rapids downtown to the Gateway seed coordinate
const d = distanceMetres({ latitude: 42.9634, longitude: -85.6681 }, { latitude: 42.8814, longitude: -85.5228 });
ok('haversine is in the right ballpark (~15 km)', d > 13000 && d < 17000, Math.round(d));
ok('zero distance for the same point', distanceMetres({latitude:42,longitude:-85},{latitude:42,longitude:-85}) === 0);

const n = nearest({ latitude: 42.8815, longitude: -85.5229 }, [
  { id: '1', latitude: 42.8814, longitude: -85.5228 },
  { id: '2', latitude: 42.9494, longitude: -85.6459 },
]);
ok('nearest picks the closer building', n!.item.id === '1', n);
ok('nearest reports metres', n!.metres < 30, n!.metres);

console.log(bad ? `\n${bad} FAILURES` : '\nall passed');
process.exit(bad ? 1 : 0);
