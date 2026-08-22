/**
 * Shape of the `public` schema, written to match what the Supabase generator
 * emits so it can be replaced wholesale once the project is linked:
 *
 *   npm run db:types
 *
 * Derived aliases and anything hand-written belong in ./types.ts, which this
 * file must never import -- otherwise regenerating clobbers them.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** Columns the database always fills in for us. */
type Defaulted = 'id' | 'created_at' | 'updated_at';

type Insertable<T, Optional extends keyof T = never> = Omit<T, Defaulted | Optional> &
  Partial<Pick<T, Extract<Defaulted | Optional, keyof T>>>;

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  company: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type ClientRow = {
  id: string;
  broker_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type PropertyRow = {
  id: string;
  broker_id: string;
  name: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  property_type: Database['public']['Enums']['property_type'];
  building_size_sf: number | null;
  available_sf: number | null;
  office_sf: number | null;
  clear_height_ft: number | null;
  dock_doors: number | null;
  drive_in_doors: number | null;
  power: string | null;
  year_built: number | null;
  parking: string | null;
  rent_rate: number | null;
  rent_type: Database['public']['Enums']['rent_type'] | null;
  op_ex: number | null;
  available_date: string | null;
  lease_term: string | null;
  listing_broker_name: string | null;
  listing_broker_company: string | null;
  listing_broker_email: string | null;
  listing_broker_phone: string | null;
  /** Object key in the private `property-photos` bucket. */
  photo_path: string | null;
  brochure_url: string | null;
  listing_url: string | null;
  /** Client-facing blurb. Safe to show a guest. */
  description: string | null;
  /** Broker-internal. Not selectable through the guest views. */
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type TourRow = {
  id: string;
  broker_id: string;
  client_id: string | null;
  title: string;
  status: Database['public']['Enums']['tour_status'];
  tour_date: string | null;
  start_time: string | null;
  market: string | null;
  requirement_summary: string | null;
  /** Broker-internal. Not selectable through the guest views. */
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type TourStopRow = {
  id: string;
  tour_id: string;
  property_id: string;
  position: number;
  scheduled_at: string | null;
  duration_minutes: number | null;
  /** Broker-internal. Not selectable through the guest views. */
  broker_notes: string | null;
  visited_at: string | null;
  created_at: string;
  updated_at: string;
};

type TourShareRow = {
  id: string;
  tour_id: string;
  token: string;
  label: string | null;
  allow_notes: boolean;
  allow_photos: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  created_by: string;
  created_at: string;
};

type TourParticipantRow = {
  id: string;
  tour_id: string;
  user_id: string;
  share_id: string | null;
  role: Database['public']['Enums']['participant_role'];
  display_name: string;
  company: string | null;
  removed_at: string | null;
  can_add_notes: boolean;
  can_add_photos: boolean;
  created_at: string;
  updated_at: string;
};

type StopNoteRow = {
  id: string;
  tour_id: string;
  stop_id: string;
  participant_id: string;
  body: string;
  rating: number | null;
  created_at: string;
  updated_at: string;
};

type StopPhotoRow = {
  id: string;
  tour_id: string;
  stop_id: string;
  participant_id: string;
  /** Object key in the `tour-photos` bucket. Always `<tour_id>/...`. */
  storage_path: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  taken_at: string | null;
  created_at: string;
  updated_at: string;
};

type GuestTourRow = Pick<
  TourRow,
  'id' | 'title' | 'status' | 'tour_date' | 'start_time' | 'market' | 'requirement_summary'
>;

type GuestTourStopRow = Pick<
  TourStopRow,
  'id' | 'tour_id' | 'property_id' | 'position' | 'scheduled_at' | 'duration_minutes' | 'visited_at'
>;

type GuestPropertyRow = Omit<
  PropertyRow,
  | 'broker_id'
  | 'notes'
  | 'listing_broker_name'
  | 'listing_broker_company'
  | 'listing_broker_email'
  | 'listing_broker_phone'
  | 'listing_url'
  | 'created_at'
  | 'updated_at'
>;

/**
 * Foreign keys, in the shape the generator emits. supabase-js reads these to
 * type embedded selects like `.select('tour_stops(count)')`, so an embed that
 * suddenly resolves to GenericStringError usually means a missing entry here.
 */
type Fk<
  Name extends string,
  Column extends string,
  Relation extends string,
  OneToOne extends boolean = false,
> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: OneToOne;
  referencedRelation: Relation;
  referencedColumns: ['id'];
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Insertable<ProfileRow, 'email' | 'full_name' | 'company' | 'phone' | 'avatar_url'>;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      clients: {
        Row: ClientRow;
        Insert: Insertable<ClientRow, 'company' | 'email' | 'phone' | 'notes'>;
        Update: Partial<ClientRow>;
        Relationships: [Fk<'clients_broker_id_fkey', 'broker_id', 'profiles'>];
      };
      properties: {
        Row: PropertyRow;
        Insert: Insertable<PropertyRow, Exclude<keyof PropertyRow, 'broker_id' | 'address_line1'>>;
        Update: Partial<PropertyRow>;
        Relationships: [Fk<'properties_broker_id_fkey', 'broker_id', 'profiles'>];
      };
      tours: {
        Row: TourRow;
        Insert: Insertable<TourRow, Exclude<keyof TourRow, 'broker_id' | 'title'>>;
        Update: Partial<TourRow>;
        Relationships: [
          Fk<'tours_broker_id_fkey', 'broker_id', 'profiles'>,
          Fk<'tours_client_id_fkey', 'client_id', 'clients'>,
        ];
      };
      tour_stops: {
        Row: TourStopRow;
        Insert: Insertable<
          TourStopRow,
          'scheduled_at' | 'duration_minutes' | 'broker_notes' | 'visited_at'
        >;
        Update: Partial<TourStopRow>;
        Relationships: [
          Fk<'tour_stops_tour_id_fkey', 'tour_id', 'tours'>,
          Fk<'tour_stops_property_id_fkey', 'property_id', 'properties'>,
        ];
      };
      tour_shares: {
        Row: TourShareRow;
        Insert: Insertable<
          TourShareRow,
          'token' | 'label' | 'allow_notes' | 'allow_photos' | 'expires_at' | 'revoked_at'
        >;
        Update: Partial<TourShareRow>;
        Relationships: [
          Fk<'tour_shares_tour_id_fkey', 'tour_id', 'tours'>,
          Fk<'tour_shares_created_by_fkey', 'created_by', 'profiles'>,
        ];
      };
      tour_participants: {
        Row: TourParticipantRow;
        Insert: Insertable<
          TourParticipantRow,
          'share_id' | 'role' | 'company' | 'removed_at' | 'can_add_notes' | 'can_add_photos'
        >;
        Update: Partial<TourParticipantRow>;
        Relationships: [
          Fk<'tour_participants_tour_id_fkey', 'tour_id', 'tours'>,
          Fk<'tour_participants_share_id_fkey', 'share_id', 'tour_shares'>,
        ];
      };
      stop_notes: {
        Row: StopNoteRow;
        Insert: Insertable<StopNoteRow, 'rating'>;
        Update: Partial<StopNoteRow>;
        Relationships: [
          Fk<'stop_notes_tour_id_fkey', 'tour_id', 'tours'>,
          Fk<'stop_notes_stop_id_fkey', 'stop_id', 'tour_stops'>,
          Fk<'stop_notes_participant_id_fkey', 'participant_id', 'tour_participants'>,
        ];
      };
      stop_photos: {
        Row: StopPhotoRow;
        Insert: Insertable<
          StopPhotoRow,
          'caption' | 'width' | 'height' | 'size_bytes' | 'taken_at'
        >;
        Update: Partial<StopPhotoRow>;
        Relationships: [
          Fk<'stop_photos_tour_id_fkey', 'tour_id', 'tours'>,
          Fk<'stop_photos_stop_id_fkey', 'stop_id', 'tour_stops'>,
          Fk<'stop_photos_participant_id_fkey', 'participant_id', 'tour_participants'>,
        ];
      };
    };
    Views: {
      guest_tours: { Row: GuestTourRow; Relationships: [] };
      guest_tour_stops: { Row: GuestTourStopRow; Relationships: [] };
      guest_properties: { Row: GuestPropertyRow; Relationships: [] };
    };
    Functions: {
      preview_tour_share: {
        Args: { p_token: string };
        Returns: {
          valid: boolean;
          reason: string | null;
          tour_id: string | null;
          tour_title: string | null;
          tour_date: string | null;
          start_time: string | null;
          market: string | null;
          stop_count: number | null;
          broker_name: string | null;
          broker_company: string | null;
          allow_notes: boolean | null;
          allow_photos: boolean | null;
        };
      };
      join_tour: {
        Args: { p_token: string; p_display_name: string; p_company?: string | null };
        Returns: {
          tour_id: string;
          participant_id: string;
          display_name: string;
          role: Database['public']['Enums']['participant_role'];
          can_add_notes: boolean;
          can_add_photos: boolean;
        };
      };
      create_tour_share: {
        Args: {
          p_tour_id: string;
          p_label?: string | null;
          p_allow_notes?: boolean;
          p_allow_photos?: boolean;
          p_expires_at?: string | null;
        };
        Returns: TourShareRow;
      };
      reorder_tour_stops: {
        Args: { p_tour_id: string; p_stop_ids: string[] };
        Returns: undefined;
      };
      next_stop_position: {
        Args: { p_tour_id: string };
        Returns: number;
      };
    };
    Enums: {
      tour_status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'archived';
      participant_role: 'broker' | 'guest';
      property_type: 'office' | 'industrial' | 'flex' | 'retail' | 'land' | 'other';
      rent_type: 'base' | 'nnn' | 'gross' | 'modified_gross' | 'negotiable';
    };
    CompositeTypes: Record<string, never>;
  };
};
