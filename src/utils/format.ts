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
