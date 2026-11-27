// More tab (replaces "You"): profile card + grouped settings rows. Spec: 2026-11-27-tab-layout-design.md
import { useCallback, useState, type ReactNode } from 'react'
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, type ImageSourcePropType } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { signOut, deleteAccount } from '../../src/api/auth'
import { clearAll, pendingCount } from '../../src/db/queries'
import { syncNow } from '../../src/db/sync'
import { needsHealthPrompt } from '../../src/healthkit/permissions'
import { useProfileStore } from '../../src/store/useProfileStore'
import { colors, fonts } from '../../src/utils/tokens'

export default function More() {
  const router = useRouter()
  const profile = useProfileStore(s => s.profile)
  const name = [profile?.first_name, profile?.last_name].map(n => n?.trim()).filter(Boolean).join(' ')
  const initials = [profile?.first_name, profile?.last_name].map(n => n?.trim()[0] ?? '').join('').toUpperCase()

  const [error,      setError]      = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [typed,      setTyped]      = useState('')
  const [busy,       setBusy]       = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const [canConnect, setCanConnect] = useState(false)
  // Tab stays mounted, so re-check on every focus (the user may have just connected).
  useFocusEffect(useCallback(() => { needsHealthPrompt().then(setCanConnect) }, []))

  // gate redirects to login on success; an explicit logout wipes the phone's copy
  const doLogOut = async () => {
    const err = await signOut()
    if (!err) clearAll()
    setError(err)
  }

  // Try to upload first; warn if changes would be lost.
  const logOut = async () => {
    if (loggingOut) return
    setError(null); setLoggingOut(true)
    await syncNow()
    setLoggingOut(false)
    if (pendingCount() === 0) return doLogOut()
    Alert.alert(
      'Unsynced changes',
      "Some changes haven't reached the cloud yet. Logging out now will lose them.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out anyway', style: 'destructive', onPress: doLogOut },
      ],
    )
  }

  const remove = async () => {
    if (typed !== 'DELETE' || busy) return
    setBusy(true); setError(null)
    const err = await deleteAccount()
    setBusy(false)
    if (err) setError(err)  // on success the gate redirects to login
    else clearAll()
  }

  const healthHelp = () => Alert.alert('Apple Health',
    'Runs missing? Open the iPhone Settings app → Health → Data Access & Devices → Chronodrom, and turn on all categories. ' +
    'New runs are imported when you open the app or pull down on All runs.')

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>More</Text>

        <TouchableOpacity style={s.profile} activeOpacity={0.85}
          onPress={() => router.push({ pathname: '/personal-info', params: { mode: 'edit' } })}>
          <View style={s.avatar}><Text style={s.avatarText}>{initials || '?'}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileName} numberOfLines={1}>{name || 'Your profile'}</Text>
            <Text style={s.profileSub}>Personal info</Text>
          </View>
          <Text style={s.profileChevron}>›</Text>
        </TouchableOpacity>

        <Group label="Training">
          <Row label="Heart-rate zones" icon={require('../../assets/heart-rate.png')}
            onPress={() => router.push({ pathname: '/hr-zones', params: { mode: 'edit' } })} />
        </Group>

        <Group label="Gear">
          <Row label="My shoes" icon={require('../../assets/shoe.png')} onPress={() => router.push('/shoes')} />
        </Group>

        <Group label="Connections">
          <Row label="Apple Health" icon={require('../../assets/apple-health.png')} keepColors value={canConnect ? 'Connect' : 'Connected'}
            onPress={canConnect ? () => router.push('/health-access') : healthHelp} />
        </Group>

        <Group label="Account">
          <Row label={loggingOut ? 'Syncing…' : 'Log out'} icon={require('../../assets/logout.png')} onPress={logOut} chevron={false} />
          <Row label="Delete account" icon={require('../../assets/delete.png')} danger onPress={() => setConfirming(true)} chevron={false} />
        </Group>

        {confirming && (
          <View style={s.dangerBox}>
            <Text style={s.body}>This permanently deletes your account and all your data. This can't be undone.</Text>
            <Text style={s.body}>Type DELETE to confirm.</Text>
            <TextInput style={s.input} value={typed} onChangeText={setTyped}
              autoCapitalize="characters" autoCorrect={false} placeholder="DELETE" placeholderTextColor={colors.textGhost} />
            <TouchableOpacity style={[s.dangerBtn, typed !== 'DELETE' && { opacity: 0.5 }]}
              onPress={remove} disabled={typed !== 'DELETE' || busy} activeOpacity={0.82}>
              <Text style={s.dangerBtnText}>{busy ? 'Deleting…' : 'Delete my account'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setConfirming(false); setTyped('') }} activeOpacity={0.7}>
              <Text style={s.cancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {error && <Text style={s.error}>{error}</Text>}
      </ScrollView>
    </SafeAreaView>
  )
}

