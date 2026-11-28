// Run: node src/insights/phrases.check.ts
import { BANNED, PHRASES, candidates, opening, word, wordAll, type Entry } from './phrases.ts'
import { VALUE_KEYS, type Direction, type Finding, type InsightKey } from './rules.ts'

function eq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${msg}: expected ${e}, got ${a}`)
}
/** The directions each insight's rule can return (rules.ts). */
const DIRS: Record<InsightKey, Direction[]> = {
  efficiency: ['up', 'down', 'steady'], z2Share: ['up', 'down', 'steady'], load: ['up', 'down', 'steady'],
  longest: ['record', 'steady'], streak: ['streak', 'steady'], hrMax: ['up', 'down', 'steady'],
  restingHr: ['up', 'down', 'steady'], hrv: ['up', 'down', 'steady'], sleep: ['up', 'down', 'steady'],
  steps: ['up', 'down', 'steady', 'record', 'recordLow'], vo2max: ['up', 'down', 'steady'],
  stepsRunDays: ['up', 'down', 'steady'], sleepBeforeSlow: ['up', 'down', 'steady'],
  restingHrSleep: ['up'], loadHrv: ['up'],
}
const sample = (key: InsightKey, direction: Direction): Finding => ({
  key, side: 'health', direction, score: 1, boost: false,
  values: Object.fromEntries(VALUE_KEYS[key].map(k => [k, k === 'period' ? '7 DAYS' : 'X'])),
  evidence: '', series: [], seriesKind: 'line',
})
const strings = (e: Entry): string[] => [
  e.label, e.guideline ?? '', ...(e.subject ?? []),
  ...[e.change, e.time, e.whole, e.meaning].flatMap(t => Object.values(t ?? {}).flat()),
]

// ─── coverage: every insight × direction has headlines, every slot fills ─────
eq(Object.keys(PHRASES).sort(), Object.keys(DIRS).sort(), 'one phrase entry per insight')
for (const [key, dirs] of Object.entries(DIRS) as [InsightKey, Direction[]][]) {
  for (const dir of dirs) {
    const f = sample(key, dir), opts = candidates(PHRASES[key], dir, 'seed')
    if (opts.length < 3) throw new Error(`${key}/${dir}: only ${opts.length} headlines`)
    for (const t of opts) {
      const h = word({ ...f }, '2026-11-28', new Set(), t).headline
      if (/[{}]/.test(h)) throw new Error(`${key}/${dir}: unfilled slot in "${h}"`)
      if (h[0] !== h[0].toUpperCase()) throw new Error(`${key}/${dir}: not capitalised "${h}"`)
    }
    for (const m of PHRASES[key].meaning?.[dir] ?? []) {
      const filled = m.replace(/\{([\w.]+)\}/g, (s, k) => (VALUE_KEYS[key].includes(k) ? 'X' : s))
      if (/[{}]/.test(filled)) throw new Error(`${key}/${dir}: unfilled slot in meaning "${m}"`)
    }
  }
}

// ─── voice: banned words, whole words, any case ──────────────────────────────
const banned = new RegExp(`\\b(${BANNED.join('|')})\\b`, 'i')
for (const [key, e] of Object.entries(PHRASES)) for (const s of strings(e)) {
  if (banned.test(s)) throw new Error(`${key}: banned word in "${s}"`)
}

// ─── grammar guard: no doubled words, no "is steady … since/for" ─────────────
for (const [key, dirs] of Object.entries(DIRS) as [InsightKey, Direction[]][]) for (const dir of dirs) {
  for (const t of candidates(PHRASES[key], dir, "g")) {
    const h = word(sample(key, dir), "2026-11-28", new Set(), t).headline
    if (/\b(\w+) \1\b/i.test(h)) throw new Error(key + "/" + dir + ": doubled word in " + h)
    if (/\bis steady\b.*\b(since|for)\b/.test(h)) throw new Error(key + "/" + dir + ": is steady since/for in " + h)
  }
}

// ─── guidelines only on Z2 share and sleep ───────────────────────────────────
eq(Object.entries(PHRASES).filter(([, e]) => e.guideline).map(([k]) => k).sort(), ['sleep', 'z2Share'], 'guideline only on R2 + H3')

// ─── daily edition ───────────────────────────────────────────────────────────
const eff = sample('efficiency', 'down')
eq(word(eff, '2026-11-28'), word(eff, '2026-11-28'), 'same date → same text')
const week = new Set(Array.from({ length: 10 }, (_, i) => word(eff, `2026-12-${String(i + 1).padStart(2, '0')}`).headline))
if (week.size < 4) throw new Error(`only ${week.size} different headlines over 10 days`)
eq(word(eff, '2026-11-28').eyebrow, 'EFFICIENCY · 7 DAYS', 'eyebrow = label · period')

// ─── one feed: no two cards open the same way ────────────────────────────────
const feed = (Object.keys(DIRS) as InsightKey[]).map(k => sample(k, DIRS[k][0]))
for (const date of ['2026-11-28', '2026-11-29', '2026-11-30']) {
  const ws = [...wordAll(feed, date).values()].map(w => opening(w.headline))
  eq(new Set(ws).size, ws.length, `${date}: openings unique`)
}

console.log('phrases.check: all passed')
