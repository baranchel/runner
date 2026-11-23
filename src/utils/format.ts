export function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function fmtPace(secPerKm: number, unit: 'km' | 'mi'): string {
  const rounded = Math.round(unit === 'mi' ? secPerKm * 1.60934 : secPerKm)
  const m = Math.floor(rounded / 60)
  const r = rounded % 60
  const suffix = unit === 'mi' ? '/mi' : '/km'
  return `${m}:${String(r).padStart(2, '0')}${suffix}`
}

/** Precise distance like the Fitness app: "374 m" under 1 km, else "1.46 km" (mi: "0.23 mi"). */
export function fmtDistance(km: number, unit: 'km' | 'mi'): string {
  if (unit === 'mi') return `${(km * 0.621371).toFixed(2)} mi`
  if (km > 0 && km < 1) return `${Math.round(km * 1000)} m`  // 0 stays "0 km" (empty week)
  const v = Math.round(km * 100) / 100
  return Number.isInteger(v) ? `${v} km` : `${v.toFixed(2)} km`  // whole km splits stay "1 km"
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}`
}

export function fmtDateFull(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

// inverse of fmtMMSS: "m:ss" or "h:mm:ss" → seconds, null if malformed
export function parseMMSS(str: string): number | null {
  const parts = str.trim().split(':')
  if (parts.length < 2 || parts.length > 3 || parts.some(p => !/^\d+$/.test(p))) return null
  const nums = parts.map(Number)
  if (nums.slice(1).some(n => n >= 60)) return null
  return nums.reduce((acc, n) => acc * 60 + n, 0)
}

// mm:ss, or hh:mm:ss when ≥ 1 hour — for split times and segment durations
export function fmtMMSS(sec: number): string {
  sec = Math.round(sec)  // round first, or 239.6 s would show as "3:60"
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Seconds → "h:mm" (sleep, workout time). 25 920 → "7:12". */
export function fmtHMM(sec: number): string {
  const m = Math.round(sec / 60)
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}
