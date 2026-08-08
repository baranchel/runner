// Colors are hex equivalents of the oklch values defined in FRONTEND_SPEC.md.
// oklch is not supported by React Native's color parser — keep hex here, reference
// the spec for the canonical oklch values if targeting web later.

export const colors = {
  bgApp:          '#0d0d12',   // oklch(0.10 0.004 285)
  bgCard:         '#141419',   // oklch(0.15 0.004 285)
  bgSurface:      '#1c1c23',   // oklch(0.19 0.006 285)
  bgElevated:     '#21212b',   // oklch(0.22 0.008 285)
  bgChart:        '#191920',   // oklch(0.18 0.006 285)

  borderSubtle:   '#252532',   // oklch(0.24 0.008 285)
  borderDefault:  '#29293b',   // oklch(0.26 0.008 285)
  borderStrong:   '#2d2d3f',   // oklch(0.28 0.01 285)
  borderFocus:    '#313144',   // oklch(0.30 0.01 285)

  textPrimary:    '#f2f2f8',   // oklch(0.97 0.002 285)
  textSecondary:  '#a3a3b6',   // oklch(0.70 0.012 285)
  textMuted:      '#888898',   // oklch(0.60 0.012 285)
  textDim:        '#848494',   // oklch(0.58 0.012 285)
  textFaint:      '#7d7d8f',   // oklch(0.55 0.012 285)
  textGhost:      '#707082',   // oklch(0.50 0.012 285)

  accent:         '#b887ff',   // oklch(0.74 0.17 300)
  accentBg:       '#9b62e9',   // oklch(0.64 0.19 300)
  accentHover:    '#ad78fc',   // oklch(0.70 0.18 300)
  accentDim:      '#2e174d',   // oklch(0.30 0.09 300)
  accentMuted:    '#4d277b',   // oklch(0.40 0.13 300)

  danger:         '#d74f49',   // oklch(0.62 0.17 25)
  hrLine:         '#d74f49',   // oklch(0.62 0.17 25)
  elevLine:       '#3bac68',   // oklch(0.68 0.14 155)
} as const

// Run type color — oklch(0.66 0.17 <hue>) per hue value.
// Precomputed hex for the HUE_SWATCHES values.
const RUN_TYPE_HEX: Record<number, string> = {
  300: '#9e6ce7',   // purple   — Long Run
  225: '#0061dd',   // blue     — Easy
  155: '#00a85a',   // green    — Recovery
   55: '#dc6600',   // orange   — Tempo
   20: '#e5565d',   // red      — Intervals
   95: '#6cb800',   // lime     — Fartlek
  340: '#d63f7a',   // pink     — Hills
  270: '#6b6fd4',   // indigo
   10: '#e86050',   // red-orange
  190: '#00a6b8',   // teal
}

export const runTypeColor = (hue: number): string =>
  RUN_TYPE_HEX[hue] ?? '#888898'

export const HUE_SWATCHES = [300, 225, 155, 55, 20, 95, 340, 270, 10, 190]

export const fonts = {
  body: 'Inter',
  mono: 'JetBrainsMono',
} as const

export const spacing = {
  screenH: 18,
  gap:     20,
  cardP:   14,
  radius:  10,
} as const
