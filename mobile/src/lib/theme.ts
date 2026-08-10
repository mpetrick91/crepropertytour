import { useColorScheme } from 'react-native';

/**
 * Palette mirrors the web app so a tour looks like the same product whether a
 * client opened the app or the browser fallback.
 */
const light = {
  background: '#ffffff',
  surface: '#f4f6f8',
  text: '#0e161f',
  textMuted: '#56636f',
  textFaint: '#8592a0',
  border: '#d3dbe3',
  accent: '#14304f',
  onAccent: '#ffffff',
  internal: '#8f4a17',
  internalBg: '#fdf3e8',
  internalBorder: '#e5c49c',
  danger: '#b3261e',
  star: '#b47614',
};

const dark: typeof light = {
  background: '#0c0f13',
  surface: '#171b21',
  text: '#e8edf2',
  textMuted: '#9dabb9',
  textFaint: '#6d7c8b',
  border: '#28323d',
  accent: '#8fbdea',
  onAccent: '#0c0f13',
  internal: '#e0a267',
  internalBg: '#2a1e11',
  internalBorder: '#4d3720',
  danger: '#f2b8b5',
  star: '#e0a44a',
};

export type Palette = typeof light;

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 6, md: 10, lg: 14, pill: 999 };

/** Minimum comfortable tap target. Tours happen one-handed, outdoors. */
export const TAP_TARGET = 44;