// A group with no rows is simply not rendered by the screen (e.g. "App" until RA-6 / RA-44).
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View>
      <Text style={s.groupLabel}>{label.toUpperCase()}</Text>
      <View style={s.group}>{children}</View>
    </View>
  )
}

function Row({ label, icon, keepColors, value, danger, chevron = true, onPress }: {
  label: string; icon?: ImageSourcePropType; keepColors?: boolean; value?: string; danger?: boolean; chevron?: boolean; onPress: () => void
}) {
  const color = danger ? colors.danger : colors.textPrimary
  return (
    <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={onPress}>
      {icon && <Image source={icon} style={[s.rowIcon, !keepColors && { tintColor: danger ? colors.danger : colors.accent }]} />}
      <Text style={[s.rowText, { color }]}>{label}</Text>
      {value && <Text style={s.rowValue}>{value}</Text>}
      {chevron && <Text style={s.rowChevron}>›</Text>}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: colors.bgApp },
  content:  { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 32, gap: 18 },
  title:    { fontFamily: fonts.body, fontSize: 25, fontWeight: '600', color: colors.textPrimary },

  // Profile card (lavender) — achievements + goals get added here later
  profile:        { backgroundColor: colors.accent, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:         { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText:     { fontFamily: fonts.body, fontSize: 16, fontWeight: '700', color: colors.accent },
  profileName:    { fontFamily: fonts.body, fontSize: 15, fontWeight: '700', color: colors.ink },
  profileSub:     { fontFamily: fonts.body, fontSize: 11, color: colors.ink, opacity: 0.75, marginTop: 2 },
  profileChevron: { fontSize: 20, color: colors.ink },

  groupLabel: { fontFamily: fonts.body, fontSize: 11, fontWeight: '600', letterSpacing: 0.4, color: colors.textGhost, marginBottom: 6, marginLeft: 4 },
  group:      { backgroundColor: colors.bgSurface, borderRadius: 14, overflow: 'hidden' },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14,
                borderTopWidth: 1, borderTopColor: colors.borderSubtle, marginTop: -1 },
  rowIcon:    { width: 18, height: 18 },
  rowText:    { flex: 1, fontFamily: fonts.body, fontSize: 14, fontWeight: '500' },
  rowValue:   { fontFamily: fonts.body, fontSize: 12, color: colors.textGhost },
  rowChevron: { fontSize: 17, color: colors.textGhost },

  dangerBox:     { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.danger, borderRadius: 12, padding: 16, gap: 10 },
  body:          { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  input:         { backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.borderFocus, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, color: colors.textPrimary, fontSize: 15 },
  dangerBtn:     { backgroundColor: colors.danger, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  dangerBtnText: { color: '#fff', fontFamily: fonts.body, fontSize: 15, fontWeight: '700' },
  cancel:        { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingVertical: 12, marginTop: 6 },
  error:         { color: colors.danger, fontFamily: fonts.body, fontSize: 13 },
})
