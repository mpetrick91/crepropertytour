import type { RentType } from './types';

export function formatSf(value: number | null | undefined): string | null {
  return value == null ? null : `${value.toLocaleString('en-US')} SF`;
}

export function formatRate(
  rate: number | null | undefined,
  type: RentType | null | undefined,
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
  // A bare `date` column. Parsing as UTC keeps it from sliding back a day for
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

export function statusLabel(status: string): string {
  return status.replace('_', ' ');
}

/**
 * Supabase auth and Postgres errors are written for developers. Brokers and
 * clients both see these, so translate the ones that actually come up.
 */
export function humanError(message: string): string {
  const text = message.toLowerCase();

  if (text.includes('anonymous') || text.includes('signups not allowed')) {
    return 'This tour is not accepting guests yet. Let your broker know — it is a setting on their end.';
  }
  if (text.includes('no longer valid')) {
    return 'This tour link has been turned off. Ask your broker for a new one.';
  }
  if (text.includes('rate limit') || text.includes('too many')) {
    return 'Too many attempts just now. Wait a minute and try again.';
  }
  if (text.includes('network') || text.includes('fetch')) {
    return 'Could not reach the server. Check your signal and try again.';
  }
  if (text.includes('row-level security') || text.includes('permission denied')) {
    return 'You do not have access to that.';
  }
  return message;
}
