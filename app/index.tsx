import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import { syncNow } from '../src/db/sync'
import { healthSkipped, needsHealthPrompt } from '../src/healthkit/permissions'
import { useAuthStore } from '../src/store/useAuthStore'
import { useProfileStore } from '../src/store/useProfileStore'
import { isComplete } from '../src/utils/profile'

// The one place that picks the screen after login: Health prompt → personal info (RA-11) → HR zones (RA-9) → Dashboard.
export default function Index() {
  const session = useAuthStore(s => s.session)
  const loading = useAuthStore(s => s.loading)
  const profile = useProfileStore(s => s.profile)
  const [askHealth, setAskHealth] = useState<boolean | null>(null)
  const [synced, setSynced] = useState(false)

  useEffect(() => {
    if (!session) return
    needsHealthPrompt().then(n => setAskHealth(n && !healthSkipped()))
    // New device / reinstall: no local profile yet → wait for one sync, so a profile filled elsewhere skips the form.
    // At most 5 s: a hanging connection would otherwise leave a blank screen until iOS times out (~60 s).
    if (useProfileStore.getState().profile) setSynced(true)
    else Promise.race([syncNow(), new Promise(r => setTimeout(r, 5000))]).finally(() => setSynced(true))
  }, [session])

  if (loading) return null
  if (!session) return <Redirect href="/login" />
  if (askHealth === null) return null
  if (askHealth) return <Redirect href="/health-access" />
  if (!synced) return null
  if (!isComplete(profile)) return <Redirect href="/personal-info" />
  return <Redirect href={profile!.zone_method == null ? '/hr-zones' : '/(tabs)/dashboard'} />
}
