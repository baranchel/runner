// Loaded lazily: the native module doesn't exist in Expo Go, and a top-level import would crash it.
type HK = typeof import('@kingstinct/react-native-healthkit')
let mod: Promise<HK | null> | null = null

/** The HealthKit module, or null (Expo Go, or a device without Health such as an iPad). */
export function hk(): Promise<HK | null> {
  mod ??= import('@kingstinct/react-native-healthkit')
    .then(m => (m.isHealthDataAvailable() ? m : null))
    .catch(() => null)
  return mod
}
