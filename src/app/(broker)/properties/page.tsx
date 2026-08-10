import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { buttonPrimary, cityState, formatRate, formatSf } from '@/lib/ui';

export const metadata = { title: 'Properties | CRE Property Tour' };

export default async function PropertiesPage() {
  const supabase = await createClient();
  const { data: properties } = await supabase
    .from('properties')
    .select(
      'id, name, address_line1, city, state, property_type, available_sf, rent_rate, rent_type',
    )
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your building library. Add options here, then drop them onto a tour.
          </p>
        </div>
        <Link href="/properties/new" className={buttonPrimary}>
          Add property
        </Link>
      </header>

      {!properties?.length ? (
        <div className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No properties yet.
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
          {properties.map((property) => {
            const details = [
              formatSf(property.available_sf),
              formatRate(property.rent_rate, property.rent_type),
            ].filter(Boolean);

            return (
              <li key={property.id}>
                <Link
                  href={`/properties/${property.id}`}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {property.name ?? property.address_line1}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {property.address_line1}
                      {cityState(property.city, property.state)
                        ? ` · ${cityState(property.city, property.state)}`
                        : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm text-muted-foreground">
                    {details.length ? details.join(' · ') : property.property_type}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
