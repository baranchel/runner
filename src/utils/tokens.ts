export const colors = {
  bgApp:          'oklch(0.10 0.004 285)',
  bgCard:         'oklch(0.15 0.004 285)',
  bgSurface:      'oklch(0.19 0.006 285)',
  bgElevated:     'oklch(0.22 0.008 285)',
  bgChart:        'oklch(0.18 0.006 285)',

  borderSubtle:   'oklch(0.24 0.008 285)',
  borderDefault:  'oklch(0.26 0.008 285)',
  borderStrong:   'oklch(0.28 0.01 285)',
  borderFocus:    'oklch(0.30 0.01 285)',

  textPrimary:    'oklch(0.97 0.002 285)',
  textSecondary:  'oklch(0.70 0.012 285)',
  textMuted:      'oklch(0.60 0.012 285)',
  textDim:        'oklch(0.58 0.012 285)',
  textFaint:      'oklch(0.55 0.012 285)',
  textGhost:      'oklch(0.50 0.012 285)',

  accent:         'oklch(0.74 0.17 300)',
  accentBg:       'oklch(0.64 0.19 300)',
  accentHover:    'oklch(0.70 0.18 300)',
  accentDim:      'oklch(0.30 0.09 300)',
  accentMuted:    'oklch(0.40 0.13 300)',

  danger:         'oklch(0.62 0.17 25)',
  hrLine:         'oklch(0.62 0.17 25)',
  elevLine:       'oklch(0.68 0.14 155)',
} as const;

export const runTypeColor = (hue: number) => `oklch(0.66 0.17 ${hue})`;

export const HUE_SWATCHES = [300, 225, 155, 55, 20, 95, 340, 270, 10, 190];

export const fonts = {
  body:  'Inter',
  mono:  'JetBrainsMono',
} as const;

export const spacing = {
  screenH: 18,
  gap:     20,
  cardP:   14,
  radius:  10,
} as const;
