import { Redirect } from 'expo-router'
import { useAuthStore } from '../src/store/useAuthStore'

export default function Index() {
  const session = useAuthStore(s => s.session)
  const loading = useAuthStore(s => s.loading)
  if (loading) return null
  return <Redirect href={session ? '/(tabs)/dashboard' : '/login'} />
}
