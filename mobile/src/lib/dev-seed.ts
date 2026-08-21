import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';

/**
 * Puts a realistic tour in a brand-new development account.
 *
 * A freshly provisioned broker owns nothing, so every screen would open on its
 * empty state -- which shows the app works but not what it is for. This writes
 * one client, three properties and a scheduled tour through the ordinary
 * client, exactly as the app's own forms do, so what you are looking at is real
 * data under real security rules rather than a mock.
 *
 * Runs once per account. Delete the rows in the app and they stay deleted.
 */

const seededKey = (userId: string) => `cre.dev-seeded.v1.${userId}`;

/** A date a few days out, as the `date` column wants it: YYYY-MM-DD. */
function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const PROPERTIES = [
  {
    name: 'Gateway Commerce Center — Building C',
    address_line1: '4820 Gateway Boulevard',
    city: 'Grand Rapids',
    state: 'MI',
    postal_code: '49512',
    property_type: 'industrial' as const,
    building_size_sf: 182_000,
    available_sf: 64_500,
    office_sf: 4_200,
    clear_height_ft: 32,
    dock_doors: 8,
    drive_in_doors: 1,
    power: '1200A, 277/480V 3-phase',
    year_built: 2019,
    parking: '92 surface spaces, 14 trailer stalls',
    rent_rate: 7.25,
    rent_type: 'nnn' as const,
    op_ex: 1.85,
    lease_term: '5–7 years',
    listing_broker_name: 'Dana Whitfield',
    listing_broker_company: 'Colliers',
    description:
      'Cross-dock configuration with 32′ clear and heavy power. Suite is fully ' +
      'sprinklered and the office is built out and in good condition.',
    notes:
      'Landlord is motivated — building has carried vacancy since Q1. Dana hinted ' +
      'at 6 months free on a 7-year term. Do not lead with this.',
  },
  {
    name: 'Riverbend Logistics Park',
    address_line1: '1170 Wealthy Street SE',
    city: 'Grand Rapids',
    state: 'MI',
    postal_code: '49506',
    property_type: 'industrial' as const,
    building_size_sf: 96_000,
    available_sf: 48_000,
    office_sf: 6_800,
    clear_height_ft: 24,
    dock_doors: 6,
    drive_in_doors: 2,
    power: '800A, 277/480V 3-phase',
    year_built: 2004,
    parking: '110 surface spaces',
    rent_rate: 6.5,
    rent_type: 'nnn' as const,
    op_ex: 2.1,
    lease_term: '3–5 years',
    listing_broker_name: 'Marcus Reyes',
    listing_broker_company: 'JLL',
    description:
      'Closest option to the client’s existing workforce. Lower clear height, but ' +
      'the office build-out is the strongest of the three.',
    notes: 'Confirm the OpEx number — Marcus quoted 2.10 but the 2025 recs came in at 2.34.',
  },
  {
    name: 'Northpointe Flex II',
    address_line1: '3305 Northpointe Drive NE',
    city: 'Grand Rapids',
    state: 'MI',
    postal_code: '49525',
    property_type: 'flex' as const,
    building_size_sf: 54_000,
    available_sf: 22_000,
    office_sf: 9_500,
    clear_height_ft: 18,
    dock_doors: 2,
    drive_in_doors: 2,
    power: '400A, 120/208V',
    year_built: 2016,
    parking: '78 surface spaces',
    rent_rate: 11.75,
    rent_type: 'gross' as const,
    lease_term: '3 years',
    listing_broker_name: 'Priya Raghavan',
    listing_broker_company: 'Cushman & Wakefield',
    description:
      'Highest office ratio and the most presentable front entrance. Undersized on ' +
      'warehouse if volumes grow.',
    notes: 'Backup option. Only showing it because the CFO asked to see a gross deal.',
  },
];

const STOP_NOTES = [
  'Start here — best chance of holding their attention while everyone is fresh.',
  'Walk the dock apron before going inside. Ask about the drainage.',
  'Short stop. 20 minutes unless they engage.',
];

export async function seedDevWorkspaceOnce(userId: string): Promise<void> {
  const key = seededKey(userId);
  if (await AsyncStorage.getItem(key)) return;

  // Claim the key first: a double-mounted provider would otherwise seed twice.
  await AsyncStorage.setItem(key, new Date().toISOString());

  try {
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert({
        broker_id: userId,
        name: 'Ridgeline Logistics',
        company: 'Ridgeline Logistics, Inc.',
        email: 'operations@ridgelinelogistics.example',
        phone: '(616) 555-0142',
        notes: 'Lease expires 3/31/2027. Decision committee is the COO and the CFO.',
      })
      .select('id')
      .single();

    if (clientError) throw clientError;

    const { data: properties, error: propertyError } = await supabase
      .from('properties')
      .insert(PROPERTIES.map((property) => ({ ...property, broker_id: userId })))
      .select('id');

    if (propertyError) throw propertyError;

    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .insert({
        broker_id: userId,
        client_id: client.id,
        title: 'Ridgeline Logistics — GR Market Tour',
        status: 'scheduled',
        tour_date: daysFromNow(3),
        start_time: '09:30',
        market: 'Grand Rapids, MI',
        requirement_summary:
          '45,000–65,000 SF industrial, 28′+ clear, 6+ docks, occupancy by Q2 2027.',
        notes: 'CFO joins at the second stop only. Keep Gateway last if he is running late.',
      })
      .select('id')
      .single();

    if (tourError) throw tourError;

    const { error: stopsError } = await supabase.from('tour_stops').insert(
      properties.map((property, index) => ({
        tour_id: tour.id,
        property_id: property.id,
        position: index,
        duration_minutes: index === 2 ? 20 : 45,
        broker_notes: STOP_NOTES[index],
      })),
    );

    if (stopsError) throw stopsError;

    console.log('[dev] seeded a sample client, three properties and a tour');
  } catch (error) {
    // Seeding is a convenience. If it fails the app still works, so log it and
    // let the empty states do their job rather than blocking the launch.
    console.warn('[dev] could not seed sample data:', error);
  }
}
