import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import Svg, { Path } from 'react-native-svg'
import { colors } from '../src/utils/tokens'

export default function LoginScreen() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')

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
          <Text style={s.formTitle}>Log in</Text>

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

          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => router.replace('/(tabs)/dashboard')}
            activeOpacity={0.82}
          >
            <Text style={s.primaryBtnText}>Log in</Text>
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
