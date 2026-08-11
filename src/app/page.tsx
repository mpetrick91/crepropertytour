import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getBroker } from '@/lib/supabase/server';

export default async function HomePage() {
  if (await getBroker()) redirect('/dashboard');

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight">CRE Property Tour</h1>
        <p className="mt-3 text-muted-foreground">
          Build the itinerary, send one link, and collect every note and photo from the
          walkthrough in one place.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-white dark:text-[#070B14]"
        >
          Broker sign-in
        </Link>
        <p className="mt-4 text-sm text-muted-foreground">
          On a tour? Open the link your broker sent you.
        </p>
      </div>
    </main>
  );
}
