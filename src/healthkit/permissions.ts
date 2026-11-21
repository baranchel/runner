import { getMeta, setMeta } from '../db/queries'
import { hk } from './native'

// One prompt for everything RA-3 and RA-11 read. iOS shows it once per install.
const READ = [
  'HKWorkoutTypeIdentifier',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierStepCount',
  'HKCharacteristicTypeIdentifierDateOfBirth',
  'HKCharacteristicTypeIdentifierBiologicalSex',
  'HKQuantityTypeIdentifierHeight',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierVO2Max',
] as const

/** True while iOS has not shown the prompt yet (iOS remembers per install, so no flag of ours). */
export async function needsHealthPrompt(): Promise<boolean> {
  const m = await hk()
  if (!m) return false
  // A HealthKit error must not leave index / Settings waiting forever → treat as "nothing to ask".
  return m.getRequestStatusForAuthorization({ toRead: READ })
    .then(s => s === m.AuthorizationRequestStatus.shouldRequest)
    .catch(() => false)
}

/** Shows the iOS prompt. iOS never says what was allowed: a "no" simply returns no data later. */
export async function requestHealthAccess(): Promise<void> {
  const m = await hk()
  if (m) await m.requestAuthorization({ toRead: READ }).catch(e => console.warn('[healthkit] prompt failed', e))
}

// "Not now" on the Health screen: don't show it again on every launch (Settings → Connect brings it back).
// Lives in sync_state, so logout clears it — fine, the next login asks once more.
export const healthSkipped = () => getMeta('health_skipped') === '1'
export const skipHealth = () => setMeta('health_skipped', '1')
