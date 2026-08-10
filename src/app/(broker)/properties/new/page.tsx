import { createProperty } from '../actions';
import { PropertyForm } from '../property-form';

export const metadata = { title: 'Add property | CRE Property Tour' };

export default function NewPropertyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Add property</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">
        Only the street address is required. Fill in the rest as the listing broker
        confirms it.
      </p>
      <PropertyForm action={createProperty} submitLabel="Save property" />
    </main>
  );
}
