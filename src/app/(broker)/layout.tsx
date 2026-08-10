import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient, getBroker } from '@/lib/supabase/server';

/**
 * Shell for every signed-in broker page. The proxy already bounces guests and
 * signed-out visitors; this re-checks server-side so a page can never render
 * broker data on a stale cookie.
 */
export default async function BrokerLayout({ children }: LayoutProps<'/'>) {
  const broker = await getBroker();
  if (!broker) redirect('/login');

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', broker.id)
    .maybeSingle();

  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 p-4">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="font-semibold tracking-tight">
              CRE Property Tour
            </Link>
            <Link href="/tours" className="text-muted-foreground hover:text-foreground">
              Tours
            </Link>
            <Link href="/properties" className="text-muted-foreground hover:text-foreground">
              Properties
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {profile?.full_name ?? profile?.email ?? broker.email}
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
