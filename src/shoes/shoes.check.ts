// Run: node src/shoes/shoes.check.ts
import type { Run } from '../types/index.ts'
import {
  cardLevel, defaultFill, displayName, extraKm, initials, level, logoFile, lowerLevels,
  pastRunCandidates, popupLevel, shoeDistance, shoeProblem, shoeStats, type ShoeRow,
} from './shoes.ts'

function eq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${msg}: expected ${e}, got ${a}`)
}

const shoe: ShoeRow = {
  id: 's1', brand: 'Nike', model: 'Pegasus', name: null, color: null, in_use_from: '2026-10-01',
  limit_km: 700, extra_km: 0, retired: false, alert_level: 0, card_dismissed: 0,
}
const run = (id: string, date: string, km: number, shoeId: string | null, timeSec = km * 300) =>
  ({ id, date, distanceKm: km, timeSec, shoeId }) as Run

// distance = assigned runs + extra
const runs = [run('a', '2026-10-02', 10, 's1'), run('b', '2026-10-05', 20, 's1'), run('c', '2026-10-06', 5, 's2')]
eq(shoeDistance(shoe, runs), 30, 'only this shoe’s runs')
eq(shoeDistance({ ...shoe, extra_km: 88 }, runs), 118, 'extra km added')

// levels: 90% and 100% edges (no float trouble at 630 / 700)
eq(level(629.9, 700), 0, 'just under 90%')
eq(level(630, 700), 90, 'exactly 90%')
eq(level(699.9, 700), 90, 'just under 100%')
eq(level(700, 700), 100, 'exactly 100%')
eq(level(50, 0), 0, 'limit 0 never alerts')

// pop-up: once per level
eq(popupLevel(shoe, 640), 90, '90% first time → pop-up')
eq(popupLevel({ ...shoe, alert_level: 90 }, 650), null, '90% already shown')
eq(popupLevel({ ...shoe, alert_level: 90 }, 700), 100, '100% after 90%')
eq(popupLevel(shoe, 710), 100, 'straight to 100% → 100 pop-up only')
eq(popupLevel({ ...shoe, retired: true }, 710), null, 'retired → no pop-up')
eq(popupLevel(shoe, 100), null, 'under 90% → none')

// card: until dismissed for that level
eq(cardLevel(shoe, 640), 90, 'card at 90%')
eq(cardLevel({ ...shoe, card_dismissed: 90 }, 640), null, 'dismissed at 90%')
eq(cardLevel({ ...shoe, card_dismissed: 90 }, 700), 100, 'comes back at 100%')
eq(cardLevel({ ...shoe, retired: true }, 700), null, 'retired → no card')

// raising the limit lowers the remembered levels, so alerts can fire again
eq(lowerLevels({ ...shoe, limit_km: 900, alert_level: 100, card_dismissed: 90 }, 700), { alert_level: 0, card_dismissed: 0 }, 'back under 90%')
eq(lowerLevels({ ...shoe, limit_km: 750, alert_level: 100, card_dismissed: 100 }, 700), { alert_level: 90, card_dismissed: 90 }, '100 → 90')
eq(lowerLevels({ ...shoe, alert_level: 90, card_dismissed: 0 }, 650), { alert_level: 90, card_dismissed: 0 }, 'never raised')

// default fill: only an empty shoe, only an active default
const active = new Set(['s1'])
eq(defaultFill(null, 's1', active), 's1', 'empty → default')
eq(defaultFill('s2', 's1', active), 's2', 'existing shoe kept')
eq(defaultFill(null, 's9', active), null, 'retired / unknown default ignored')
eq(defaultFill(null, null, active), null, 'no default → none')

// past runs step
eq(pastRunCandidates('2026-10-03', runs.concat(run('d', '2026-10-04', 7, null), run('e', '2026-09-30', 7, null))).map(r => r.id), ['d'], 'since date, no shoe only')
eq(extraKm(400, 312), 88, 'typed − assigned')
eq(extraKm(300, 312), 0, 'never negative')

// stats
eq(shoeStats(shoe, runs), { distanceKm: 30, runCount: 2, avgPaceSecPerKm: 300, lastUsed: '2026-10-05' }, 'stats')
eq(shoeStats({ ...shoe, id: 'none' }, runs), { distanceKm: 0, runCount: 0, avgPaceSecPerKm: null, lastUsed: null }, 'no runs')

// write guard
eq(shoeProblem({ brand: 'Nike', model: 'Pegasus', in_use_from: '2026-10-01', limit_km: 700 }), null, 'valid new shoe')
eq(shoeProblem({ limit_km: NaN }), 'limit_km must be > 0', 'NaN limit')
eq(shoeProblem({ limit_km: 0 }), 'limit_km must be > 0', 'zero limit')
eq(shoeProblem({ extra_km: -1 }), 'extra_km must be ≥ 0', 'negative extra')
eq(shoeProblem({ model: '  ' }), 'model is empty', 'blank model')
eq(shoeProblem({ alert_level: 90 }), null, 'unrelated patch')

// names, logos
eq(displayName(shoe), 'Pegasus', 'model when no name')
eq(displayName({ ...shoe, color: 'orange' }), 'Pegasus · Orange', 'model + colour')
eq(displayName({ ...shoe, name: '  Race pair ', color: 'orange' }), 'Race pair', 'own name wins, trimmed')
eq(logoFile('New Balance'), 'new-balance.png', 'logo file spaces')
eq(logoFile('Inov-8'), 'inov-8.png', 'logo file dash')
eq(logoFile('On'), 'on.png', 'logo file short')
eq(initials('New Balance'), 'NB', 'two words')
eq(initials('Nike'), 'N', 'one word')
eq(initials('Inov-8'), 'I8', 'dash splits')

console.log('shoes.check: all passed')
