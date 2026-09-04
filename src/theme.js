export const colors = {
  surface: '#FBF4EC',
  onSurface: '#1A1C1A',
  surfaceSecondary: '#FFFFFF',
  onSurfaceSecondary: '#1A1C1A',
  surfaceTertiary: '#F4E8DC',
  onSurfaceTertiary: '#3B403D',
  surfaceInverse: '#5A1725',
  onSurfaceInverse: '#FBF4EC',
  brand: '#5A1725',
  brandPrimary: '#A61B32',
  onBrandPrimary: '#FFFFFF',
  brandSecondary: '#F7E1E2',
  onBrandSecondary: '#A61B32',
  brandTertiary: '#F9EDE6',
  onBrandTertiary: '#5A1725',
  success: '#7B8F45',
  onSuccess: '#FFFFFF',
  warning: '#D47C31',
  onWarning: '#FFFFFF',
  error: '#C05746',
  onError: '#FFFFFF',
  info: '#4A6E7C',
  onInfo: '#FFFFFF',
  border: '#E9D9D0',
  borderStrong: '#D7BBB5',
  divider: '#E9D9D0',
  muted: '#806F70',
  onBrand: '#FFFFFF'
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999
};

export const fonts = {
  display: 'Fraunces, Georgia, serif',
  text: 'Plus Jakarta Sans, sans-serif',
  textMedium: 'Plus Jakarta Sans, sans-serif',
  textBold: 'Plus Jakarta Sans, sans-serif'
};

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, color: colors.onSurface },
  h1: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, color: colors.onSurface },
  h2: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.onSurface },
  title: { fontFamily: fonts.textMedium, fontSize: 17, lineHeight: 22, color: colors.onSurface, fontWeight: 600 },
  body: { fontFamily: fonts.text, fontSize: 15, lineHeight: 22, color: colors.onSurface },
  bodySm: { fontFamily: fonts.text, fontSize: 13, lineHeight: 18, color: colors.onSurfaceTertiary },
  caption: { fontFamily: fonts.text, fontSize: 11, lineHeight: 14, color: colors.muted, letterSpacing: 0.4 },
  label: { fontFamily: fonts.textMedium, fontSize: 13, lineHeight: 16, color: colors.onSurfaceTertiary, fontWeight: 600, letterSpacing: 0.3 }
};

export const shadow = {
  card: '0 2px 8px rgba(26, 28, 26, 0.05)',
  raised: '0 6px 18px rgba(26, 28, 26, 0.09)'
};

export const useTheme = () => ({ colors, spacing, radius, fonts, type, shadow });
