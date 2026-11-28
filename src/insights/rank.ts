// Insight ranking (RA-45): linked cards, hero, groups, lime outlines. Pure — tested in rules.check.ts.
import type { BaseKey, Direction, Finding, InsightKey } from './rules.ts'

const prefix = (p: string, v: Record<string, string>) => Object.fromEntries(Object.entries(v).map(([k, x]) => [`${p}.${k}`, x]))

/** Two findings that moved together become one card; the first one gives side, series, runs and method. */
const LINKS: { a: BaseKey; da: Direction; b: BaseKey; db: Direction; key: InsightKey; side: Finding['side'] }[] = [
  { a: 'restingHr', da: 'up', b: 'sleep', db: 'down', key: 'restingHrSleep', side: 'health' },
  { a: 'load', da: 'up', b: 'hrv', db: 'down', key: 'loadHrv', side: 'running' },
]

export function link(fs: Finding[]): Finding[] {
  let out = [...fs]
  for (const l of LINKS) {
    const a = out.find(f => f.key === l.a), b = out.find(f => f.key === l.b)
    if (!a || !b || a.direction !== l.da || b.direction !== l.db) continue
    out = [...out.filter(f => f !== a && f !== b), {
      ...a, key: l.key, side: l.side, direction: 'up', score: Math.max(a.score, b.score), boost: a.boost || b.boost,
      values: { period: '7 DAYS', ...prefix('a', a.values), ...prefix('b', b.values) },
      evidence: `${a.evidence} · ${b.evidence}`,
    }]
  }
  return out
}

export interface Feed {
  hero: Finding | null      // full lime card
  running: Finding[]        // after the hero, by score
  health: Finding[]
  accent: InsightKey[]      // lime outline: the first card of each group, when notable (score ≥ 1)
}

const byRank = (a: Finding, b: Finding) => Number(b.boost) - Number(a.boost) || b.score - a.score

export function buildFeed(fs: Finding[]): Feed {
  const [hero = null, ...rest] = link(fs).sort(byRank)
  const running = rest.filter(f => f.side === 'running'), health = rest.filter(f => f.side === 'health')
  const accent = [running[0], health[0]].filter((f): f is Finding => !!f && f.score >= 1).map(f => f.key)
  return { hero, running, health, accent }
}

/** Feed order = wording order (openings are kept unique in this order). */
export const feedOrder = (f: Feed): Finding[] => [...(f.hero ? [f.hero] : []), ...f.running, ...f.health]
