import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Image,
} from 'react-native'
import { router } from 'expo-router'
import { colors } from '../src/utils/tokens'

export default function LoginScreen() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)

  const emailRef    = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)

  const submit = () => router.replace('/(tabs)/dashboard')

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Logo */}
        <View style={s.logoBlock}>
          <Image source={require('../assets/icon.png')} style={s.iconImg} tintColor={colors.accent} resizeMode="contain" />
          <Text style={s.wordmark}>Chronodrom</Text>
          <Text style={s.tagline}>Every run matters.</Text>
        </View>

        <View style={s.form}>
          <Text style={s.formTitle}>Log in</Text>

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
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Password</Text>
            <View style={s.inputWrap}>
              <TextInput
                ref={passwordRef}
                style={s.inputFlex}
                placeholder="••••••••"
                placeholderTextColor={colors.textGhost}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPwd}
                contextMenuHidden
                returnKeyType="done"
                onSubmitEditing={submit}
              />
              <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={s.eyeBtn} activeOpacity={0.7}>
                <Image
                  source={showPwd ? require('../assets/hide-password.png') : require('../assets/show-password.png')}
                  style={s.eyeIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={s.primaryBtn} onPress={submit} activeOpacity={0.82}>
            <Text style={s.primaryBtnText}>Log in</Text>
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

          <TouchableOpacity onPress={() => router.push('/signup')} activeOpacity={0.7}>
            <Text style={s.switchLink}>No account? Sign up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: colors.bgApp },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 60 },

  logoBlock: { alignItems: 'center', marginBottom: 48, gap: 8 },
  iconImg:   { width: 90, height: 90, marginBottom: 4 },
  wordmark:  { fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: 4 },
  tagline:   { fontSize: 13, color: colors.textGhost, letterSpacing: 0.3 },

  form:      { gap: 14 },
  formTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  fieldGroup:{ gap: 5 },
  fieldLabel:{ fontSize: 12, fontWeight: '500', color: colors.textSecondary },

  input: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderFocus,
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 16,
    color: colors.textPrimary,
    fontSize: 15,
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
    paddingVertical: 15,
    paddingHorizontal: 16,
    color: colors.textPrimary,
    fontSize: 15,
  },
  eyeBtn:  { paddingHorizontal: 12 },
  eyeIcon: { width: 20, height: 20, tintColor: colors.textMuted },

  primaryBtn:     { backgroundColor: colors.accentBg, borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 2 },
  primaryBtnText: { color: '#f5eeff', fontSize: 15, fontWeight: '700' },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderSubtle },
  dividerText: { fontSize: 12, color: colors.textGhost },

  googleBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 10, paddingVertical: 15 },
  googleIcon:    { width: 22, height: 22 },
  googleBtnText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },

  switchLink: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 2 },
})
