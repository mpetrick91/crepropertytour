import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { buttonDanger, errorText } from '@/lib/ui';

import { deleteProperty, updateProperty } from '../actions';
import { PropertyForm } from '../property-form';

export const metadata = { title: 'Edit property | CRE Property Tour' };

export default async function EditPropertyPage({
  params,
  searchParams,
}: PageProps<'/properties/[id]'>) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!property) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {property.name ?? property.address_line1}
      </h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">{property.address_line1}</p>

      {typeof error === 'string' ? <p className={`mb-6 ${errorText}`}>{error}</p> : null}

      <PropertyForm action={updateProperty} property={property} submitLabel="Save changes" />

      <div className="mt-12 border-t border-border pt-6">
        <form action={deleteProperty}>
          <input type="hidden" name="id" value={property.id} />
          <button type="submit" className={buttonDanger}>
            Delete property
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            Blocked while the property is on a tour — remove it from the itinerary first.
          </p>
        </form>
      </div>
    </main>
  );
}
