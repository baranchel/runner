import type { QuantityTypeIdentifier, UnitForIdentifier } from '@kingstinct/react-native-healthkit'
import { hk } from './native'

export interface BodyData {
  dob: string | null          // 'YYYY-MM-DD'
  sex: 'female' | 'male' | 'other' | null
  heightCm: number | null
  weightKg: number | null
  restingHr: number | null
  vo2max: number | null
}

const EMPTY: BodyData = { dob: null, sex: null, heightCm: null, weightKg: null, restingHr: null, vo2max: null }

/** Prefill for the RA-11 personal-info form. Every field null when Health has nothing (or access was refused). */
export async function readBodyData(): Promise<BodyData> {
  const m = await hk()
  if (!m) return EMPTY
  const latest = <T extends QuantityTypeIdentifier>(id: T, unit: UnitForIdentifier<T>) =>
    m.getMostRecentQuantitySample(id, unit).then(s => s?.quantity ?? null).catch(() => null)
  const [dob, sex, height, weight, restingHr, vo2max] = await Promise.all([
    m.getDateOfBirthAsync().catch(() => undefined),
    m.getBiologicalSexAsync().catch(() => m.BiologicalSex.notSet),
    latest('HKQuantityTypeIdentifierHeight', 'm'),
    latest('HKQuantityTypeIdentifierBodyMass', 'kg'),
    latest('HKQuantityTypeIdentifierRestingHeartRate', 'count/min'),
    latest('HKQuantityTypeIdentifierVO2Max', 'ml/(kg*min)'),
  ])
  const sexName = { [m.BiologicalSex.female]: 'female', [m.BiologicalSex.male]: 'male', [m.BiologicalSex.other]: 'other' } as const
  return {
    dob: dob ? dob.toISOString().slice(0, 10) : null,
    sex: sexName[sex as keyof typeof sexName] ?? null,
    heightCm: height != null ? Math.round(height * 100) : null,
    weightKg: weight != null ? Math.round(weight * 10) / 10 : null,
    restingHr: restingHr != null ? Math.round(restingHr) : null,
    vo2max: vo2max != null ? Math.round(vo2max * 10) / 10 : null,
  }
}
