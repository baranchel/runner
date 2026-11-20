// Pure: which HealthKit workouts to import. The same run can sit in Health several times
// (Apple Watch + Strava/Nike copy, each with its own UUID), so overlapping time ranges = duplicates.
export interface Candidate { uuid: string; start: number; end: number; isWatch: boolean }  // ms
export interface Saved { id: string; start: number | null; end: number | null }

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) =>
  a.start < b.end && b.start < a.end

/** New workouts to import, oldest first: not saved yet, not overlapping a saved run; among overlapping
 *  candidates the Apple Watch copy wins, else the earliest. (Source choice by the user → RA-12.) */
export function pickNew(cands: Candidate[], saved: Saved[]): Candidate[] {
  const ids = new Set(saved.map(s => s.id))
  const ranges = saved.filter((s): s is Saved & { start: number; end: number } => s.start != null && s.end != null)
  const fresh = cands.filter(c => !ids.has(c.uuid) && !ranges.some(r => overlaps(c, r)))
  const byPriority = [...fresh].sort((a, b) => Number(b.isWatch) - Number(a.isWatch) || a.start - b.start)
  const kept: Candidate[] = []
  for (const c of byPriority) if (!kept.some(k => overlaps(c, k))) kept.push(c)
  return kept.sort((a, b) => a.start - b.start)
}
