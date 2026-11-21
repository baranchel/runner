// Run: node src/utils/profile.check.ts
import {
  ageOn, autoHrMax, effectiveHrMax, estimateHrMax, isComplete, isoDate, nextAutoHrMax, parseNum, splitName,
  type ProfileRow,
} from './profile.ts'

function eq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${msg}: expected ${e}, got ${a}`)
}

const base: ProfileRow = {
  id: 'u1', unit: 'km', first_name: 'Bar', last_name: 'Anchel', dob: '1990-06-15', sex: null,
  height_cm: null, weight_kg: null, resting_hr: null, vo2max: null, hr_max: null, hr_max_manual: false,
}
const today = new Date(2026, 10, 21)  // 21 Nov 2026, local

// names
eq(splitName('Bar Anchel'), { first: 'Bar', last: 'Anchel' }, 'two words')
eq(splitName('  Mary Ann  Smith '), { first: 'Mary', last: 'Ann  Smith' }, 'rest is last name')
eq(splitName('Bar'), { first: 'Bar', last: '' }, 'one word')
eq(splitName(''), { first: '', last: '' }, 'empty')

// complete = first + last + dob
eq(isComplete(base), true, 'complete')
eq(isComplete({ ...base, last_name: '  ' }), false, 'blank last name')
eq(isComplete({ ...base, dob: null }), false, 'no dob')
eq(isComplete(null), false, 'no profile')

// dates (local parts, never UTC)
eq(isoDate(new Date(1990, 5, 15, 0, 0)), '1990-06-15', 'local midnight stays the same day')
eq(ageOn('1990-06-15', today), 36, 'birthday passed')
eq(ageOn('1990-12-01', today), 35, 'birthday not yet')

// numbers: '' → null, invalid → undefined, comma decimals OK
eq(parseNum(''), null, 'empty')
eq(parseNum(' 72.5 '), 72.5, 'decimal')
eq(parseNum('72,5'), 72.5, 'comma decimal')
eq(parseNum('abc'), undefined, 'invalid')
eq(parseNum('0'), undefined, 'zero invalid')
eq(parseNum('-3'), undefined, 'negative invalid')

// HRmax
const runs = [{ maxHr: 181.4 }, { maxHr: null }, { maxHr: 176 }]
eq(autoHrMax(runs), 181, 'highest run HR, rounded')
eq(autoHrMax([]), null, 'no runs')
eq(estimateHrMax('1990-06-15', today), 184, '220 - 36')
eq(estimateHrMax(null, today), null, 'no dob → no estimate')
eq(effectiveHrMax({ ...base, hr_max: 195, hr_max_manual: true }, runs, today), 195, 'saved wins')
eq(effectiveHrMax(base, runs, today), 181, 'auto from runs')
eq(effectiveHrMax(base, [], today), 184, 'estimate')
eq(effectiveHrMax(null, [], today), 190, 'last resort')

eq(nextAutoHrMax({ ...base, hr_max: 178 }, runs), 181, 'higher run raises auto')
eq(nextAutoHrMax({ ...base, hr_max: 185 }, runs), null, 'lower run keeps saved')
eq(nextAutoHrMax({ ...base, hr_max: null }, runs), 181, 'first auto value')
eq(nextAutoHrMax({ ...base, hr_max: 170, hr_max_manual: true }, runs), null, 'manual never changes')
eq(nextAutoHrMax(base, []), null, 'no runs, nothing to save')

console.log('profile.check: all passed')
