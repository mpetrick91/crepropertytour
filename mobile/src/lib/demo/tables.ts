/**
 * The sample database demo mode runs on.
 *
 * Shaped exactly like the real tables, because the screens that read it are the
 * real screens -- nothing here is a mock component or a stub view. Ids are
 * fixed rather than generated so a reload lands on the same tour.
 */

export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';
const CLIENT_ID = '00000000-0000-4000-8000-000000000010';
const TOUR_ID = '00000000-0000-4000-8000-000000000020';
const PROPERTY_IDS = [
  '00000000-0000-4000-8000-000000000031',
  '00000000-0000-4000-8000-000000000032',
  '00000000-0000-4000-8000-000000000033',
];
const STOP_IDS = [
  '00000000-0000-4000-8000-000000000041',
  '00000000-0000-4000-8000-000000000042',
  '00000000-0000-4000-8000-000000000043',
];
const PARTICIPANT_IDS = [
  '00000000-0000-4000-8000-000000000051',
  '00000000-0000-4000-8000-000000000052',
];

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export function initialTables(): Tables {
  const now = new Date().toISOString();

  return {
    profiles: [
      {
        id: DEMO_USER_ID,
        email: 'you@cresa.com',
        full_name: 'Michael Petrick',
        company: 'Cresa',
        created_at: now,
        updated_at: now,
      },
    ],

    clients: [
      {
        id: CLIENT_ID,
        broker_id: DEMO_USER_ID,
        name: 'Ridgeline Logistics',
        company: 'Ridgeline Logistics, Inc.',
        email: 'operations@ridgelinelogistics.example',
        phone: '(616) 555-0142',
        notes: 'Lease expires 3/31/2027. Decision committee is the COO and the CFO.',
        created_at: now,
        updated_at: now,
      },
    ],

    properties: [
      {
        id: PROPERTY_IDS[0],
        broker_id: DEMO_USER_ID,
        name: 'Gateway Commerce Center — Building C',
        address_line1: '4820 Gateway Boulevard',
        city: 'Grand Rapids',
        state: 'MI',
        postal_code: '49512',
        country: 'US',
        property_type: 'industrial',
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
        rent_type: 'nnn',
        op_ex: 1.85,
        lease_term: '5–7 years',
        latitude: 42.8814,
        longitude: -85.5228,
        listing_broker_name: 'Dana Whitfield',
        listing_broker_company: 'Colliers',
        listing_broker_email: 'd.whitfield@colliers.example',
        listing_broker_phone: '(616) 555-0188',
        brochure_url: 'https://example.com/gateway-commerce-building-c.pdf',
        listing_url: 'https://example.com/listings/gateway-commerce-c',
        description:
          'Cross-dock configuration with 32′ clear and heavy power. Suite is fully ' +
          'sprinklered and the office is built out and in good condition.',
        notes:
          'Landlord is motivated — building has carried vacancy since Q1. Dana hinted ' +
          'at 6 months free on a 7-year term. Do not lead with this.',
        created_at: now,
        updated_at: now,
      },
      {
        id: PROPERTY_IDS[1],
        broker_id: DEMO_USER_ID,
        name: 'Riverbend Logistics Park',
        address_line1: '1170 Wealthy Street SE',
        city: 'Grand Rapids',
        state: 'MI',
        postal_code: '49506',
        country: 'US',
        property_type: 'industrial',
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
        rent_type: 'nnn',
        op_ex: 2.1,
        lease_term: '3–5 years',
        latitude: 42.9494,
        longitude: -85.6459,
        listing_broker_name: 'Marcus Reyes',
        listing_broker_company: 'JLL',
        listing_broker_email: 'm.reyes@jll.example',
        listing_broker_phone: '(616) 555-0113',
        brochure_url: 'https://example.com/riverbend-logistics-park.pdf',
        description:
          'Closest option to the client’s existing workforce. Lower clear height, but ' +
          'the office build-out is the strongest of the three.',
        notes: 'Confirm the OpEx — Marcus quoted 2.10 but the 2025 recs came in at 2.34.',
        created_at: now,
        updated_at: now,
      },
      {
        id: PROPERTY_IDS[2],
        broker_id: DEMO_USER_ID,
        name: 'Northpointe Flex II',
        address_line1: '3305 Northpointe Drive NE',
        city: 'Grand Rapids',
        state: 'MI',
        postal_code: '49525',
        country: 'US',
        property_type: 'flex',
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
        rent_type: 'gross',
        lease_term: '3 years',
        latitude: 43.0342,
        longitude: -85.5931,
        listing_broker_name: 'Priya Raghavan',
        listing_broker_company: 'Cushman & Wakefield',
        listing_broker_phone: '(616) 555-0175',
        description:
          'Highest office ratio and the most presentable front entrance. Undersized on ' +
          'warehouse if volumes grow.',
        notes: 'Backup option. Only showing it because the CFO asked to see a gross deal.',
        created_at: now,
        updated_at: now,
      },
    ],

    tours: [
      {
        id: TOUR_ID,
        broker_id: DEMO_USER_ID,
        client_id: CLIENT_ID,
        title: 'Ridgeline Logistics — GR Market Tour',
        status: 'scheduled',
        tour_date: daysFromNow(3),
        start_time: '09:30',
        market: 'Grand Rapids, MI',
        requirement_summary:
          '45,000–65,000 SF industrial, 28′+ clear, 6+ docks, occupancy by Q2 2027.',
        notes: 'CFO joins at the second stop only. Keep Gateway last if he is running late.',
        created_at: now,
        updated_at: now,
      },
    ],

    tour_stops: STOP_IDS.map((id, index) => ({
      id,
      tour_id: TOUR_ID,
      property_id: PROPERTY_IDS[index],
      position: index,
      duration_minutes: index === 2 ? 20 : 45,
      broker_notes: [
        'Start here — best chance of holding their attention while everyone is fresh.',
        'Walk the dock apron before going inside. Ask about the drainage.',
        'Short stop. 20 minutes unless they engage.',
      ][index],
      scheduled_at: null,
      visited_at: null,
      created_at: now,
      updated_at: now,
    })),

    tour_participants: [
      {
        id: PARTICIPANT_IDS[0],
        tour_id: TOUR_ID,
        display_name: 'Michael Petrick',
        role: 'broker',
        company: 'Cresa',
        email: 'you@cresa.com',
        created_at: now,
      },
      {
        id: PARTICIPANT_IDS[1],
        tour_id: TOUR_ID,
        display_name: 'Angela Cortez',
        role: 'guest',
        company: 'Ridgeline Logistics',
        email: 'a.cortez@ridgelinelogistics.example',
        created_at: now,
      },
    ],

    stop_notes: [
      {
        id: '00000000-0000-4000-8000-000000000061',
        tour_id: TOUR_ID,
        stop_id: STOP_IDS[0],
        participant_id: PARTICIPANT_IDS[1],
        body: 'Dock apron is tight for a 53′ trailer. Ask whether the neighbour shares it.',
        rating: 4,
        created_at: minutesAgo(90),
        updated_at: minutesAgo(90),
      },
      {
        id: '00000000-0000-4000-8000-000000000062',
        tour_id: TOUR_ID,
        stop_id: STOP_IDS[1],
        participant_id: PARTICIPANT_IDS[0],
        body: 'Office finishes are the best we have seen. Angela liked the break room.',
        rating: 5,
        created_at: minutesAgo(45),
        updated_at: minutesAgo(45),
      },
    ],

    stop_photos: [],
    property_photos: [],
    tour_shares: [],
  };
}
