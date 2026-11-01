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
