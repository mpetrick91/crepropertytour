import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { DemoQuery } from './query';
import { DEMO_USER_ID, initialTables, type Row, type Tables } from './tables';

/**
 * A stand-in for the Supabase client that runs entirely on the device.
 *
 * Demo mode exists so the app can be opened and used without a sign-in of any
 * kind. Authentication cannot simply be deleted from the real client: the
 * database decides what a request may read from who is signed in, so an app
 * with no session sees nothing at all. Rather than pretend, demo mode replaces
 * the database with a local one where that question does not arise.
 *
 * What this means, stated plainly: nothing here talks to Supabase, and no
 * security rule is being bypassed -- there is nothing on the other end to
 * bypass. Turn demo mode off and the real client, the real rules and the real
 * sign-in come back untouched.
 */

const STORAGE_KEY = 'cre.demo-database.v1';

function uuid(): string {
  const bytes = Crypto.getRandomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const DEMO_USER = {
  id: DEMO_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'you@cresa.com',
  is_anonymous: false,
  app_metadata: { provider: 'demo' },
  user_metadata: { full_name: 'Michael Petrick' },
  created_at: new Date(0).toISOString(),
};

const DEMO_SESSION = {
  access_token: 'demo-access-token',
  refresh_token: 'demo-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: DEMO_USER,
};

/**
 * Bytes to base64, without a Buffer or a polyfill.
 *
 * Demo mode has no object store to hand back a URL from, so an uploaded photo
 * becomes a data URI and displays exactly as a signed link would. Hermes has
 * no btoa, and pulling in a base64 package to make a demo work would be a
 * dependency the real app never uses.
 */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toBase64(input: Uint8Array): string {
  let output = '';
  for (let i = 0; i < input.length; i += 3) {
    const a = input[i];
    const b = input[i + 1];
    const c = input[i + 2];
    output += B64[a >> 2];
    output += B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    output += b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    output += c === undefined ? '=' : B64[c & 63];
  }
  return output;
}

export function createDemoClient() {
  const tables: Tables = initialTables();
  // Photo bytes, keyed by the storage path the app generates.
  const objects = new Map<string, string>();

  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Persisted so edits survive a reload. Debounced because a single screen
   * action can write several rows and there is no reason to serialise between
   * them.
   */
  function persist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tables)).catch(() => {});
    }, 250);
  }

  /**
   * Replaces the contents of `tables` without replacing the object itself --
   * queries already built hold a reference to it, and swapping it out would
   * leave them reading a database nothing else can see.
   */
  function refill(next: Tables) {
    for (const key of Object.keys(tables)) delete tables[key];
    Object.assign(tables, next);
  }

  async function restore() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Tables;
      // Only trust it if it still looks like the schema this build expects.
      if (parsed && Array.isArray(parsed.tours)) refill(parsed);
    } catch {
      // A corrupt copy is not worth surfacing; the seeded tables stand in.
    }
  }

  /** Discards local edits and puts the sample tour back. */
  async function reset() {
    refill(initialTables());
    objects.clear();
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  const auth = {
    getSession: async () => ({ data: { session: DEMO_SESSION }, error: null }),
    getUser: async () => ({ data: { user: DEMO_USER }, error: null }),
    signInWithPassword: async () => ({ data: { session: DEMO_SESSION, user: DEMO_USER }, error: null }),
    signInAnonymously: async () => ({ data: { session: DEMO_SESSION, user: DEMO_USER }, error: null }),
    signUp: async () => ({ data: { session: DEMO_SESSION, user: DEMO_USER }, error: null }),
    signInWithOtp: async () => ({ data: {}, error: null }),
    verifyOtp: async () => ({ data: { session: DEMO_SESSION, user: DEMO_USER }, error: null }),
    setSession: async () => ({ data: { session: DEMO_SESSION, user: DEMO_USER }, error: null }),
    updateUser: async () => ({ data: { user: DEMO_USER }, error: null }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: (callback: (event: string, session: typeof DEMO_SESSION) => void) => {
      // Delivered asynchronously, as the real client does, so subscribers are
      // never called during their own render.
      setTimeout(() => callback('SIGNED_IN', DEMO_SESSION), 0);
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
  };

  function rows(table: string): Row[] {
    return (tables[table] ??= []);
  }

  /** The database functions the app calls, reimplemented against the tables. */
  const functions: Record<string, (args: Record<string, unknown>) => unknown> = {
    next_stop_position: ({ p_tour_id }) => {
      const positions = rows('tour_stops')
        .filter((row) => row.tour_id === p_tour_id)
        .map((row) => Number(row.position ?? 0));
      return positions.length ? Math.max(...positions) + 1 : 0;
    },

    reorder_tour_stops: ({ p_tour_id, p_stop_ids }) => {
      const order = (p_stop_ids as string[]) ?? [];
      for (const row of rows('tour_stops')) {
        if (row.tour_id !== p_tour_id) continue;
        const index = order.indexOf(row.id as string);
        if (index >= 0) row.position = index;
      }
      persist();
      return null;
    },

    create_tour_share: ({ p_tour_id, p_label, p_allow_notes, p_allow_photos }) => {
      const token = uuid().replace(/-/g, '').slice(0, 22);
      const share = {
        id: uuid(),
        tour_id: p_tour_id,
        token,
        label: p_label ?? null,
        allow_notes: p_allow_notes !== false,
        allow_photos: p_allow_photos !== false,
        expires_at: null,
        revoked_at: null,
        created_at: new Date().toISOString(),
      };
      rows('tour_shares').push(share);
      persist();
      return share;
    },

    preview_tour_share: ({ p_token }) => {
      const share = rows('tour_shares').find((row) => row.token === p_token);
      if (!share) return null;
      const tour = rows('tours').find((row) => row.id === share.tour_id);
      return tour
        ? {
            tour_id: tour.id,
            title: tour.title,
            tour_date: tour.tour_date,
            market: tour.market,
            allow_notes: share.allow_notes,
            allow_photos: share.allow_photos,
          }
        : null;
    },

    join_tour: ({ p_token, p_display_name, p_company, p_email }) => {
      const share = rows('tour_shares').find((row) => row.token === p_token);
      if (!share) return null;

      const participant = {
        id: uuid(),
        tour_id: share.tour_id,
        display_name: p_display_name ?? 'Guest',
        company: p_company ?? null,
        email: p_email ?? null,
        role: 'guest',
        created_at: new Date().toISOString(),
      };
      rows('tour_participants').push(participant);
      persist();
      return participant;
    },
  };

  const storage = {
    from: () => ({
      upload: async (
        path: string,
        bytes: ArrayBuffer | Uint8Array,
        options?: { contentType?: string },
      ) => {
        const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        const type = options?.contentType ?? 'image/jpeg';
        // A data URI, so the photo displays exactly as one behind a signed
        // link would. Held in memory only: demo photos do not survive a
        // reload, which is the honest behaviour for a database that is not
        // really there.
        objects.set(path, `data:${type};base64,${toBase64(view)}`);
        return { data: { path }, error: null };
      },
      remove: async (paths: string[]) => {
        for (const path of paths) objects.delete(path);
        return { data: null, error: null };
      },
      createSignedUrls: async (paths: string[]) => ({
        data: paths.map((path) => ({ path, signedUrl: objects.get(path) ?? '' })),
        error: null,
      }),
      createSignedUrl: async (path: string) => ({
        data: { signedUrl: objects.get(path) ?? '' },
        error: null,
      }),
    }),
  };

  return {
    isDemo: true as const,
    auth,
    from: (table: string) => new DemoQuery(tables, table, persist, uuid),
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      const implementation = functions[name];
      if (!implementation) return { data: null, error: { message: `Unknown function ${name}` } };
      try {
        return { data: implementation(args), error: null };
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Demo function failed';
        return { data: null, error: { message } };
      }
    },
    storage,
    restore,
    reset,
  };
}

export type DemoClient = ReturnType<typeof createDemoClient>;
