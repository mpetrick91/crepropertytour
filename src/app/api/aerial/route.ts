import { NextResponse } from 'next/server';

/**
 * Satellite imagery for a building, fetched server-side.
 *
 * The app could call Google directly, but that means shipping the API key
 * inside the app -- and a key inside an app is a key anyone who downloads it
 * can read and spend. Google's own restrictions do not close this for static
 * map requests: they are plain HTTP from the device, so there is no bundle id
 * or referrer to check against.
 *
 * Routing through here keeps the key on the server, where it is an environment
 * variable like any other. The app asks this site for a picture; this site is
 * the only thing that ever holds the key.
 *
 * Returns 404 when no key is configured, which the app treats as "draw the
 * placeholder instead" -- so the feature is off until it is set up, rather
 * than broken.
 */

const GOOGLE_STATIC_MAPS = 'https://maps.googleapis.com/maps/api/staticmap';

/** An hour on the device, a day at the edge: a building does not move. */
const CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';

function key(): string | undefined {
  return process.env.MAPS_KEY?.trim() || undefined;
}

/**
 * Only a coordinate pair is accepted, never a free-text address.
 *
 * This endpoint is public, so whatever it forwards is spendable. A number pair
 * cannot be turned into a geocoding request or any other billable call, which
 * keeps the blast radius of an abusive caller to static map tiles alone.
 */
function coordinate(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  const apiKey = key();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Aerial imagery is not configured for this site.' },
      { status: 404 },
    );
  }

  const params = new URL(request.url).searchParams;
  const lat = coordinate(params.get('lat'));
  const lng = coordinate(params.get('lng'));

  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'lat and lng are required.' }, { status: 400 });
  }

  // Clamped so a caller cannot ask for a poster-sized image on your account.
  const width = Math.min(Math.max(Number(params.get('w')) || 640, 160), 640);
  const height = Math.min(Math.max(Number(params.get('h')) || 400, 160), 640);
  const zoom = Math.min(Math.max(Number(params.get('z')) || 18, 1), 20);

  const point = `${lat},${lng}`;
  const upstream = new URL(GOOGLE_STATIC_MAPS);
  upstream.searchParams.set('center', point);
  upstream.searchParams.set('zoom', `${zoom}`);
  upstream.searchParams.set('size', `${width}x${height}`);
  upstream.searchParams.set('scale', '2');
  upstream.searchParams.set('maptype', 'satellite');
  upstream.searchParams.set('markers', `color:0xFAA61A|${point}`);
  upstream.searchParams.set('key', apiKey);

  try {
    const response = await fetch(upstream, { next: { revalidate: 86_400 } });

    if (!response.ok) {
      // Google puts the reason in the body; it can name the key, so it is
      // logged rather than returned.
      console.error('[aerial] upstream returned', response.status, await response.text());
      return NextResponse.json({ error: 'Could not load the aerial.' }, { status: 502 });
    }

    return new NextResponse(response.body, {
      headers: {
        'content-type': response.headers.get('content-type') ?? 'image/png',
        'cache-control': CACHE_CONTROL,
      },
    });
  } catch (error) {
    console.error('[aerial] request failed', error);
    return NextResponse.json({ error: 'Could not load the aerial.' }, { status: 502 });
  }
}
