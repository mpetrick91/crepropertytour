import { NextResponse } from 'next/server';

import { siteUrl, supabaseAnonKey, supabaseUrl } from '@/lib/env';

/**
 * Runtime config for the browser preview of the mobile app, served from
 * /app/index.html.
 *
 * The preview bundle is committed, so baking project values into it would
 * commit them too. Instead it reads them from here at load time, which also
 * means the preview always follows whatever this site is configured with.
 *
 * Only publishable values -- exactly what the website already ships to every
 * visitor's browser. Nothing secret belongs in this response.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  const config = {
    supabaseUrl: supabaseUrl(),
    supabaseAnonKey: supabaseAnonKey(),
    siteUrl: siteUrl(),
  };

  return new NextResponse(`globalThis.__CRE_CONFIG__ = ${JSON.stringify(config)};`, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      // Follows the deployment, so a config change is picked up on next load.
      'cache-control': 'no-store',
    },
  });
}
