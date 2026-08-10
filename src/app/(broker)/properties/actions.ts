'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  decimal,
  enumeration,
  integer,
  requiredText,
  runAction,
  text,
  ValidationError,
  type ActionState,
} from '@/lib/form';
import { createClient, getBroker } from '@/lib/supabase/server';
import type { PropertyInsert, PropertyType, RentType } from '@/lib/supabase/types';

const PROPERTY_TYPES: readonly PropertyType[] = [
  'office',
  'industrial',
  'flex',
  'retail',
  'land',
  'other',
];

const RENT_TYPES: readonly RentType[] = [
  'base',
  'nnn',
  'gross',
  'modified_gross',
  'negotiable',
];

function readPropertyForm(form: FormData, brokerId: string): PropertyInsert {
  return {
    broker_id: brokerId,
    name: text(form, 'name'),
    address_line1: requiredText(form, 'address_line1', 'Street address'),
    address_line2: text(form, 'address_line2'),
    city: text(form, 'city'),
    state: text(form, 'state'),
    postal_code: text(form, 'postal_code'),
    latitude: decimal(form, 'latitude'),
    longitude: decimal(form, 'longitude'),
    property_type: enumeration(form, 'property_type', PROPERTY_TYPES) ?? 'other',
    building_size_sf: integer(form, 'building_size_sf'),
    available_sf: integer(form, 'available_sf'),
    office_sf: integer(form, 'office_sf'),
    clear_height_ft: decimal(form, 'clear_height_ft'),
    dock_doors: integer(form, 'dock_doors'),
    drive_in_doors: integer(form, 'drive_in_doors'),
    power: text(form, 'power'),
    year_built: integer(form, 'year_built'),
    parking: text(form, 'parking'),
    rent_rate: decimal(form, 'rent_rate'),
    rent_type: enumeration(form, 'rent_type', RENT_TYPES),
    op_ex: decimal(form, 'op_ex'),
    available_date: text(form, 'available_date'),
    lease_term: text(form, 'lease_term'),
    listing_broker_name: text(form, 'listing_broker_name'),
    listing_broker_company: text(form, 'listing_broker_company'),
    listing_broker_email: text(form, 'listing_broker_email'),
    listing_broker_phone: text(form, 'listing_broker_phone'),
    brochure_url: text(form, 'brochure_url'),
    listing_url: text(form, 'listing_url'),
    description: text(form, 'description'),
    notes: text(form, 'notes'),
  };
}

export async function createProperty(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  let newId: string | null = null;

  const result = await runAction(async () => {
    const broker = await getBroker();
    if (!broker) throw new ValidationError('Your session expired. Sign in again.');

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('properties')
      .insert(readPropertyForm(form, broker.id))
      .select('id')
      .single();

    if (error) throw new ValidationError(error.message);
    newId = data.id;
  });

  if (result && 'ok' in result && newId) {
    revalidatePath('/properties');
    redirect(`/properties/${newId}`);
  }
  return result;
}

export async function updateProperty(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const broker = await getBroker();
    if (!broker) throw new ValidationError('Your session expired. Sign in again.');

    const id = requiredText(form, 'id', 'Property id');
    const supabase = await createClient();

    // No broker_id filter needed -- RLS scopes the update to rows this broker
    // owns. Passing it would only duplicate the policy.
    const { error } = await supabase
      .from('properties')
      .update(readPropertyForm(form, broker.id))
      .eq('id', id);

    if (error) throw new ValidationError(error.message);

    revalidatePath('/properties');
    revalidatePath(`/properties/${id}`);
  });
}

export async function deleteProperty(form: FormData): Promise<void> {
  const id = requiredText(form, 'id', 'Property id');
  const supabase = await createClient();

  const { error } = await supabase.from('properties').delete().eq('id', id);

  // A property on a tour is protected by ON DELETE RESTRICT. Surfacing that as
  // a redirect back with a flag beats a 500.
  if (error) {
    redirect(`/properties/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/properties');
  redirect('/properties');
}
