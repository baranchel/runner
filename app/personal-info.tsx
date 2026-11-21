import { useEffect, useState } from 'react'
import {
  Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import DateTimePicker from '@react-native-community/datetimepicker'
import { signInInfo } from '../src/api/auth'
import { readBodyData } from '../src/healthkit/bodyData'
import { useAuthStore } from '../src/store/useAuthStore'
import { useProfileStore } from '../src/store/useProfileStore'
import { useRunStore } from '../src/store/useRunStore'
import { autoHrMax, estimateHrMax, isoDate, parseNum, type Sex } from '../src/utils/profile'
import { buttons, colors, fonts } from '../src/utils/tokens'

// RA-11 onboarding (after Health) and RA-10 edit from Settings (?mode=edit). Units: cm/kg until RA-6.
const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'undisclosed', label: 'Prefer not to say' },
]
const str = (n: number | null | undefined) => (n == null ? '' : String(n))
const toDate = (iso: string) => new Date(`${iso}T00:00:00`)  // local midnight

export default function PersonalInfo() {
  const router = useRouter()
  const editing = useLocalSearchParams<{ mode?: string }>().mode === 'edit'
  const session = useAuthStore(s => s.session)
  const runs = useRunStore(s => s.runs)
  const saved = useProfileStore.getState().profile  // initial values only
  const info = session ? signInInfo(session) : null

  const [first,  setFirst]  = useState(saved?.first_name ?? info?.firstName ?? '')
  const [last,   setLast]   = useState(saved?.last_name ?? info?.lastName ?? '')
  const [dob,    setDob]    = useState<string | null>(saved?.dob ?? null)
  const [sex,    setSex]    = useState<Sex | null>(saved?.sex ?? null)
  const [height, setHeight] = useState(str(saved?.height_cm))
  const [weight, setWeight] = useState(str(saved?.weight_kg))
  const [restHr, setRestHr] = useState(str(saved?.resting_hr))
  const [vo2,    setVo2]    = useState(str(saved?.vo2max))
  const [hrText, setHrText] = useState(saved?.hr_max_manual ? str(saved.hr_max) : '')  // '' = auto
  const [dobOpen, setDobOpen] = useState(false)
  const [sexOpen, setSexOpen] = useState(false)

  // Fill what is still empty from Apple Health; saved values and anything already typed win.
  useEffect(() => {
    let alive = true
    readBodyData().then(h => {
      if (!alive) return
      setDob(v => v ?? h.dob)
      setSex(v => v ?? (h.sex === 'other' ? null : h.sex))
      setHeight(v => v || str(h.heightCm))
      setWeight(v => v || str(h.weightKg))
      setRestHr(v => v || str(h.restingHr))
      setVo2(v => v || str(h.vo2max))
    })
    return () => { alive = false }
  }, [])

  const fromRuns = autoHrMax(runs)
  const autoHr = fromRuns ?? estimateHrMax(dob, new Date())
  const hrNote = hrText ? null : fromRuns != null ? 'From your runs' : autoHr != null ? 'Estimated: 220 − age' : null

  const nums = {
    height_cm: parseNum(height), weight_kg: parseNum(weight), resting_hr: parseNum(restHr),
    vo2max: parseNum(vo2), hr_max: parseNum(hrText),
  }
  const numsValid = Object.values(nums).every(v => v !== undefined)
  const canSave = !!session && first.trim() !== '' && last.trim() !== '' && dob != null && numsValid

  const save = () => {
    if (!canSave || !session) return
    useProfileStore.getState().save(session.user.id, {
      first_name: first.trim(), last_name: last.trim(), dob, sex,
      height_cm: nums.height_cm ?? null, weight_kg: nums.weight_kg ?? null,
      resting_hr: nums.resting_hr ?? null, vo2max: nums.vo2max ?? null,
      // typed → the user's value; empty → highest HR from runs (the estimate is never saved)
      hr_max: nums.hr_max ?? fromRuns, hr_max_manual: nums.hr_max != null,
    })
    if (editing) router.back()
    else router.replace('/')  // index: complete profile → dashboard
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>{editing ? 'Personal info' : 'About you'}</Text>
        {!editing && (
          <Text style={s.body}>We filled in what Apple Health knows. Check it and fill in the rest.</Text>
        )}

        {info && (
          <View style={s.card}>
            <Text style={s.cardLabel}>Signed in with {info.method}</Text>
            <Text style={s.cardValue}>{info.email}</Text>
          </View>
        )}

        <View style={s.nameRow}>
          <View style={[s.field, s.flex]}>
            <Label text="First name" required />
            <TextInput style={s.input} value={first} onChangeText={setFirst} autoCapitalize="words"
              textContentType="givenName" placeholder="John" placeholderTextColor={colors.textGhost} />
          </View>
          <View style={[s.field, s.flex]}>
            <Label text="Last name" required />
            <TextInput style={s.input} value={last} onChangeText={setLast} autoCapitalize="words"
              textContentType="familyName" placeholder="Doe" placeholderTextColor={colors.textGhost} />
          </View>
        </View>

        <View style={s.field}>
          <Label text="Date of birth" required />
          <TouchableOpacity style={s.select} onPress={() => setDobOpen(v => !v)} activeOpacity={0.8}>
            <Text style={dob ? s.selectText : s.placeholder}>
              {dob ? toDate(dob).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select date'}
            </Text>
            <Image source={require('../assets/calendar.png')} style={s.icon} resizeMode="contain" />
          </TouchableOpacity>
          {dobOpen && (  // opens at 1990 for scrolling; dob stays empty until the user picks
            <DateTimePicker mode="date" display="spinner" themeVariant="dark" maximumDate={new Date()}
              value={dob ? toDate(dob) : new Date(1990, 0, 1)} onChange={(_, d) => { if (d) setDob(isoDate(d)) }} />
          )}
        </View>

        <View style={s.field}>
          <Label text="Sex" />
          <TouchableOpacity style={s.select} onPress={() => setSexOpen(v => !v)} activeOpacity={0.8}>
            <Text style={sex ? s.selectText : s.placeholder}>
              {SEX_OPTIONS.find(o => o.value === sex)?.label ?? 'Select'}
            </Text>
            <Image source={require('../assets/down-arrow.png')} style={s.icon} resizeMode="contain" />
          </TouchableOpacity>
          {sexOpen && (
            <View style={s.options}>
              {SEX_OPTIONS.map(o => (
                <TouchableOpacity key={o.value} style={s.option} activeOpacity={0.7}
                  onPress={() => { setSex(o.value); setSexOpen(false) }}>
                  <Text style={[s.selectText, o.value === sex && { color: colors.accent }]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <NumField label="Height" unit="cm" value={height} onChange={setHeight} />
        <NumField label="Weight" unit="kg" value={weight} onChange={setWeight} decimal />
        <NumField label="Resting HR" unit="bpm" value={restHr} onChange={setRestHr} />
        <NumField label="VO2max (if known)" unit="ml/kg/min" value={vo2} onChange={setVo2} decimal />
        <NumField label="HRmax" unit="bpm" value={hrText} onChange={setHrText}
          placeholder={str(autoHr)} note={hrNote} />

        {!numsValid && <Text style={s.error}>Numbers must be above 0.</Text>}

        <TouchableOpacity style={[buttons.primary, s.cta, !canSave && { opacity: 0.5 }]}
          onPress={save} disabled={!canSave} activeOpacity={0.82}>
          <Text style={[buttons.primaryText, s.ctaText]}>{editing ? 'Save' : 'Continue'}</Text>
        </TouchableOpacity>
        {editing && (
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={s.cancel}>Cancel</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <Text style={s.label}>
      {text}
      {required && <Text style={s.star}> *</Text>}
    </Text>
  )
}

function NumField({ label, unit, value, onChange, decimal, placeholder, note }: {
  label: string; unit: string; value: string; onChange: (t: string) => void
  decimal?: boolean; placeholder?: string; note?: string | null
}) {
  return (
    <View style={s.field}>
      <Label text={label} />
      <View style={s.inputWrap}>
        <TextInput style={s.inputFlex} value={value} onChangeText={onChange}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          placeholder={placeholder} placeholderTextColor={colors.textGhost} />
        <Text style={s.unit}>{unit}</Text>
      </View>
      {note && <Text style={s.note}>{note}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: colors.bgApp },
  container: { paddingHorizontal: 24, paddingTop: 70, paddingBottom: 40, gap: 14 },
  title:     { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 25, fontWeight: '600' },
  body:      { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },

  card:      { backgroundColor: colors.bgCard, borderRadius: 12, padding: 14, gap: 4 },
  cardLabel: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12 },
  cardValue: { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 15, fontWeight: '600' },

  nameRow:   { flexDirection: 'row', gap: 10 },
  flex:      { flex: 1 },
  field:     { gap: 4 },
  label:     { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, fontWeight: '500' },
  star:      { color: colors.danger },

  input:     { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderFocus, borderRadius: 10,
               paddingVertical: 11, paddingHorizontal: 14, color: colors.textPrimary, fontFamily: fonts.body, fontSize: 14 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSurface, borderWidth: 1,
               borderColor: colors.borderFocus, borderRadius: 10 },
  inputFlex: { flex: 1, paddingVertical: 11, paddingHorizontal: 14, color: colors.textPrimary, fontFamily: fonts.body, fontSize: 14 },
  unit:      { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, paddingHorizontal: 12 },
  note:      { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11 },

  select:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bgSurface,
               borderWidth: 1, borderColor: colors.borderFocus, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14 },
  selectText:{ color: colors.textPrimary, fontFamily: fonts.body, fontSize: 14 },
  placeholder:{ color: colors.textGhost, fontFamily: fonts.body, fontSize: 14 },
  icon:      { width: 16, height: 16, tintColor: colors.textMuted },
  options:   { backgroundColor: colors.bgCard, borderRadius: 10, borderWidth: 1, borderColor: colors.borderDefault, overflow: 'hidden' },
  option:    { paddingVertical: 12, paddingHorizontal: 14 },

  error:     { color: colors.danger, fontFamily: fonts.body, fontSize: 12 },
  cta:       { marginTop: 8, paddingVertical: 15, alignSelf: 'stretch' },
  ctaText:   { fontSize: 15 },
  cancel:    { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingVertical: 12 },
})
