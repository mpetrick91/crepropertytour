import type { NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/proxy';

export default async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files -- those never need a
     * session refresh and running auth on them is pure latency.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
