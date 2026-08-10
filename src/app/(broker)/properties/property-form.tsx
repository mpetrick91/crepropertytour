'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { ActionState } from '@/lib/form';
import { buttonPrimary, buttonSecondary, errorText, hint, input, label } from '@/lib/ui';
import type { Property } from '@/lib/supabase/types';

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

function Field({
  name,
  title,
  children,
  note,
}: {
  name: string;
  title: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className={label}>
        {title}
      </label>
      {children}
      {note ? <p className={hint}>{note}</p> : null}
    </div>
  );
}

export function PropertyForm({
  action,
  property,
  submitLabel,
}: {
  action: Action;
  property?: Property;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-8">
      {property ? <input type="hidden" name="id" value={property.id} /> : null}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Location
        </h2>

        <Field name="name" title="Building name" note="Optional. Falls back to the street address.">
          <input id="name" name="name" defaultValue={property?.name ?? ''} className={input} />
        </Field>

        <Field name="address_line1" title="Street address">
          <input
            id="address_line1"
            name="address_line1"
            required
            defaultValue={property?.address_line1 ?? ''}
            className={input}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="city" title="City">
            <input id="city" name="city" defaultValue={property?.city ?? ''} className={input} />
          </Field>
          <Field name="state" title="State">
            <input
              id="state"
              name="state"
              maxLength={2}
              defaultValue={property?.state ?? ''}
              className={input}
            />
          </Field>
          <Field name="postal_code" title="ZIP">
            <input
              id="postal_code"
              name="postal_code"
              defaultValue={property?.postal_code ?? ''}
              className={input}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="latitude" title="Latitude" note="Optional. Used for the tour map.">
            <input
              id="latitude"
              name="latitude"
              inputMode="decimal"
              defaultValue={property?.latitude ?? ''}
              className={input}
            />
          </Field>
          <Field name="longitude" title="Longitude">
            <input
              id="longitude"
              name="longitude"
              inputMode="decimal"
              defaultValue={property?.longitude ?? ''}
              className={input}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Building
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="property_type" title="Type">
            <select
              id="property_type"
              name="property_type"
              defaultValue={property?.property_type ?? 'industrial'}
              className={input}
            >
              <option value="industrial">Industrial</option>
              <option value="office">Office</option>
              <option value="flex">Flex</option>
              <option value="retail">Retail</option>
              <option value="land">Land</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field name="year_built" title="Year built">
            <input
              id="year_built"
              name="year_built"
              inputMode="numeric"
              defaultValue={property?.year_built ?? ''}
              className={input}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="building_size_sf" title="Building SF">
            <input
              id="building_size_sf"
              name="building_size_sf"
              inputMode="numeric"
              defaultValue={property?.building_size_sf ?? ''}
              className={input}
            />
          </Field>
          <Field name="available_sf" title="Available SF">
            <input
              id="available_sf"
              name="available_sf"
              inputMode="numeric"
              defaultValue={property?.available_sf ?? ''}
              className={input}
            />
          </Field>
          <Field name="office_sf" title="Office SF">
            <input
              id="office_sf"
              name="office_sf"
              inputMode="numeric"
              defaultValue={property?.office_sf ?? ''}
              className={input}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="clear_height_ft" title="Clear height (ft)">
            <input
              id="clear_height_ft"
              name="clear_height_ft"
              inputMode="decimal"
              defaultValue={property?.clear_height_ft ?? ''}
              className={input}
            />
          </Field>
          <Field name="dock_doors" title="Dock doors">
            <input
              id="dock_doors"
              name="dock_doors"
              inputMode="numeric"
              defaultValue={property?.dock_doors ?? ''}
              className={input}
            />
          </Field>
          <Field name="drive_in_doors" title="Drive-ins">
            <input
              id="drive_in_doors"
              name="drive_in_doors"
              inputMode="numeric"
              defaultValue={property?.drive_in_doors ?? ''}
              className={input}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="power" title="Power">
            <input id="power" name="power" defaultValue={property?.power ?? ''} className={input} />
          </Field>
          <Field name="parking" title="Parking">
            <input
              id="parking"
              name="parking"
              defaultValue={property?.parking ?? ''}
              className={input}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Economics
        </h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="rent_rate" title="Rate ($/SF/yr)">
            <input
              id="rent_rate"
              name="rent_rate"
              inputMode="decimal"
              defaultValue={property?.rent_rate ?? ''}
              className={input}
            />
          </Field>
          <Field name="rent_type" title="Quoted as">
            <select
              id="rent_type"
              name="rent_type"
              defaultValue={property?.rent_type ?? 'nnn'}
              className={input}
            >
              <option value="nnn">NNN</option>
              <option value="base">Base</option>
              <option value="gross">Gross</option>
              <option value="modified_gross">Modified gross</option>
              <option value="negotiable">Negotiable</option>
            </select>
          </Field>
          <Field name="op_ex" title="OpEx ($/SF/yr)">
            <input
              id="op_ex"
              name="op_ex"
              inputMode="decimal"
              defaultValue={property?.op_ex ?? ''}
              className={input}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="available_date" title="Available">
            <input
              id="available_date"
              name="available_date"
              type="date"
              defaultValue={property?.available_date ?? ''}
              className={input}
            />
          </Field>
          <Field name="lease_term" title="Term">
            <input
              id="lease_term"
              name="lease_term"
              placeholder="5–7 years"
              defaultValue={property?.lease_term ?? ''}
              className={input}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Listing contact
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="listing_broker_name" title="Listing broker">
            <input
              id="listing_broker_name"
              name="listing_broker_name"
              defaultValue={property?.listing_broker_name ?? ''}
              className={input}
            />
          </Field>
          <Field name="listing_broker_company" title="Company">
            <input
              id="listing_broker_company"
              name="listing_broker_company"
              defaultValue={property?.listing_broker_company ?? ''}
              className={input}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="listing_broker_email" title="Email">
            <input
              id="listing_broker_email"
              name="listing_broker_email"
              type="email"
              defaultValue={property?.listing_broker_email ?? ''}
              className={input}
            />
          </Field>
          <Field name="listing_broker_phone" title="Phone">
            <input
              id="listing_broker_phone"
              name="listing_broker_phone"
              defaultValue={property?.listing_broker_phone ?? ''}
              className={input}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="brochure_url" title="Brochure URL">
            <input
              id="brochure_url"
              name="brochure_url"
              type="url"
              defaultValue={property?.brochure_url ?? ''}
              className={input}
            />
          </Field>
          <Field name="listing_url" title="Listing URL">
            <input
              id="listing_url"
              name="listing_url"
              type="url"
              defaultValue={property?.listing_url ?? ''}
              className={input}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Notes
        </h2>

        <Field
          name="description"
          title="Client-facing description"
          note="Shown to the client on the tour."
        >
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={property?.description ?? ''}
            className={input}
          />
        </Field>

        <Field
          name="notes"
          title="Internal notes"
          note="Never shown to a client. Negotiating position, landlord read, whatever you need."
        >
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={property?.notes ?? ''}
            className={`${input} border-amber-300 dark:border-amber-900/60`}
          />
        </Field>
      </section>

      {state && 'error' in state ? <p className={errorText}>{state.error}</p> : null}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={buttonPrimary}>
          {pending ? 'Saving…' : submitLabel}
        </button>
        <Link href="/properties" className={buttonSecondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
