/**
 * Shared Tailwind class strings. Not a component library -- just the handful of
 * shapes that repeat, kept in one place so the forms stay consistent.
 */

export const input =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent';

export const label = 'block text-sm font-medium';

export const hint = 'mt-1 text-xs text-muted-foreground';

export const buttonPrimary =
  'inline-flex items-center justify-center rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:text-[#070B14]';

export const buttonSecondary =
  'inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground disabled:opacity-60';

export const buttonDanger =
  'inline-flex items-center justify-center rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60 dark:border-red-900 dark:text-red-400';

export const card = 'rounded-lg border border-border p-4';

export const errorText = 'text-sm text-red-600 dark:text-red-400';

/** Money and size formatting used across the property views. */

export function formatSf(value: number | null | undefined): string | null {
  return value == null ? null : `${value.toLocaleString()} SF`;
}

export function formatRate(
  rate: number | null | undefined,
  type: string | null | undefined,
): string | null {
  if (rate == null) return null;
  const suffix =
    type === 'nnn'
      ? 'NNN'
      : type === 'gross'
        ? 'Gross'
        : type === 'modified_gross'
          ? 'MG'
          : type === 'base'
            ? 'Base'
            : '';
  return `$${rate.toFixed(2)}/SF${suffix ? ` ${suffix}` : ''}`;
}

export function formatTourDate(date: string | null | undefined): string | null {
  if (!date) return null;
  // A bare `date` column. Parse as UTC so it does not slide back a day for
  // anyone west of Greenwich.
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function cityState(
  city: string | null | undefined,
  state: string | null | undefined,
): string {
  return [city, state].filter(Boolean).join(', ');
}
