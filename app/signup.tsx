import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, Image, Modal,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { router } from 'expo-router'
import { colors } from '../src/utils/tokens'
import { PRIVACY_POLICY } from '../src/legal/privacyPolicy'
import { TERMS_OF_SERVICE } from '../src/legal/termsOfService'

// ─── Constants ────────────────────────────────────────────────────────────────

const TERMS = [
  { label: 'At least 8 characters',       test: (p: string) => p.length >= 8 },
  { label: 'At least 1 capital letter',   test: (p: string) => /[A-Z]/.test(p) },
  { label: 'At least 1 lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'At least 1 number',           test: (p: string) => /[0-9]/.test(p) },
]

const MET   = '#4ade80'
const UNMET = colors.danger

function formatDate(d: Date) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SignupScreen() {
  const [name,        setName]        = useState('')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [confirmPwd,  setConfirmPwd]  = useState('')
  const [showPwd,     setShowPwd]     = useState(false)
  const [showConfPwd, setShowConfPwd] = useState(false)
  const [agreed,      setAgreed]      = useState(false)
  const [dob,         setDob]         = useState('')
  const [pickerDate,  setPickerDate]  = useState(new Date(2000, 0, 1))
  const [showPicker,  setShowPicker]  = useState(false)
  const [hintVisible, setHintVisible] = useState(false)
  const [legalDoc,    setLegalDoc]    = useState<'privacy' | 'terms' | null>(null)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Field refs for keyboard navigation
  const nameRef    = useRef<TextInput>(null)
  const emailRef   = useRef<TextInput>(null)
  const dobRef     = useRef<TextInput>(null)
  const pwdRef     = useRef<TextInput>(null)
  const confirmRef = useRef<TextInput>(null)

  const openHint = () => {
    setHintVisible(true)
    hintTimer.current = setTimeout(closeHint, 15000)
  }
  const closeHint = () => {
    setHintVisible(false)
    if (hintTimer.current) { clearTimeout(hintTimer.current); hintTimer.current = null }
  }

  const openPicker = () => {
    const parts = dob.split('/')
    if (parts.length === 3 && parts[2].length === 4) {
      const d = new Date(+parts[2], +parts[1] - 1, +parts[0])
      if (!isNaN(d.getTime())) setPickerDate(d)
    }
    setShowPicker(true)
  }

  const handleDobText = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 8)
    let out = digits
    if (digits.length > 2) out = digits.slice(0, 2) + '/' + digits.slice(2)
    if (digits.length > 4) out = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4)
    setDob(out)
  }

  const submit = () => router.replace('/(tabs)/dashboard')

  const passwordsMatch = confirmPwd.length > 0 && confirmPwd === password

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.container}>

        {/* Logo */}
        <View style={s.logoBlock}>
          <Image source={require('../assets/icon.png')} style={s.iconImg} tintColor={colors.accent} resizeMode="contain" />
          <Text style={s.wordmark}>Chronodrom</Text>
          <Text style={s.tagline}>Every run matters.</Text>
        </View>

        <View style={s.form}>
          <Text style={s.formTitle}>Create account</Text>

          {/* Full name */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Full name</Text>
            <TextInput
              ref={nameRef}
              style={s.input}
              placeholder="John Doe"
              placeholderTextColor={colors.textGhost}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* Email */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Email</Text>
            <TextInput
              ref={emailRef}
              style={s.input}
              placeholder="your@email.com"
              placeholderTextColor={colors.textGhost}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => dobRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* Date of birth */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Date of birth</Text>
            <View style={s.inputWrap}>
              <TextInput
                ref={dobRef}
                style={s.inputFlex}
                placeholder="DD / MM / YYYY"
                placeholderTextColor={colors.textGhost}
                value={dob}
                onChangeText={handleDobText}
                keyboardType="numeric"
                returnKeyType="next"
                onSubmitEditing={() => pwdRef.current?.focus()}
                blurOnSubmit={false}
              />
              <TouchableOpacity onPress={openPicker} style={s.eyeBtn} activeOpacity={0.7}>
                <Image source={require('../assets/calendar.png')}
                  style={[s.eyeIcon, { tintColor: colors.textMuted }]} resizeMode="contain" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Password */}
          <View style={s.fieldGroup}>
            <View style={s.labelRow}>
              <Text style={s.fieldLabel}>Password</Text>
              <TouchableOpacity onPress={openHint} style={s.hintBtn} activeOpacity={0.7}>
                <Image source={require('../assets/hint.png')} style={s.hintIcon} resizeMode="contain" />
              </TouchableOpacity>
            </View>
            <View style={s.inputWrap}>
              <TextInput
                ref={pwdRef}
                style={s.inputFlex}
                placeholder="••••••••"
                placeholderTextColor={colors.textGhost}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPwd}
                contextMenuHidden
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                blurOnSubmit={false}
              />
              <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={s.eyeBtn} activeOpacity={0.7}>
                <Image
                  source={showPwd ? require('../assets/hide-password.png') : require('../assets/show-password.png')}
                  style={s.eyeIcon} resizeMode="contain" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm password */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Confirm password</Text>
            <View style={[s.inputWrap, confirmPwd.length > 0 && { borderColor: passwordsMatch ? MET : UNMET }]}>
              <TextInput
                ref={confirmRef}
                style={s.inputFlex}
                placeholder="••••••••"
                placeholderTextColor={colors.textGhost}
                value={confirmPwd}
                onChangeText={setConfirmPwd}
                secureTextEntry={!showConfPwd}
                contextMenuHidden
                returnKeyType="done"
                onSubmitEditing={submit}
              />
              <TouchableOpacity onPress={() => setShowConfPwd(v => !v)} style={s.eyeBtn} activeOpacity={0.7}>
                <Image
                  source={showConfPwd ? require('../assets/hide-password.png') : require('../assets/show-password.png')}
                  style={s.eyeIcon} resizeMode="contain" />
              </TouchableOpacity>
            </View>
            {confirmPwd.length > 0 && !passwordsMatch && (
              <Text style={s.mismatchText}>Passwords don't match</Text>
            )}
          </View>

          {/* Privacy policy */}
          <TouchableOpacity style={s.checkboxRow} onPress={() => setAgreed(v => !v)} activeOpacity={0.7}>
            <View style={[s.checkbox, agreed && s.checkboxChecked]}>
              {agreed && <Text style={s.checkmark}>✓</Text>}
            </View>
            <Text style={s.checkboxLabel}>
              {'I agree to the '}
              <Text style={s.link} onPress={() => setLegalDoc('privacy')}>Privacy Policy</Text>
              {' and '}
              <Text style={s.link} onPress={() => setLegalDoc('terms')}>Terms of Service</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.primaryBtn} onPress={submit} activeOpacity={0.82}>
            <Text style={s.primaryBtnText}>Create account</Text>
          </TouchableOpacity>

          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or</Text>
            <View style={s.dividerLine} />
          </View>

          <TouchableOpacity style={s.googleBtn} activeOpacity={0.82}>
            <Image source={require('../assets/google-icon.png')} style={s.googleIcon} resizeMode="contain" />
            <Text style={s.googleBtnText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={s.switchLink}>Have an account? Log in</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Native OS date picker */}
      <Modal visible={showPicker} transparent animationType="slide">
        <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <TouchableOpacity activeOpacity={1} style={s.pickerSheet}>
            <View style={s.pickerHeader}>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={s.pickerCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setDob(formatDate(pickerDate)); setShowPicker(false) }}>
                <Text style={s.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display="spinner"
              themeVariant="dark"
              textColor={colors.textPrimary}
              maximumDate={new Date()}
              minimumDate={new Date(1930, 0, 1)}
              onChange={(_, date) => { if (date) setPickerDate(date) }}
              style={s.nativePicker}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Password requirements hint */}
      <Modal visible={hintVisible} transparent animationType="fade" onRequestClose={closeHint}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={closeHint}>
          <TouchableOpacity style={s.hintCard} activeOpacity={1}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Password requirements</Text>
              <TouchableOpacity onPress={closeHint} style={s.closeBtn} activeOpacity={0.7}>
                <Text style={s.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            {TERMS.map(({ label, test }) => {
              const met = test(password)
              return (
                <View key={label} style={s.termRow}>
                  <View style={[s.termDot, { backgroundColor: met ? MET : UNMET }]} />
                  <Text style={[s.termLabel, { color: met ? MET : UNMET }]}>{label}</Text>
                </View>
              )
            })}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Legal document viewer */}
      <Modal visible={legalDoc !== null} transparent animationType="slide" onRequestClose={() => setLegalDoc(null)}>
        <View style={s.legalOverlay}>
          <View style={s.legalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {legalDoc === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
              </Text>
              <TouchableOpacity onPress={() => setLegalDoc(null)} style={s.closeBtn} activeOpacity={0.7}>
                <Text style={s.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={s.legalScroll} showsVerticalScrollIndicator={false}>
              <Text style={s.legalText}>
                {legalDoc === 'privacy' ? PRIVACY_POLICY : TERMS_OF_SERVICE}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: colors.bgApp },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 32 },

  logoBlock: { alignItems: 'center', marginBottom: 20, gap: 6 },
  iconImg:   { width: 90, height: 90, marginBottom: 2 },
  wordmark:  { fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: 4 },
  tagline:   { fontSize: 12, color: colors.textGhost, letterSpacing: 0.3 },

  form:      { gap: 10 },
  formTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  fieldGroup:{ gap: 4 },
  labelRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldLabel:{ fontSize: 12, fontWeight: '500', color: colors.textSecondary },

  input: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderFocus,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    color: colors.textPrimary,
    fontSize: 14,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderFocus,
    borderRadius: 10,
  },
  inputFlex: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    color: colors.textPrimary,
    fontSize: 14,
  },
  eyeBtn:  { paddingHorizontal: 12 },
  eyeIcon: { width: 18, height: 18, tintColor: colors.textMuted },
  hintBtn: { width: 15, height: 15 },
  hintIcon:{ width: 15, height: 15, tintColor: colors.textMuted },

  mismatchText: { fontSize: 11, color: UNMET, marginTop: 2 },

  checkboxRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  checkbox:       { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: colors.borderFocus, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  checkboxChecked:{ backgroundColor: colors.accentBg, borderColor: colors.accentBg },
  checkmark:      { color: '#fff', fontSize: 11, fontWeight: '700', lineHeight: 13 },
  checkboxLabel:  { fontSize: 12, color: colors.textSecondary, lineHeight: 17, flex: 1 },
  link:           { color: colors.accent },

  primaryBtn:     { backgroundColor: colors.accentBg, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  primaryBtnText: { color: '#f5eeff', fontSize: 14, fontWeight: '700' },
  dividerRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine:    { flex: 1, height: 1, backgroundColor: colors.borderSubtle },
  dividerText:    { fontSize: 11, color: colors.textGhost },
  googleBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 10, paddingVertical: 12 },
  googleIcon:     { width: 20, height: 20 },
  googleBtnText:  { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  switchLink:     { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },

  // Date picker sheet
  pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  pickerSheet:   { backgroundColor: colors.bgCard, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 32 },
  pickerHeader:  { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  pickerCancel:  { fontSize: 15, color: colors.textSecondary },
  pickerDone:    { fontSize: 15, color: colors.accent, fontWeight: '600' },
  nativePicker:  { width: '100%' },

  // Shared modal header
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle:  { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  closeBtn:    { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center' },
  closeBtnText:{ fontSize: 11, color: colors.danger, fontWeight: '700' },

  // Hint modal
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  hintCard:  { width: '100%', backgroundColor: colors.bgCard, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: colors.borderDefault },
  termRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  termDot:   { width: 8, height: 8, borderRadius: 4 },
  termLabel: { fontSize: 14 },

  // Legal document sheet
  legalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  legalSheet:   { backgroundColor: colors.bgCard, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 40, maxHeight: '85%' },
  legalScroll:  { marginTop: 4 },
  legalText:    { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
})
