import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { colors } from '../src/utils/tokens'
import { useAuthStore } from '../src/store/useAuthStore'

SplashScreen.preventAutoHideAsync()

// Keep the splash up until we know whether a stored session exists (no wrong-screen flash).
function SplashGate() {
  const loading = useAuthStore(s => s.loading)
  useEffect(() => { if (!loading) SplashScreen.hideAsync() }, [loading])
  return null
}

export default function RootLayout() {
  const session = useAuthStore(s => s.session)
  const loading = useAuthStore(s => s.loading)

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <StatusBar style="light" />
      <SplashGate />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgApp } }}>
        {/* Always reachable. index redirects by session; it is also where guards fall back to. */}
        <Stack.Screen name="index" />
        <Stack.Screen name="auth-callback" />
        <Stack.Screen name="reset-password" />

        <Stack.Protected guard={!loading && !session}>
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="forgot-password" />
        </Stack.Protected>

        <Stack.Protected guard={!loading && !!session}>
          <Stack.Screen name="health-access" />
          <Stack.Screen name="personal-info" />
          <Stack.Screen name="hr-zones" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="run/[id]" />
          <Stack.Screen name="run/[id]/segments" options={{ presentation: 'modal' }} />
          <Stack.Screen name="run/[id]/splits" options={{ presentation: 'modal' }} />
          <Stack.Screen name="run/[id]/zones" options={{ presentation: 'modal' }} />
          <Stack.Screen name="insight/[key]" />
          <Stack.Screen name="insights-edit" />
          <Stack.Screen name="shoes/index" />
          <Stack.Screen name="shoes/edit" options={{ presentation: 'modal' }} />
          <Stack.Screen name="shoes/past-runs" options={{ presentation: 'modal' }} />
          <Stack.Screen name="shoes/defaults" options={{ presentation: 'modal' }} />
          <Stack.Screen name="shoes/[id]" />
        </Stack.Protected>
      </Stack>
    </GestureHandlerRootView>
  )
}
