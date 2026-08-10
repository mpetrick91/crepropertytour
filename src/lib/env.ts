/**
 * Environment access, validated at the point of use so a missing variable
 * fails with a message that says which one and where to get it, rather than
 * surfacing later as an opaque "Invalid API key" from the Supabase client.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and ` +
        `fill it in from your Supabase project's Settings -> API page.`,
    );
  }
  return value;
}

/**
 * The project origin, with any path stripped.
 *
 * supabase-js resolves 'auth/v1' *relative* to this value, so a URL copied from
 * the wrong box in the dashboard -- `https://<ref>.supabase.co/rest/v1` is the
 * easy mistake -- becomes `/rest/v1/auth/v1/otp` and the API gateway answers
 * "Invalid path specified in request URL", which says nothing about the cause.
 * Normalising here means only the project ref has to be right.
 *
 * (Assumes hosted Supabase, where the project URL is a bare origin. A
 * self-hosted instance mounted under a path prefix would need this relaxed.)
 */
export function supabaseUrl(): string {
  const raw = required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL).trim();

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL is not a valid URL: "${raw}". It should look ` +
        `like https://yourprojectref.supabase.co — copy it from Supabase under ` +
        `Project Settings → Data API → Project URL.`,
    );
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL must start with https:// — got "${raw}".`,
    );
  }

  return parsed.origin;
}

export function supabaseAnonKey(): string {
  // Trimmed because a value pasted into a dashboard field very often carries a
  // trailing newline, which turns into an invalid API key header.
  return required(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ).trim();
}

/**
 * Server-only. This key bypasses RLS entirely, so it must never be imported
 * into a client component or prefixed with NEXT_PUBLIC_.
 */
export function supabaseServiceRoleKey(): string {
  return required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  );
}
