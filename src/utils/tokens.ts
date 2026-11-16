// Palette from the Strides Figma file (dark). Translucent lavender layers are
// pre-blended over bgApp so RN gets solid hex.
export const colors = {
  bgApp:          '#1d172c',   // Figma page bg
  bgCard:         '#1d172c',   // nav bars (same as page, divider separates)
  bgSurface:      '#271f39',   // lavender 6% — cards
  bgElevated:     '#2e2541',   // lavender 10% — tiles, pills, dropdowns
  bgChart:        '#241d34',   // lavender 4%

  borderSubtle:   '#362c4c',   // lavender 15% — dividers
  borderDefault:  '#332947',   // lavender 13% — card borders
  borderStrong:   '#3e3356',   // lavender 20% — input borders
  borderFocus:    '#473a61',   // lavender 25%

  textPrimary:    '#c4a3ff',   // lavender
  textSecondary:  '#ab8edf',   // lavender 85%
  textMuted:      '#9a80ca',   // lavender 75%
  textDim:        '#957cc4',   // lavender 72%
  textFaint:      '#8a72b5',   // lavender 65%
  textGhost:      '#7964a0',   // lavender 55%

  accent:         '#c4a3ff',   // lavender — links, active tabs, hero card
  lime:           '#d9f879',   // highlight card / growth pill
  ink:            '#1d172c',   // text on lavender / lime cards
  accentBg:       '#9b62e9',   // oklch(0.64 0.19 300)
  accentHover:    '#ad78fc',   // oklch(0.70 0.18 300)
  accentDim:      '#2e174d',   // oklch(0.30 0.09 300)
  accentMuted:    '#4d277b',   // oklch(0.40 0.13 300)

  danger:         '#d74f49',   // oklch(0.62 0.17 25)
  hrLine:         '#d74f49',   // oklch(0.62 0.17 25)
  elevLine:       '#3bac68',   // oklch(0.68 0.14 155)

  iconGold:    '#e8a900',   // distance icon tint
  iconTeal:    '#00a6b8',   // time icon tint
  iconOrange:  '#dc6600',   // pace, calories icon tint
  iconSky:     '#6db8e8',   // weather icon tint
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
