import { useColorScheme } from 'react-native';

/**
 * ─── BRAND ───────────────────────────────────────────────────────────────
 *
 * Everything visual comes from this file. Swapping in Cresa's exact palette
 * means changing the six values in BRAND below and nothing else -- no screen
 * hard-codes a colour.
 *
 * These are a considered placeholder, not verified Cresa values: a deep
 * ink-navy carries the professional weight a client-facing tool needs, with a
 * warm amber reserved for broker-only content so it is impossible to confuse
 * with anything a client sees.
 */
const BRAND = {
  /** Primary. Buttons, active tabs, headers. */
  primary: '#0F2E4C',
  /** Lighter step of the primary, for gradients and dark-mode surfaces. */
  primaryLift: '#1D4F7C',
  /** Used sparingly for delight: progress, celebration, active states. */
  accent: '#00A6A6',
  /** Broker-only content. Deliberately unlike anything else in the app. */
  internal: '#B4690E',
  /** Ratings and highlights. */
  gold: '#E0A32E',
  /** Destructive. */
  danger: '#C4362C',
};

const light = {
  // Grounds — a faint blue cast rather than neutral grey, so white cards lift.
  canvas: '#F2F5F8',
  surface: '#FFFFFF',
  surfaceSunken: '#E9EEF3',
  surfaceRaised: '#FFFFFF',

  text: '#0C1620',
  textMuted: '#5A6875',
  textFaint: '#8B98A6',
  border: '#DDE4EB',
  borderStrong: '#C6D0DA',

  primary: BRAND.primary,
  primaryLift: BRAND.primaryLift,
  onPrimary: '#FFFFFF',
  primarySoft: '#E4EDF6',

  accent: BRAND.accent,
  accentSoft: '#DDF4F4',
  onAccent: '#00312F',

  internal: BRAND.internal,
  internalSoft: '#FDF3E3',
  internalBorder: '#EBD2A4',

  gold: BRAND.gold,
  danger: BRAND.danger,
  dangerSoft: '#FCEBE9',

  success: '#0E7B5B',
  successSoft: '#DFF3EC',

  scrim: 'rgba(12, 22, 32, 0.45)',
};

const dark: typeof light = {
  canvas: '#080C11',
  surface: '#131A22',
  surfaceSunken: '#0D1319',
  surfaceRaised: '#1A222C',

  text: '#EAF0F6',
  textMuted: '#9BAAB9',
  textFaint: '#6B7A8A',
  border: '#25303C',
  borderStrong: '#33414F',

  primary: '#7FB6E8',
  primaryLift: '#A8CDF0',
  onPrimary: '#06121D',
  primarySoft: '#152538',

  accent: '#3FD0CE',
  accentSoft: '#0D2B2B',
  onAccent: '#00201F',

  internal: '#E5A85C',
  internalSoft: '#2A1D0D',
  internalBorder: '#4C381C',

  gold: '#EFBB56',
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
      return { bg: t.accentSoft, fg: t.accent, label: 'Touring now' };
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
