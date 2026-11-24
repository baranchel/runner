// Brand logo from the brand-logos bucket; initials when the file is missing. Optional colour dot (RA-8).
import { useState } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { logoUrl } from '../api/shoes'
import { initials, type ColorKey } from '../shoes/shoes'
import { colors, fonts, shoeColors } from '../utils/tokens'

export function ShoeLogo({ brand, color, size = 38 }: { brand: string; color?: ColorKey | null; size?: number }) {
  const [failedFor, setFailedFor] = useState<string | null>(null)
  const failed = failedFor === brand
  const round = { width: size, height: size, borderRadius: size / 2 }
  return (
    <View>
      {failed ? (
        <View style={[s.circle, round]}><Text style={[s.initials, { fontSize: size * 0.34 }]}>{initials(brand)}</Text></View>
      ) : (
        <Image source={{ uri: logoUrl(brand) }} style={[s.circle, round]} resizeMode="contain" onError={() => setFailedFor(brand)} />
      )}
      {color && <ColorDot color={color} style={s.dot} />}
    </View>
  )
}

export function ColorDot({ color, size = 12, style }: { color: ColorKey; size?: number; style?: object }) {
  const dot = { width: size, height: size, borderRadius: size / 2 }
  if (color === 'multi') {
    return (
      <View style={[dot, s.dotBorder, { flexDirection: 'row', overflow: 'hidden' }, style]}>
        <View style={{ flex: 1, backgroundColor: colors.accent }} />
        <View style={{ flex: 1, backgroundColor: colors.lime }} />
      </View>
    )
  }
  return <View style={[dot, s.dotBorder, { backgroundColor: shoeColors[color] }, style]} />
}

const s = StyleSheet.create({
  circle:    { backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center' },
  initials:  { fontFamily: fonts.body, fontWeight: '700', color: colors.textPrimary },
  dot:       { position: 'absolute', right: -2, bottom: -2 },
  dotBorder: { borderWidth: 2, borderColor: colors.bgSurface },
})
