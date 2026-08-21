import { useColorScheme } from 'react-native';

/**
 * ─── BRAND ───────────────────────────────────────────────────────────────
 *
 * Cresa: a deep navy wordmark with an amber dot-matrix mark. Everything
 * visual in the app resolves from these values -- no screen hard-codes a
 * colour, so correcting a value here corrects it everywhere.
 *
 * Read off the logo rather than a brand specification, so nudge them if the
 * official guide differs.
 */
const BRAND = {
  /** Cresa navy. Buttons, headers, active tabs. */
  primary: '#0A2158',
  /** A lighter step of the navy, for gradient depth and dark-mode surfaces. */
  primaryLift: '#1A3C82',
  /** Cresa amber. The energy in the brand -- used sparingly, so it lands. */
  accent: '#FAA61A',
  /** Ratings. The same amber, since it is already the brand's highlight. */
  gold: '#FAA61A',
  /** Destructive. Kept clearly outside the brand pair so it reads as a stop. */
  danger: '#C4362C',
};

const light = {
  // Grounds — a faint navy cast rather than neutral grey, so white cards lift
  // and the whole app sits in the same family as the wordmark.
  canvas: '#F1F4F9',
  surface: '#FFFFFF',
  surfaceSunken: '#E8EDF4',
  surfaceRaised: '#FFFFFF',

  text: '#0A1424',
  textMuted: '#556173',
  textFaint: '#8A94A5',
  border: '#DCE3ED',
  borderStrong: '#C3CDDC',

  primary: BRAND.primary,
  primaryLift: BRAND.primaryLift,
  onPrimary: '#FFFFFF',
  primarySoft: '#E5EBF6',

  // Amber is a fill, never body text: #FAA61A on white is about 2:1, which is
  // unreadable. `accentInk` is the darkened amber used for text sitting on
  // `accentSoft`, and `onAccent` is what goes on top of a solid amber fill.
  accent: BRAND.accent,
  accentSoft: '#FFF2DC',
  accentInk: '#8A5804',
  onAccent: BRAND.primary,

  // Broker-only content. Amber now belongs to the brand, so "private" is shown
  // by recessing it -- a sunken slate surface, below the page rather than
  // shouting from it -- plus a lock. Distinct by treatment, not by hue.
  internal: '#46566B',
  internalSoft: '#E7ECF3',
  internalBorder: '#B9C6D6',

  gold: BRAND.gold,
  danger: BRAND.danger,
  dangerSoft: '#FBEAE8',

  success: '#0E7B5B',
  successSoft: '#DFF3EC',

  scrim: 'rgba(10, 20, 36, 0.45)',
};

const dark: typeof light = {
  canvas: '#070B14',
  surface: '#111A2B',
  surfaceSunken: '#0C1422',
  surfaceRaised: '#172236',

  text: '#E9EEF7',
  textMuted: '#98A6BC',
  textFaint: '#6A7891',
  border: '#233047',
  borderStrong: '#31405A',

  // The brand navy is too dark to read against a dark ground, so the primary
  // lifts to a tint of itself while staying recognisably the same hue.
  primary: '#7FA0E0',
  primaryLift: '#A6BEEC',
  onPrimary: '#060D1C',
  primarySoft: '#16233C',

  accent: BRAND.accent,
  accentSoft: '#2B1F09',
  accentInk: '#F5B84B',
  onAccent: '#1A1200',

  internal: '#93A3BA',
  internalSoft: '#141D2D',
  internalBorder: '#2D3B52',

  gold: BRAND.gold,
  danger: '#F0938A',
  dangerSoft: '#2C1512',

  success: '#4FC79B',
  successSoft: '#0C2620',

  scrim: 'rgba(0, 0, 0, 0.6)',
};

export type Palette = typeof light;

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}

/** Header gradient. Two stops of the primary, so it reads as depth not decoration. */
export const headerGradient = (t: Palette): [string, string] => [t.primary, t.primaryLift];

/**
 * A 4pt rhythm. Named by role rather than size so screens stay consistent
 * when a value changes.
 */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

/**
 * Type scale. Large, confident headings are most of the difference between
 * "a form" and "an app" on a phone.
 */
export const type = {
  display: { fontSize: 32, lineHeight: 37, fontWeight: '800' as const, letterSpacing: -0.8 },
  title: { fontSize: 25, lineHeight: 30, fontWeight: '800' as const, letterSpacing: -0.5 },
  heading: { fontSize: 18, lineHeight: 23, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: '600' as const },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800' as const,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
};

/**
 * Elevation. Shadows are what stop stacked cards reading as a flat list --
 * two soft layers rather than one hard one, which is the difference between
 * "drop shadow" and "lifted".
 */
export function elevation(level: 0 | 1 | 2 | 3, isDark: boolean) {
  if (level === 0) return {};
  const opacity = isDark ? [0, 0.4, 0.5, 0.6][level] : [0, 0.06, 0.09, 0.13][level];
  const radiusPx = [0, 8, 18, 30][level];
  const offset = [0, 2, 6, 12][level];
  return {
    shadowColor: '#000',
    shadowOpacity: opacity,
    shadowRadius: radiusPx,
    shadowOffset: { width: 0, height: offset },
    elevation: level * 3,
  };
}

/** Minimum comfortable tap target. Tours happen one-handed, outdoors, in gloves. */
export const TAP = 48;

/** Tour status, as something you can read at a glance rather than parse. */
export function statusStyle(status: string, t: Palette) {
  switch (status) {
    case 'in_progress':
      return { bg: t.accentSoft, fg: t.accentInk, label: 'Touring now' };
    case 'scheduled':
      return { bg: t.primarySoft, fg: t.primary, label: 'Scheduled' };
    case 'completed':
      return { bg: t.successSoft, fg: t.success, label: 'Complete' };
    case 'archived':
      return { bg: t.surfaceSunken, fg: t.textFaint, label: 'Archived' };
    default:
      return { bg: t.surfaceSunken, fg: t.textMuted, label: 'Draft' };
  }
}
