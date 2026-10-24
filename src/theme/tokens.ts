/**
 * Patapata design tokens.
 *
 * Palette: deep navy for trust, turquoise/cyan for energy and connection, and
 * a restrained warm ochre accent. Text/background pairs meet WCAG AA (4.5:1)
 * contrast; `brand` and `accent` are decorative fills, not text colours on
 * light surfaces.
 *
 * System fonts are used deliberately: no font downloads on limited data.
 */

export const palette = {
  navy900: '#071426',
  navy800: '#0B1F3A',
  navy700: '#12305A',
  navy600: '#1C4374',
  teal700: '#0B6E78',
  teal600: '#0B7A85',
  teal400: '#16C1CF',
  teal300: '#2DD4E0',
  teal100: '#D6F5F8',
  ochre500: '#F2A541',
  ochre600: '#D9822B',
  ochre100: '#FDF0DC',
  red600: '#C2362F',
  red300: '#F08A84',
  green600: '#1E7F48',
  green300: '#6FD69B',
  gray50: '#F6F8FB',
  gray100: '#EDF1F6',
  gray200: '#DCE3EC',
  gray400: '#94A3B8',
  gray600: '#4F5F75',
  white: '#FFFFFF',
} as const;

export type ColorTokens = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  onPrimarySoft: string;
  brand: string;
  accent: string;
  accentSoft: string;
  danger: string;
  success: string;
  overlay: string;
  tabBar: string;
};

export const lightColors: ColorTokens = {
  background: palette.gray50,
  surface: palette.white,
  surfaceAlt: palette.gray100,
  border: palette.gray200,
  text: palette.navy800,
  textMuted: palette.gray600,
  textInverse: palette.white,
  primary: palette.teal600,
  onPrimary: palette.white,
  primarySoft: palette.teal100,
  onPrimarySoft: palette.teal700,
  brand: palette.teal400,
  accent: palette.ochre500,
  accentSoft: palette.ochre100,
  danger: palette.red600,
  success: palette.green600,
  overlay: 'rgba(7, 20, 38, 0.55)',
  tabBar: palette.white,
};

export const darkColors: ColorTokens = {
  background: palette.navy900,
  surface: '#0F2340',
  surfaceAlt: '#16304F',
  border: '#22395A',
  text: '#EAF1F8',
  textMuted: '#A7B8CC',
  textInverse: palette.navy800,
  primary: palette.teal300,
  onPrimary: palette.navy900,
  primarySoft: '#123C4A',
  onPrimarySoft: palette.teal300,
  brand: palette.teal400,
  accent: palette.ochre500,
  accentSoft: '#3A2A12',
  danger: palette.red300,
  success: palette.green300,
  overlay: 'rgba(0, 0, 0, 0.6)',
  tabBar: '#0B1C33',
};

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radii = { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 } as const;

export const typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
} as const;

export type TypographyVariant = keyof typeof typography;

export const layout = {
  maxContentWidth: 680,
  minTouchTarget: 44,
} as const;
