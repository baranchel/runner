// Pure profile logic (RA-11). No React Native imports: `node src/utils/profile.check.ts` runs it.

export type Sex = 'female' | 'male' | 'undisclosed'  // undisclosed = "Prefer not to say"

/** A profile as stored (same snake_case columns locally and in the cloud; local id = user id). */
export interface ProfileRow {
  id: string
  unit: 'km' | 'mi'
  first_name: string | null
  last_name: string | null
  dob: string | null          // 'YYYY-MM-DD'
  sex: Sex | null
  height_cm: number | null
  weight_kg: number | null
  resting_hr: number | null
  vo2max: number | null
  hr_max: number | null       // user's value (manual) or highest HR from runs — never the 220 − age estimate
  hr_max_manual: boolean
  updated_at?: string | null
}

/** The form's required fields are filled. */
export const isComplete = (p: ProfileRow | null): boolean =>
  !!(p && p.first_name?.trim() && p.last_name?.trim() && p.dob)

/** "Mary Ann Smith" → first "Mary", last "Ann Smith" (old accounts and Google store one full name). */
export function splitName(full: string): { first: string; last: string } {
  const t = full.trim()
  const i = t.indexOf(' ')
  return i < 0 ? { first: t, last: '' } : { first: t.slice(0, i), last: t.slice(i + 1).trim() }
}

/** Date → 'YYYY-MM-DD' from local parts (toISOString() is UTC and can be the day before). */
export const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function ageOn(dob: string, today: Date): number {
  const [y, m, d] = dob.split('-').map(Number)
  const hadBirthday = today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d)
  return today.getFullYear() - y - (hadBirthday ? 0 : 1)
}

/** Form number: '' → null (left empty), not a positive number → undefined (invalid). */
export function parseNum(text: string): number | null | undefined {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** Highest max HR across runs, or null when no run has one. */
export function autoHrMax(runs: readonly { maxHr: number | null }[]): number | null {
  let max: number | null = null
  for (const r of runs) if (r.maxHr != null && (max == null || r.maxHr > max)) max = r.maxHr
  return max == null ? null : Math.round(max)
}

export const estimateHrMax = (dob: string | null, today: Date): number | null =>
  dob ? 220 - ageOn(dob, today) : null

/** HRmax used for zones: saved → from runs → 220 − age → 190. */
export const effectiveHrMax = (p: ProfileRow | null, runs: readonly { maxHr: number | null }[], today: Date): number =>
  p?.hr_max ?? autoHrMax(runs) ?? estimateHrMax(p?.dob ?? null, today) ?? 190

/** After an import: the new auto HRmax to save, or null to leave it (manual, or no higher run). */
export function nextAutoHrMax(p: ProfileRow, runs: readonly { maxHr: number | null }[]): number | null {
  if (p.hr_max_manual) return null
  const auto = autoHrMax(runs)
  return auto != null && auto > (p.hr_max ?? 0) ? auto : null
}
