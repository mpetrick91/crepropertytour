import { createClient } from '@/lib/supabase/server';

import { createTour } from '../actions';
import { TourForm } from '../tour-form';

export const metadata = { title: 'New tour | CRE Property Tour' };

export default async function NewTourPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, company')
    .order('name');

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">New tour</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">
        Name it now and add buildings next.
      </p>
      <TourForm action={createTour} clients={clients ?? []} submitLabel="Create tour" />
    </main>
  );
}
