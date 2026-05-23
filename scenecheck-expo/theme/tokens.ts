// Theme tokens. Ported from the CSS custom properties in the legacy
// index.html and app.jsx PALETTES object. The web prototype set these on
// `document.documentElement`; here they live as a JS object consumed via
// the ThemeProvider context, which is the only pattern that works on
// React Native (no global CSS scope on native).
//
// Three palettes × two modes (light/dark). Component code calls
// `useTheme()` to read the active token set and passes individual values
// into StyleSheet.create — never hardcode hex values in components.

export type PaletteName = 'sunset' | 'cobalt' | 'lime';
export type Mode = 'light' | 'dark';

export interface Tokens {
  primary: string;
  primaryInk: string;
  primarySoft: string;
  accentBlue: string;
  accentFriend: string;
  ink: string;
  ink2: string;
  ink3: string;
  surface: string;
  card: string;
  subtle: string;
  line: string;
  mapLand: string;
  mapPark: string;
  mapWater: string;
  mapRoad: string;
  mapBuild: string;
  mapPinMute: string;
  pageBg: string;
  pageGlow1: string;
  pageGlow2: string;
  // Semantic colors (constant across palettes for now)
  good: string;
  warn: string;
  // Dark ink for text/icons sitting on a `warn` (gold) fill. Constant in both
  // modes — `ink` flips to near-white in dark mode, which washed out the gold
  // review button, so it can't be used there.
  warnInk: string;
  danger: string;
}

const CONSTANTS = {
  good: '#2BB673',
  warn: '#F2B33C',
  warnInk: '#1A1205',
  danger: '#C73B2B',
};

export const PALETTES: Record<PaletteName, { label: string; light: Tokens; dark: Tokens }> = {
  sunset: {
    label: 'Sunset Coral',
    light: {
      primary: '#FF5B47', primaryInk: '#FFFFFF', primarySoft: '#FFE3DD',
      accentBlue: '#2E7BFF', accentFriend: '#1A1714',
      ink: '#14110F', ink2: '#4D453E', ink3: '#8A8077',
      surface: '#FFFBF5', card: '#FFFFFF',
      subtle: '#F2EBDF', line: '#ECE3D2',
      mapLand: '#EFE6D2', mapPark: '#B7D69A', mapWater: '#BBD8EC',
      mapRoad: '#FFFFFF', mapBuild: '#E5DBC6', mapPinMute: '#A89E8C',
      pageBg: '#ECE3D2', pageGlow1: '#F8E3CC', pageGlow2: '#F4D8C3',
      ...CONSTANTS,
    },
    dark: {
      primary: '#FF6F5A', primaryInk: '#1A0F0C', primarySoft: '#3A1F1A',
      accentBlue: '#5B9CFF', accentFriend: '#F2EBDF',
      ink: '#F4ECDD', ink2: '#C8BEAE', ink3: '#7E7568',
      surface: '#16120E', card: '#231C16',
      subtle: '#2C241D', line: '#332A22',
      mapLand: '#1F1812', mapPark: '#2F4A28', mapWater: '#1B2C3D',
      mapRoad: '#3A2E24', mapBuild: '#2A2118', mapPinMute: '#6E665B',
      pageBg: '#0E0B08', pageGlow1: '#2A1B12', pageGlow2: '#1F1410',
      ...CONSTANTS,
    },
  },
  cobalt: {
    label: 'Cobalt Glow',
    light: {
      primary: '#2A55FF', primaryInk: '#FFFFFF', primarySoft: '#DDE5FF',
      accentBlue: '#5BC1FF', accentFriend: '#0E1633',
      ink: '#0E1633', ink2: '#3D456A', ink3: '#7E84A1',
      surface: '#F4F6FF', card: '#FFFFFF',
      subtle: '#E8ECFB', line: '#DDE2F5',
      mapLand: '#E5EAF7', mapPark: '#A8D4B5', mapWater: '#A6C9F0',
      mapRoad: '#FFFFFF', mapBuild: '#D5DCEE', mapPinMute: '#9AA1BA',
      pageBg: '#E8ECFB', pageGlow1: '#DDE5FF', pageGlow2: '#D6E4FF',
      ...CONSTANTS,
    },
    dark: {
      primary: '#5C7BFF', primaryInk: '#06091C', primarySoft: '#172248',
      accentBlue: '#7CC9FF', accentFriend: '#E6E9F7',
      ink: '#E6E9F7', ink2: '#A9AECB', ink3: '#6E7390',
      surface: '#0B0E1F', card: '#161A30',
      subtle: '#1F2440', line: '#252B49',
      mapLand: '#11142A', mapPark: '#214030', mapWater: '#162640',
      mapRoad: '#272D4D', mapBuild: '#1A1F38', mapPinMute: '#5F6582',
      pageBg: '#06091C', pageGlow1: '#172248', pageGlow2: '#0F1638',
      ...CONSTANTS,
    },
  },
  lime: {
    label: 'Electric Lime',
    light: {
      primary: '#C5F23B', primaryInk: '#0D1407', primarySoft: '#EFFBC8',
      accentBlue: '#2E7BFF', accentFriend: '#0D1407',
      ink: '#0D1407', ink2: '#3F4830', ink3: '#7A8268',
      surface: '#F4F7EE', card: '#FFFFFF',
      subtle: '#EAF1D8', line: '#DEE6CB',
      mapLand: '#E8EEDA', mapPark: '#B5D58A', mapWater: '#BBD8EC',
      mapRoad: '#FFFFFF', mapBuild: '#D7DDC4', mapPinMute: '#9AA088',
      pageBg: '#EAF1D8', pageGlow1: '#EFFBC8', pageGlow2: '#E2EFC2',
      ...CONSTANTS,
    },
    dark: {
      primary: '#D4FF4D', primaryInk: '#0D1407', primarySoft: '#22300C',
      accentBlue: '#5B9CFF', accentFriend: '#EAF2D6',
      ink: '#EAF2D6', ink2: '#B6BFA0', ink3: '#797F65',
      surface: '#0E120A', card: '#181D11',
      subtle: '#222918', line: '#2A311C',
      mapLand: '#141810', mapPark: '#2D4422', mapWater: '#1B2C3D',
      mapRoad: '#2F3622', mapBuild: '#1F2415', mapPinMute: '#5F6549',
      pageBg: '#08100A', pageGlow1: '#1A2A0E', pageGlow2: '#10180A',
      ...CONSTANTS,
    },
  },
};

// Spacing / radius / font scale — used app-wide so screens stay consistent.
export const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40,
} as const;

export const RADIUS = {
  sm: 8, md: 12, lg: 14, xl: 18, xxl: 22, pill: 999,
} as const;

export const FONT = {
  // RN doesn't pick up Google Fonts via CSS link tags — these are placeholders
  // until expo-font loads the bundled .ttf files (see app/_layout.tsx).
  display: 'Bricolage Grotesque',
  body: 'DM Sans',
  mono: 'JetBrains Mono',
} as const;

export function getTokens(name: PaletteName, mode: Mode): Tokens {
  return PALETTES[name][mode];
}
