import { NextResponse } from 'next/server';

/**
 * Apple fetches this to decide whether tapping a crepropertytour.vercel.app/t/
 * link should open the app instead of Safari. It must be served from the site
 * root, over HTTPS, as application/json, with no file extension and no redirect.
 *
 * IOS_APP_ID is `<TeamID>.<bundleId>`, e.g.
 * `A1B2C3D4E5.com.mpcorporaterealty.crepropertytour`. The Team ID is on the
 * Membership page of your Apple Developer account.
 *
 * Served only once that is set: publishing a malformed association file makes
 * iOS cache a failure, and it will not re-check for a good while.
 */
export const dynamic = 'force-static';

export function GET() {
  const appId = process.env.IOS_APP_ID;

  if (!appId) {
    return new NextResponse('Not configured', { status: 404 });
  }

  return NextResponse.json(
    {
      applinks: {
        details: [
          {
            appIDs: [appId],
            components: [{ '/': '/t/*', comment: 'Tour invitation links' }],
          },
        ],
      },
    },
    { headers: { 'content-type': 'application/json' } },
  );
}
