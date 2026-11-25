// Pure shoe logic (RA-8). No React Native imports: `node src/shoes/shoes.check.ts` runs it.
// Distance and levels are never stored: they follow the runs, like HR zones follow hr_hist.
import type { Run } from '../types/index.ts'

export const COLOR_KEYS = ['black', 'white', 'grey', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'multi'] as const
export type ColorKey = typeof COLOR_KEYS[number]

/** A shoe as stored (same columns in SQLite and the cloud; user_id is cloud only). */
export interface ShoeRow {
  id: string
  brand: string
  model: string
  name: string | null
  color: ColorKey | null
  in_use_from: string       // 'YYYY-MM-DD'
  limit_km: number
  extra_km: number          // km not covered by assigned runs
  retired: boolean
  alert_level: number       // highest pop-up already shown: 0 | 90 | 100
  card_dismissed: number    // highest Dashboard card dismissed: 0 | 90 | 100
  updated_at?: string | null
}

export type Level = 0 | 90 | 100
export const GENERIC_KM = 700  // limit for a model typed with "Other…"

/** 100 at/over the limit, 90 from 90%, else 0. Integer maths: 0.9 * 700 is 630.0000000000001. */
export const level = (distKm: number, limitKm: number): Level =>
  limitKm <= 0 ? 0 : distKm >= limitKm ? 100 : distKm * 10 >= limitKm * 9 ? 90 : 0

export const shoeRuns = (shoeId: string, runs: Run[]) => runs.filter(r => r.shoeId === shoeId)

export const shoeDistance = (shoe: ShoeRow, runs: Run[]) =>
  shoeRuns(shoe.id, runs).reduce((s, r) => s + r.distanceKm, 0) + shoe.extra_km

/** Level to pop up now (then store it in alert_level), or null. */
export function popupLevel(shoe: ShoeRow, distKm: number): Level | null {
  if (shoe.retired) return null
  const l = level(distKm, shoe.limit_km)
  return l > shoe.alert_level ? l : null
}

/** Level the Dashboard card shows, or null (dismissing stores it in card_dismissed). */
export function cardLevel(shoe: ShoeRow, distKm: number): Level | null {
  if (shoe.retired) return null
  const l = level(distKm, shoe.limit_km)
  return l > shoe.card_dismissed ? l : null
}

/** After a limit / extra-km edit: remembered levels never stay above the current one, so alerts can fire again. */
export function lowerLevels(shoe: ShoeRow, distKm: number): Pick<ShoeRow, 'alert_level' | 'card_dismissed'> {
  const l = level(distKm, shoe.limit_km)
  return { alert_level: Math.min(shoe.alert_level, l), card_dismissed: Math.min(shoe.card_dismissed, l) }
}

/** Shoe a run gets when its type is set: keeps an existing shoe, else the type's default if it is active. */
export function defaultFill(current: string | null, typeDefault: string | null | undefined, activeIds: Set<string>): string | null {
  if (current) return current
  return typeDefault && activeIds.has(typeDefault) ? typeDefault : null
}

/** Runs the past-runs step offers: on/after "in use from", without a shoe. */
export const pastRunCandidates = (inUseFrom: string, runs: Run[]) =>
  runs.filter(r => !r.shoeId && r.date >= inUseFrom)

/** Why a shoe write would be rejected by the cloud (NOT NULL / bad number), or null if fine.
 *  A rejected push is failed for good and would drag later run/type ops that point at the shoe with it. */
export function shoeProblem(p: Partial<ShoeRow>): string | null {
  for (const k of ['brand', 'model', 'in_use_from'] as const) if (k in p && !String(p[k] ?? '').trim()) return `${k} is empty`
  if ('limit_km' in p && !(Number.isFinite(p.limit_km) && p.limit_km! > 0)) return 'limit_km must be > 0'
  if ('extra_km' in p && !(Number.isFinite(p.extra_km) && p.extra_km! >= 0)) return 'extra_km must be ≥ 0'
  return null
}

/** Extra km from the edited "Distance on this shoe". */
export const extraKm = (typedKm: number, assignedKm: number) => Math.max(0, typedKm - assignedKm)

export function shoeStats(shoe: ShoeRow, runs: Run[]) {
  const rs = shoeRuns(shoe.id, runs)
  const km = rs.reduce((s, r) => s + r.distanceKm, 0)
  const sec = rs.reduce((s, r) => s + r.timeSec, 0)
  return {
    distanceKm: km + shoe.extra_km,
    runCount: rs.length,
    avgPaceSecPerKm: km > 0 ? sec / km : null,
    lastUsed: rs.reduce<string | null>((d, r) => (d === null || r.date > d ? r.date : d), null),
  }
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

export const displayName = (s: Pick<ShoeRow, 'name' | 'model' | 'color'>) =>
  s.name?.trim() || (s.color ? `${s.model} · ${cap(s.color)}` : s.model)

/** Logo file in the brand-logos bucket: "New Balance" → "new-balance.png". */
export const logoFile = (brand: string) =>
  brand.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '.png'

export const initials = (brand: string) =>
  brand.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
