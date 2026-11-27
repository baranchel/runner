// Run: node src/utils/zones.check.ts
import type { ProfileRow } from './profile.ts'
import { computePrimaryZone, methodStarts, sumZoneTimes, topZones, validStarts, zonePcts, zoneRangeLabel, zoneStarts, zoneTimes } from './zones.ts'

function eq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${msg}: expected ${e}, got ${a}`)
}

// Sample user from the mockup: HRmax 185, resting 55, LTHR 168
const x = { hrMax: 185, restingHr: 55, lthr: 168, manual: [130, 145, 160, 172] }
eq(methodStarts('hrmax', x), [111, 130, 148, 167], '% Max: 60/70/80/90% of 185 (129.5 → 130, 166.5 → 167)')
eq(methodStarts('hrr', x), [133, 146, 159, 172], 'Reserve: 55 + 60..90% of 130')
eq(methodStarts('lthr', x), [143, 151, 160, 168], 'LTHR: 85/90/95/100% of 168')
eq(methodStarts('manual', x), [130, 145, 160, 172], 'Manual passes through')
eq(methodStarts('hrr', { ...x, restingHr: null }), null, 'Reserve needs resting HR')
eq(methodStarts('hrr', { ...x, restingHr: 190 }), null, 'resting above max is unusable')
eq(methodStarts('lthr', { ...x, lthr: null }), null, 'LTHR needs LTHR')
eq(methodStarts('lthr', { ...x, lthr: 5 }), null, 'LTHR half-typed ("5") is unusable, not [4,5,5,5]')
eq(methodStarts('lthr', { ...x, lthr: 999 }), null, 'LTHR out of range')
eq(methodStarts('hrr', { ...x, restingHr: 180 }), null, 'resting so close to max that zones collapse')
eq(methodStarts('manual', { ...x, manual: [130, 130, 160, 172] }), null, 'Manual must increase')
eq(methodStarts('manual', { ...x, manual: [130, 145, 160] }), null, 'Manual needs 4 values')

eq(validStarts([100, 120, 140, 160]), true, 'valid')
eq(validStarts([30, 120, 140, 160]), false, 'below 40 bpm')
eq(validStarts([100, 120, 140, 240]), false, 'above 230 bpm')
eq(validStarts(null), false, 'null')

const p: ProfileRow = {
  id: 'u1', unit: 'km', first_name: 'B', last_name: 'A', dob: '1990-06-15', sex: null,
  height_cm: null, weight_kg: null, resting_hr: 55, vo2max: null, hr_max: 185, hr_max_manual: false,
  zone_method: null, lthr: 168, zone_bounds: null,
}
eq(zoneStarts(p, 185), [111, 130, 148, 167], 'not chosen yet → % Max')
eq(zoneStarts({ ...p, zone_method: 'hrr' }, 185), [133, 146, 159, 172], 'saved Reserve')
eq(zoneStarts({ ...p, zone_method: 'hrr', resting_hr: null }, 185), [111, 130, 148, 167], 'Reserve without resting HR → % Max')
eq(zoneStarts({ ...p, zone_method: 'manual', zone_bounds: [150, 140, 160, 170] }, 185), [111, 130, 148, 167], 'broken manual → % Max')
eq(zoneStarts({ ...p, zone_method: 'lthr', lthr: 5 }, 185), [111, 130, 148, 167], 'saved broken LTHR → % Max')
eq(zoneStarts(null, 190), [114, 133, 152, 171], 'no profile → % Max of the given HRmax')

const s: [number, number, number, number] = [111, 130, 148, 167]
eq(zoneTimes({ '100': 60, '111': 30, '129': 10, '130': 20, '150': 40, '200': 5 }, s), [60, 40, 20, 40, 5],
  'seconds per zone; a bpm exactly on a start goes to the upper zone')
eq(zoneTimes(null, s), null, 'no histogram → no zones')

eq([0, 1, 2, 3, 4].map(i => zoneRangeLabel(i, s)), ['below 111', '111–129', '130–147', '148–166', '167 and up'], 'range labels')

eq(computePrimaryZone({ '140': 300, '160': 450 }, s), { zone: 4, name: 'Threshold', timeSec: 450 }, 'primary zone')
eq(computePrimaryZone(null, s), null, 'no histogram')
eq(computePrimaryZone({}, s), null, 'empty histogram')

// RA-22: summaries over many runs (s = [111, 130, 148, 167])
eq(sumZoneTimes([{ '100': 60, '140': 30 }, null, { '140': 10, '170': 20 }], s), [60, 0, 40, 0, 20],
  'sums zone seconds over runs; a run without HR is skipped')
eq(sumZoneTimes([null, null], s), null, 'no run has HR → null')
eq(sumZoneTimes([{}, null], s), null, 'only empty histograms → null')
eq(sumZoneTimes([], s), null, 'no runs → null')

eq(zonePcts([60, 0, 40, 0, 20]), [50, 0, 33, 0, 17], 'rounded % of total time in zones')
eq(zonePcts([0, 0, 0, 0, 0]), [0, 0, 0, 0, 0], 'all zero → all 0%, no NaN')

eq(topZones([60, 0, 40, 0, 20]), [{ zone: 1, pct: 50 }, { zone: 3, pct: 33 }], 'top 2 by time, biggest first')
eq(topZones([0, 300, 0, 0, 0]), [{ zone: 2, pct: 100 }], 'single zone → one entry, no "0%" second')
eq(topZones([0, 995, 4, 0, 0]), [{ zone: 2, pct: 100 }], 'second zone rounding to 0% is left out')
eq(topZones([0, 50, 50, 0, 0]), [{ zone: 2, pct: 50 }, { zone: 3, pct: 50 }], 'tie → lower zone first')
eq(topZones([0, 0, 0, 0, 0]), [], 'no time → nothing')

console.log('zones.check OK')
