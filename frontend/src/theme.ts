export const theme = {
  colors: {
    surface: '#FFFFFF',
    surface2: '#F9FAFB',
    surface3: '#F3F4F6',
    text: '#111827',
    text2: '#374151',
    text3: '#6B7280',
    textMuted: '#9CA3AF',
    brand: '#064E3B',
    brandPrimary: '#10B981',
    brandSecondary: '#D1FAE5',
    onBrand: '#FFFFFF',
    warning: '#F59E0B',
    error: '#EF4444',
    border: '#E5E7EB',
    borderStrong: '#D1D5DB',
    divider: '#F3F4F6',
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 6, md: 12, lg: 20, pill: 999 },
  font: {
    sm: 12,
    base: 14,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
} as const;

export type Theme = typeof theme;
