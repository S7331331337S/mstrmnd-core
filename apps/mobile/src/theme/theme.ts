import { palette } from './tokens';

export type ColorScheme = 'dark' | 'light';

export interface Theme {
  scheme: ColorScheme;
  background: string;
  surface: string;
  surfaceRaised: string;
  muted: string;
  foreground: string;
  foregroundMuted: string;
  foregroundSubtle: string;
  accent: string;
  accentForeground: string;
  accentDim: string;
  line: string;
  lineStrong: string;
  warning: string;
  danger: string;
  overlay: string;
  blurTint: 'dark' | 'light';
  statusBarStyle: 'light' | 'dark';
  gradient: readonly [string, string, string];
}

/**
 * Semantic theme objects for JS-driven styling — BlurView tint,
 * LinearGradient stops, status bar style, chart/icon colors. Layout and
 * typography should use Tailwind className (`global.css`) instead; this
 * file exists for the handful of native props that don't accept
 * className.
 */
export const darkTheme: Theme = {
  scheme: 'dark',
  background: palette.obsidian,
  surface: palette.obsidianCard,
  surfaceRaised: palette.obsidianRaised,
  muted: palette.obsidianMuted,
  foreground: palette.offWhite,
  foregroundMuted: '#9a9a9f',
  foregroundSubtle: '#6b6b72',
  accent: palette.platinum,
  accentForeground: palette.obsidian,
  accentDim: palette.platinumDim,
  line: 'rgba(255,255,255,0.08)',
  lineStrong: 'rgba(255,255,255,0.16)',
  warning: palette.warningDark,
  danger: palette.dangerDark,
  overlay: 'rgba(0,0,0,0.6)',
  blurTint: 'dark',
  statusBarStyle: 'light',
  gradient: [palette.obsidian, '#1c1c1e', palette.platinum],
};

export const lightTheme: Theme = {
  scheme: 'light',
  background: palette.paper,
  surface: palette.paperCard,
  surfaceRaised: palette.paperRaised,
  muted: palette.paperMuted,
  foreground: palette.ink,
  foregroundMuted: '#5a5a54',
  foregroundSubtle: '#949688',
  accent: palette.ink,
  accentForeground: palette.paper,
  accentDim: 'rgba(19,19,17,0.06)',
  line: 'rgba(10,10,11,0.08)',
  lineStrong: 'rgba(10,10,11,0.16)',
  warning: palette.warningLight,
  danger: palette.dangerLight,
  overlay: 'rgba(10,10,11,0.35)',
  blurTint: 'light',
  statusBarStyle: 'dark',
  gradient: [palette.paper, '#e4e2d8', palette.ink],
};

export const themes: Record<ColorScheme, Theme> = {
  dark: darkTheme,
  light: lightTheme,
};

/**
 * "R G B" channel triples per theme, keyed to match the custom properties
 * declared in `global.css`. Applied at runtime via NativeWind's `vars()` on
 * the app root (see `_layout.tsx`) so the active theme is driven by our own
 * resolved `colorScheme` state rather than CSS `.dark`/`prefers-color-scheme`
 * selectors — those only support toggling *into* dark, not forcing light
 * while the system is dark, which our Paper/Obsidian/System picker needs.
 */
const channelVars: Record<ColorScheme, Record<string, string>> = {
  light: {
    '--background': '250 249 246',
    '--surface': '255 255 255',
    '--surface-raised': '243 242 238',
    '--muted': '238 236 230',
    '--foreground': '19 19 17',
    '--foreground-muted': '90 90 84',
    '--foreground-subtle': '148 146 136',
    '--accent': '19 19 17',
    '--accent-foreground': '250 249 246',
    '--accent-dim': '19 19 17',
    '--line': '10 10 11',
    '--line-strong': '10 10 11',
    '--warning': '217 119 6',
    '--danger': '220 38 38',
    '--overlay': '10 10 11',
  },
  dark: {
    '--background': '10 10 11',
    '--surface': '17 17 19',
    '--surface-raised': '26 26 29',
    '--muted': '28 28 31',
    '--foreground': '232 232 230',
    '--foreground-muted': '154 154 159',
    '--foreground-subtle': '107 107 114',
    '--accent': '232 226 208',
    '--accent-foreground': '10 10 11',
    '--accent-dim': '232 226 208',
    '--line': '255 255 255',
    '--line-strong': '255 255 255',
    '--warning': '245 158 11',
    '--danger': '240 68 56',
    '--overlay': '0 0 0',
  },
};

export function themeCssVars(scheme: ColorScheme) {
  return channelVars[scheme];
}
