import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import Svg, { Path } from 'react-native-svg'
import { colors } from '../src/utils/tokens'

const TERMS = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Capital letter',         test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter',       test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number',                 test: (p: string) => /[0-9]/.test(p) },
]

const MET   = '#4ade80'
const UNMET = colors.danger

export default function SignupScreen() {
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [agreed,   setAgreed]   = useState(false)

  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={s.logoBlock}>
          <Svg width={44} height={44} viewBox="0 0 40 40">
            <Path d="M23 2 L11 22 L20 22 L16 38 L29 18 L20 18 Z" fill={colors.accent} />
          </Svg>
          <Text style={s.wordmark}>SURGE</Text>
          <Text style={s.tagline}>Every run, decoded.</Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          <Text style={s.formTitle}>Create account</Text>

          <TextInput
            style={s.input}
            placeholder="Full name"
            placeholderTextColor={colors.textGhost}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <TextInput
            style={s.input}
            placeholder="Email"
            placeholderTextColor={colors.textGhost}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <TextInput
            style={s.input}
            placeholder="Password"
            placeholderTextColor={colors.textGhost}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
          />

          {/* Password requirements */}
          <View style={s.terms}>
            {TERMS.map(({ label, test }) => {
              const met = test(password)
              return (
                <View key={label} style={s.termRow}>
                  <View style={[s.termDot, { backgroundColor: met ? MET : UNMET }]} />
                  <Text style={[s.termLabel, { color: met ? MET : UNMET }]}>{label}</Text>
                </View>
              )
            })}
          </View>

          {/* Privacy policy */}
          <TouchableOpacity
            style={s.checkboxRow}
            onPress={() => setAgreed(v => !v)}
            activeOpacity={0.7}
          >
            <View style={[s.checkbox, agreed && s.checkboxChecked]}>
              {agreed && <Text style={s.checkmark}>✓</Text>}
            </View>
            <Text style={s.checkboxLabel}>
              {'I agree to the '}
              <Text style={s.link}>Privacy Policy</Text>
              {' and '}
              <Text style={s.link}>Terms of Service</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => router.replace('/(tabs)/dashboard')}
            activeOpacity={0.82}
          >
            <Text style={s.primaryBtnText}>Create account</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={s.switchLink}>Have an account? Log in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgApp,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 64,
  },
  logoBlock: {
    alignItems: 'center',
    marginBottom: 44,
    gap: 6,
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 3,
    marginTop: 6,
  },
  tagline: {
    fontSize: 12,
    color: colors.textGhost,
    letterSpacing: 0.3,
  },
  form: {
    gap: 12,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  input: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderFocus,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: colors.textPrimary,
    fontSize: 14,
  },
  terms: {
    gap: 7,
    paddingVertical: 2,
  },
  termRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  termDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  termLabel: {
    fontSize: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 2,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.borderFocus,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: colors.accentBg,
    borderColor: colors.accentBg,
  },
  checkmark: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  checkboxLabel: {
    fontSize: 12.5,
    color: colors.textSecondary,
    lineHeight: 18,
    flex: 1,
  },
  link: {
    color: colors.accent,
  },
  primaryBtn: {
    backgroundColor: colors.accentBg,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#f5eeff',
    fontSize: 14,
    fontWeight: '700',
  },
  switchLink: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
})
