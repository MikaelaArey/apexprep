// Design tokens: white surfaces, one deep-green accent, grayscale everything
// else. Right/wrong always pair color with an icon and a word.

import { useColorScheme } from 'react-native';

export interface Palette {
  bg: string;
  bgGrouped: string;
  card: string;
  cardPressed: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  onPrimary: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  ink: string;
  streak: string;
  overlay: string;
}

export const light: Palette = {
  bg: '#FFFFFF',
  bgGrouped: '#F4F7F5',
  card: '#FFFFFF',
  cardPressed: '#F1F5F3',
  border: '#E3E9E6',
  borderStrong: '#C7D2CD',
  text: '#0E1B16',
  textMuted: '#56665F',
  textFaint: '#86958F',
  primary: '#0B7A55',
  primaryPressed: '#08664A',
  primarySoft: '#E4F3EB',
  onPrimary: '#FFFFFF',
  success: '#12805C',
  successSoft: '#E3F4EC',
  danger: '#C23A3A',
  dangerSoft: '#FBEBEB',
  warning: '#A86A10',
  warningSoft: '#FCF2DF',
  ink: '#0E1B16',
  streak: '#E0590C',
  overlay: 'rgba(14, 27, 22, 0.4)',
};

export const dark: Palette = {
  bg: '#0A0F0D',
  bgGrouped: '#0A0F0D',
  card: '#131B17',
  cardPressed: '#1A241F',
  border: '#22302A',
  borderStrong: '#34453D',
  text: '#E8F0EC',
  textMuted: '#9DADA6',
  textFaint: '#6F807A',
  primary: '#3CC48E',
  primaryPressed: '#2FA979',
  primarySoft: '#13291F',
  onPrimary: '#04140D',
  success: '#3CC48E',
  successSoft: '#13291F',
  danger: '#FF6F6F',
  dangerSoft: '#2D1616',
  warning: '#F1B54C',
  warningSoft: '#2A2112',
  ink: '#E8F0EC',
  streak: '#FF8A3D',
  overlay: 'rgba(0, 0, 0, 0.55)',
};

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const type = {
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: '700' as const, letterSpacing: 0.2 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' as const },
  reading: { fontSize: 17, lineHeight: 27, fontWeight: '400' as const },
  callout: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' as const },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: '700' as const, letterSpacing: 0.8 },
  stat: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
};

export type TypeVariant = keyof typeof type;
