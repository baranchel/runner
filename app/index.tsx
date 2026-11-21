import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import { useAuthStore } from '../src/store/useAuthStore'
import { healthSkipped, needsHealthPrompt } from '../src/healthkit/permissions'

export default function Index() {
  const session = useAuthStore(s => s.session)
  const loading = useAuthStore(s => s.loading)
  const [askHealth, setAskHealth] = useState<boolean | null>(null)

  useEffect(() => {
    if (!session) return
    needsHealthPrompt().then(n => setAskHealth(n && !healthSkipped()))
  }, [session])

  if (loading) return null
  if (!session) return <Redirect href="/login" />
  if (askHealth === null) return null
  return <Redirect href={askHealth ? '/health-access' : '/(tabs)/dashboard'} />
}
