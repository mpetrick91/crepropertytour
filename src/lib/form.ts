/**
 * FormData coercion. Every field arrives as a string, and an untouched input
 * arrives as '' -- which must become null, not 0 or an empty string, or the
 * database ends up full of blanks that read as real values.
 */

export function text(form: FormData, name: string): string | null {
  const value = form.get(name);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function requiredText(form: FormData, name: string, label: string): string {
  const value = text(form, name);
  if (!value) throw new ValidationError(`${label} is required.`);
  return value;
}

export function integer(form: FormData, name: string): number | null {
  const value = text(form, name);
  if (value === null) return null;
  const parsed = Number.parseInt(value.replace(/[,\s]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function decimal(form: FormData, name: string): number | null {
  const value = text(form, name);
  if (value === null) return null;
  const parsed = Number.parseFloat(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function enumeration<T extends string>(
  form: FormData,
  name: string,
  allowed: readonly T[],
): T | null {
  const value = text(form, name);
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function checkbox(form: FormData, name: string): boolean {
  return form.get(name) === 'on' || form.get(name) === 'true';
}

export class ValidationError extends Error {}

export type ActionState = { error: string } | { ok: true } | null;

/**
 * Wraps an action so a thrown ValidationError -- or a Postgres error, which is
 * usually an RLS refusal or a constraint -- becomes a message on the form
 * rather than an error page.
 */
export async function runAction(fn: () => Promise<void>): Promise<ActionState> {
  try {
    await fn();
    return { ok: true };
  } catch (caught) {
    if (caught instanceof ValidationError) return { error: caught.message };
    // Let Next's redirect/notFound control-flow errors through untouched.
    if (
      caught &&
      typeof caught === 'object' &&
      'digest' in caught &&
      typeof (caught as { digest?: unknown }).digest === 'string' &&
      ((caught as { digest: string }).digest.startsWith('NEXT_REDIRECT') ||
        (caught as { digest: string }).digest === 'NEXT_NOT_FOUND')
    ) {
      throw caught;
    }
    return {
      error: caught instanceof Error ? caught.message : 'Something went wrong.',
    };
  }
}
