// Insights catalogue (RA-29): every Apple Health metric the Insights tab can show.
// Pure — no React Native imports (node self-check imports it). Adding a metric = one entry here.

export type Group = 'heart' | 'fitness' | 'form' | 'sleep' | 'body' | 'activity'
export type Kind = 'line' | 'bars' | 'sleep' | 'events' | 'workouts'
/** The card's dim line: see cardText() in summary.ts. */
export type Meta = 'compare' | 'today' | 'date' | 'lastRun' | 'baseline' | 'none'

export interface Metric {
  key: string                // stable id, stored in profiles.insights_layout
  group: Group
  label: string
  unit: string               // display unit ('' for counts)
  kind: Kind
  hk: readonly string[]      // HealthKit identifiers (read permission + query)
  hkUnit?: string            // unit asked from HealthKit (quantity types)
  scale?: number             // HealthKit value × scale = display value (m/s → km/h, fraction → %)
  meta: Meta
  decimals: number
  explain: string            // detail screen "what this means" — facts only, no judging
}

/** What the user hid and how they ordered metrics. null on the profile = defaults (all shown, catalogue order). */
export interface InsightsLayout { hidden: string[]; order: string[] }

export const GROUPS: readonly { key: Group; title: string; note?: string }[] = [
  { key: 'heart', title: 'Heart' },
  { key: 'fitness', title: 'Fitness' },
  { key: 'form', title: 'Running form', note: 'Apple Watch' },
  { key: 'sleep', title: 'Sleep & recovery' },
  { key: 'body', title: 'Body' },
  { key: 'activity', title: 'Activity', note: 'daily totals' },
]

const Q = (id: string) => `HKQuantityTypeIdentifier${id}`
const C = (id: string) => `HKCategoryTypeIdentifier${id}`

