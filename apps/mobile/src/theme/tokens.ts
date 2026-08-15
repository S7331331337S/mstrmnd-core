/**
 * Raw design primitives — the values behind `global.css` and the semantic
 * theme in `theme.ts`. Import from here only when a real JS value is
 * required (BlurView tint, LinearGradient stops, Reanimated springs,
 * platform shadow props). Everywhere else, prefer Tailwind className.
 */

export const palette = {
  obsidian: '#0a0a0b',
  obsidianCard: '#111113',
  obsidianRaised: '#1a1a1d',
  obsidianMuted: '#1c1c1f',

  paper: '#faf9f6',
  paperCard: '#ffffff',
  paperRaised: '#f3f2ee',
  paperMuted: '#eeece6',

  offWhite: '#e8e8e6',
  ink: '#131311',

  platinum: '#e8e2d0',
  platinumDim: 'rgba(232,226,208,0.12)',

  warningDark: '#f59e0b',
  warningLight: '#d97706',
  dangerDark: '#f04438',
  dangerLight: '#dc2626',

  white: '#ffffff',
  black: '#000000',
} as const;

export const radii = {
  none: 0,
  xs: 3,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const spacing = {
  '2xs': 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 56,
} as const;

/** Motion — short, precise, mechanical. Nothing bouncy or "consumer playful". */
export const motion = {
  duration: {
    instant: 90,
    fast: 150,
    base: 220,
    slow: 340,
  },
  spring: {
    // Crisp, low-overshoot springs for press/entrance states.
    snappy: { damping: 22, stiffness: 260, mass: 0.6 },
    gentle: { damping: 26, stiffness: 180, mass: 0.8 },
  },
} as const;

/** expo-blur intensities tuned per surface + theme. */
export const blur = {
  bar: { dark: 46, light: 62 },
  sheet: { dark: 34, light: 50 },
  overlay: { dark: 18, light: 30 },
} as const;

export const iconSize = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export type Palette = typeof palette;
