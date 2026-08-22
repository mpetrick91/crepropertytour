/**
 * When each stop happens.
 *
 * A tour has a start time and each stop has a duration, which is enough to say
 * what time the group reaches every building -- so most itineraries need no
 * per-stop times entered at all. A stop with its own `scheduled_at` overrides
 * the computed time and becomes the anchor everything after it counts from,
 * which is how a real itinerary works: fix the one appointment the landlord
 * gave you, and the rest of the day arranges itself around it.
 */

/** Minutes assumed between buildings when nothing better is known. */
export const TRAVEL_MINUTES = 15;

/** Minutes at a stop when the broker has not said otherwise. */
export const DEFAULT_STOP_MINUTES = 45;

export type ScheduleInput = {
  id: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
};

export type ScheduledStop = {
  id: string;
  /** Local arrival time, or null when the tour has no start time at all. */
  arrival: Date | null;
  minutes: number;
  /** True when the time came from the stop rather than from the running total. */
  pinned: boolean;
};

/**
 * Combines a tour's date and `time` column into a Date in local time.
 * Postgres hands back `09:30:00`; without a date attached it is not a moment.
 */
function startOfTour(tourDate: string | null, startTime: string | null): Date | null {
  if (!tourDate) return null;
  const [hours, minutes] = (startTime ?? '09:00').split(':').map(Number);
  if (Number.isNaN(hours)) return null;

  const date = new Date(`${tourDate}T00:00:00`);
  date.setHours(hours, minutes || 0, 0, 0);
  return date;
}

export function buildSchedule(
  stops: ScheduleInput[],
  tourDate: string | null,
  startTime: string | null,
): Map<string, ScheduledStop> {
  const schedule = new Map<string, ScheduledStop>();
  let cursor = startOfTour(tourDate, startTime);

  for (const stop of stops) {
    const minutes = stop.duration_minutes ?? DEFAULT_STOP_MINUTES;
    const pinnedAt = stop.scheduled_at ? new Date(stop.scheduled_at) : null;
    const valid = pinnedAt && !Number.isNaN(pinnedAt.getTime()) ? pinnedAt : null;

    // A pinned stop resets the running total: everything after it follows from
    // the appointment, not from where the day would otherwise have drifted to.
    const arrival = valid ?? cursor;

    schedule.set(stop.id, { id: stop.id, arrival, minutes, pinned: Boolean(valid) });

    if (arrival) {
      cursor = new Date(arrival.getTime() + (minutes + TRAVEL_MINUTES) * 60_000);
    }
  }

  return schedule;
}

/** "9:30 AM", in the phone's own format. */
export function formatClock(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "9:30 – 10:15 AM" for a stop, which is what a broker reads off a printed run sheet. */
export function formatWindow(arrival: Date, minutes: number): string {
  const end = new Date(arrival.getTime() + minutes * 60_000);
  return `${formatClock(arrival)} – ${formatClock(end)}`;
}

/** The `time` column wants HH:MM:SS. */
export function toTimeColumn(date: Date): string {
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}:00`;
}
