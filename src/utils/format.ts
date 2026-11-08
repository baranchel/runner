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

export function fmtDistance(km: number, unit: 'km' | 'mi'): string {
  const val = unit === 'mi' ? km * 0.621371 : km
  const suffix = unit === 'mi' ? ' mi' : ' km'
  return `${Math.round(val * 10) / 10}${suffix}`
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
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}
