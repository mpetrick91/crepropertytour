import { NextResponse } from 'next/server';

/**
 * Android's equivalent of the Apple association file. Verified at install time,
 * which is what lets a tour link open the app rather than Chrome.
 *
 * ANDROID_CERT_FINGERPRINTS is a comma-separated list of SHA-256 signing
 * certificate fingerprints (`AA:BB:CC:...`). Get them with
 * `eas credentials -p android`, and include Play App Signing's fingerprint too
 * once the app is on the Play Store -- Google re-signs uploads, so the store
 * build has a different fingerprint from your local one.
 */
export const dynamic = 'force-static';

export function GET() {
  const fingerprints = process.env.ANDROID_CERT_FINGERPRINTS?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!fingerprints?.length) {
    return new NextResponse('Not configured', { status: 404 });
  }

  return NextResponse.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.mpcorporaterealty.crepropertytour',
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    { headers: { 'content-type': 'application/json' } },
  );
}
