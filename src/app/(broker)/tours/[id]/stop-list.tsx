import { buttonSecondary, input } from '@/lib/ui';

import { moveStop, removeStop, saveStopNotes } from '../actions';

export type StopSummary = {
  id: string;
  position: number;
  durationMinutes: number | null;
  brokerNotes: string | null;
  title: string;
  subtitle: string;
  details: string;
};

export function StopList({ tourId, stops }: { tourId: string; stops: StopSummary[] }) {
  if (!stops.length) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No stops yet. Add buildings from your library below.
      </div>
    );
  }

  return (
    <ol className="mt-4 space-y-3">
      {stops.map((stop, index) => (
        <li key={stop.id} className="rounded-lg border border-border p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent text-xs font-semibold text-white dark:text-[#0c0f13]">
              {index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <p className="font-medium">{stop.title}</p>
              <p className="text-sm text-muted-foreground">{stop.subtitle}</p>
              {stop.details ? (
                <p className="text-sm text-muted-foreground">{stop.details}</p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <form action={moveStop}>
                <input type="hidden" name="tour_id" value={tourId} />
                <input type="hidden" name="stop_id" value={stop.id} />
                <input type="hidden" name="direction" value="up" />
                <button
                  type="submit"
                  disabled={index === 0}
                  aria-label={`Move ${stop.title} earlier`}
                  className="rounded border border-border px-2 py-1 text-xs disabled:opacity-30"
                >
                  ↑
                </button>
              </form>
              <form action={moveStop}>
                <input type="hidden" name="tour_id" value={tourId} />
                <input type="hidden" name="stop_id" value={stop.id} />
                <input type="hidden" name="direction" value="down" />
                <button
                  type="submit"
                  disabled={index === stops.length - 1}
                  aria-label={`Move ${stop.title} later`}
                  className="rounded border border-border px-2 py-1 text-xs disabled:opacity-30"
                >
                  ↓
                </button>
              </form>
              <form action={removeStop}>
                <input type="hidden" name="tour_id" value={tourId} />
                <input type="hidden" name="stop_id" value={stop.id} />
                <button
                  type="submit"
                  aria-label={`Remove ${stop.title}`}
                  className="rounded border border-border px-2 py-1 text-xs text-muted-foreground"
                >
                  ✕
                </button>
              </form>
            </div>
          </div>

          <form action={saveStopNotes} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="tour_id" value={tourId} />
            <input type="hidden" name="stop_id" value={stop.id} />
            <div className="min-w-56 flex-1">
              <label
                htmlFor={`broker_notes_${stop.id}`}
                className="text-xs font-medium text-muted-foreground"
              >
                Internal note for this stop
              </label>
              <input
                id={`broker_notes_${stop.id}`}
                name="broker_notes"
                defaultValue={stop.brokerNotes ?? ''}
                placeholder="Ask about the 2019 roof work"
                className={`${input} border-amber-300 dark:border-amber-900/60`}
              />
            </div>
            <div className="w-24">
              <label
                htmlFor={`duration_${stop.id}`}
                className="text-xs font-medium text-muted-foreground"
              >
                Minutes
              </label>
              <input
                id={`duration_${stop.id}`}
                name="duration_minutes"
                inputMode="numeric"
                defaultValue={stop.durationMinutes ?? ''}
                className={input}
              />
            </div>
            <button type="submit" className={buttonSecondary}>
              Save
            </button>
          </form>
        </li>
      ))}
    </ol>
  );
}