export const METRICS: readonly Metric[] = [
  // Heart
  { key: 'restingHr', group: 'heart', label: 'Resting HR', unit: 'bpm', kind: 'line', hk: [Q('RestingHeartRate')], hkUnit: 'count/min', meta: 'compare', decimals: 0,
    explain: 'Your heart rate while you are fully at rest. It usually drops as aerobic fitness improves, and can rise with fatigue, illness or short sleep.' },
  { key: 'hrv', group: 'heart', label: 'HRV', unit: 'ms', kind: 'line', hk: [Q('HeartRateVariabilitySDNN')], hkUnit: 'ms', meta: 'compare', decimals: 0,
    explain: 'Heart rate variability: how much the time between heartbeats varies (SDNN). It changes a lot from day to day; the trend over weeks says more than one reading.' },
  { key: 'cardioRecovery', group: 'heart', label: 'Cardio recovery', unit: 'bpm', kind: 'line', hk: [Q('HeartRateRecoveryOneMinute')], hkUnit: 'count/min', meta: 'date', decimals: 0,
    explain: 'How much your heart rate drops in the first minute after a workout ends. Apple measures it when you end a workout on Apple Watch.' },
  { key: 'walkingHr', group: 'heart', label: 'Walking HR', unit: 'bpm', kind: 'line', hk: [Q('WalkingHeartRateAverage')], hkUnit: 'count/min', meta: 'compare', decimals: 0,
    explain: 'Your average heart rate while walking during the day, measured by Apple Watch.' },
  { key: 'hrEvents', group: 'heart', label: 'HR notifications', unit: '', kind: 'events', hk: [C('HighHeartRateEvent'), C('LowHeartRateEvent'), C('IrregularHeartRhythmEvent')], meta: 'none', decimals: 0,
    explain: 'Notifications Apple Watch sent for a high or low heart rate while you seemed inactive, or for an irregular rhythm.' },
  // Fitness
  { key: 'vo2max', group: 'fitness', label: 'VO2max', unit: 'ml/kg·min', kind: 'line', hk: [Q('VO2Max')], hkUnit: 'ml/(kg*min)', meta: 'date', decimals: 1,
    explain: 'Cardio fitness: the most oxygen your body can use during intense exercise. Apple Watch estimates it during outdoor walks, runs and hikes.' },
  // Running form
  { key: 'power', group: 'form', label: 'Running power', unit: 'W', kind: 'line', hk: [Q('RunningPower')], hkUnit: 'W', meta: 'lastRun', decimals: 0,
    explain: 'How much power you produce while running, from your speed, the slope and your weight.' },
  { key: 'groundContact', group: 'form', label: 'Ground contact', unit: 'ms', kind: 'line', hk: [Q('RunningGroundContactTime')], hkUnit: 'ms', meta: 'lastRun', decimals: 0,
    explain: 'How long each foot stays on the ground per step while running.' },
  { key: 'vertOsc', group: 'form', label: 'Vertical osc.', unit: 'cm', kind: 'line', hk: [Q('RunningVerticalOscillation')], hkUnit: 'cm', meta: 'lastRun', decimals: 1,
    explain: 'How much your body moves up and down with each step while running.' },
  { key: 'runSpeed', group: 'form', label: 'Running speed', unit: 'km/h', kind: 'line', hk: [Q('RunningSpeed')], hkUnit: 'm/s', scale: 3.6, meta: 'lastRun', decimals: 1,
    explain: 'Your average running speed as measured by Apple Watch.' },
  // Sleep & recovery
  { key: 'sleep', group: 'sleep', label: 'Sleep last night', unit: 'h', kind: 'sleep', hk: [C('SleepAnalysis')], meta: 'none', decimals: 1,
    explain: 'Time asleep per night, split into core, deep and REM sleep when Apple Watch tracked it. Time awake in bed is not counted as sleep.' },
  { key: 'respiratory', group: 'sleep', label: 'Respiratory', unit: '/min', kind: 'line', hk: [Q('RespiratoryRate')], hkUnit: 'count/min', meta: 'compare', decimals: 1,
    explain: 'Breaths per minute, measured by Apple Watch while you sleep.' },
  { key: 'spo2', group: 'sleep', label: 'Blood oxygen', unit: '%', kind: 'line', hk: [Q('OxygenSaturation')], hkUnit: '%', scale: 100, meta: 'compare', decimals: 0,
    explain: 'The percentage of oxygen carried by your red blood cells, measured by Apple Watch.' },
  { key: 'wristTemp', group: 'sleep', label: 'Wrist temp', unit: '°C', kind: 'line', hk: [Q('AppleSleepingWristTemperature')], hkUnit: 'degC', meta: 'baseline', decimals: 1,
    explain: 'Your wrist temperature during sleep, shown as the change from your own 90-day average.' },
  // Body
  { key: 'weight', group: 'body', label: 'Weight', unit: 'kg', kind: 'line', hk: [Q('BodyMass')], hkUnit: 'kg', meta: 'date', decimals: 1,
    explain: 'Your body weight, as logged in Apple Health by you or a connected scale.' },
  { key: 'bodyFat', group: 'body', label: 'Body fat', unit: '%', kind: 'line', hk: [Q('BodyFatPercentage')], hkUnit: '%', scale: 100, meta: 'date', decimals: 1,
    explain: 'Your body fat percentage, as logged in Apple Health by you or a connected scale.' },
  // Activity (daily totals)
  { key: 'steps', group: 'activity', label: 'Steps', unit: '', kind: 'bars', hk: [Q('StepCount')], hkUnit: 'count', meta: 'today', decimals: 0,
    explain: 'Steps per day, from your iPhone and Apple Watch (Apple Health removes the overlap).' },
  { key: 'activeKcal', group: 'activity', label: 'Active calories', unit: 'kcal', kind: 'bars', hk: [Q('ActiveEnergyBurned')], hkUnit: 'kcal', meta: 'today', decimals: 0,
    explain: 'Energy burned by movement per day, on top of what your body uses at rest.' },
  { key: 'exercise', group: 'activity', label: 'Exercise', unit: 'min', kind: 'bars', hk: [Q('AppleExerciseTime')], hkUnit: 'min', meta: 'today', decimals: 0,
    explain: 'Minutes per day of movement at the intensity of a brisk walk or more (the green Activity ring).' },
  { key: 'walkRun', group: 'activity', label: 'Walk + run', unit: 'km', kind: 'bars', hk: [Q('DistanceWalkingRunning')], hkUnit: 'm', scale: 0.001, meta: 'today', decimals: 1,
    explain: 'Total distance walked and run per day, including your runs.' },
  { key: 'flights', group: 'activity', label: 'Flights climbed', unit: '', kind: 'bars', hk: [Q('FlightsClimbed')], hkUnit: 'count', meta: 'today', decimals: 0,
    explain: 'Floors climbed per day (about 3 m of height each).' },
  { key: 'standHours', group: 'activity', label: 'Stand hours', unit: 'h', kind: 'bars', hk: [C('AppleStandHour')], meta: 'today', decimals: 0,
    explain: 'Hours per day in which you stood and moved for at least a minute (the blue Activity ring).' },
  { key: 'restingKcal', group: 'activity', label: 'Resting energy', unit: 'kcal', kind: 'bars', hk: [Q('BasalEnergyBurned')], hkUnit: 'kcal', meta: 'today', decimals: 0,
    explain: 'Energy your body uses per day at rest, estimated by Apple Health.' },
  { key: 'daylight', group: 'activity', label: 'Time in daylight', unit: 'min', kind: 'bars', hk: [Q('TimeInDaylight')], hkUnit: 'min', meta: 'today', decimals: 0,
    explain: 'Minutes per day spent in daylight, measured by Apple Watch.' },
  { key: 'otherWorkouts', group: 'activity', label: 'Other workouts', unit: 'h', kind: 'workouts', hk: ['HKWorkoutTypeIdentifier'], meta: 'none', decimals: 1,
    explain: 'Time per week in workouts other than running (cycling, strength, swimming…), from any app that saves workouts to Apple Health.' },
]
