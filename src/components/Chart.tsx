import React, { useRef, useState } from 'react'
import { PanResponder, View } from 'react-native'
import { Circle, Line, Path, Polyline, Rect, Svg, Text as SvgText } from 'react-native-svg'

// [lo, hi] bpm pairs, one per time window
export function HrBarsChart({ bars }: { bars: [number, number][] }) {
  const allVals = bars.flat()
  const min = Math.min(...allVals)
  const max = Math.max(...allVals)
  const range = max - min || 1
  const n = bars.length
  const slotW = 300 / n
  const barW = Math.max(1, slotW - 1.5)
  const toY = (v: number) => 90 - ((v - min) / range) * 80

  return (
    <Svg viewBox="0 0 300 100" width="100%" height={90}>
      {bars.map(([lo, hi], i) => (
        <Rect
          key={i}
          x={i * slotW + (slotW - barW) / 2}
          y={toY(hi)}
          width={barW}
          height={Math.max(2, toY(lo) - toY(hi))}
          rx={1}
          fill={colors.hrLine}
          fillOpacity={0.85}
        />
      ))}
    </Svg>
  )
}

import { buildChartPaths } from '../utils/chart'
import { colors, fonts } from '../utils/tokens'

interface ChartProps {
  series: number[]
  strokeColor: string
  formatValue: (v: number) => string
}

export function Chart({ series, strokeColor, formatValue }: ChartProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const viewWidth = useRef(0)
  const n = series.length

  const { area, line } = buildChartPaths(series)
  const min = Math.min(...series)
  const max = Math.max(...series)
  const range = max - min || 1
  const toX = (i: number) => (i / (n - 1)) * 300
  const toY = (v: number) => 100 - 10 - ((v - min) / range) * 80

  const setFromX = (locationX: number) => {
    const svgX = (locationX / viewWidth.current) * 300
    const idx = Math.max(0, Math.min(n - 1, Math.round((svgX / 300) * (n - 1))))
    setActiveIdx(idx)
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderRelease: () => setActiveIdx(null),
      onPanResponderTerminate: () => setActiveIdx(null),
    }),
  ).current

  const crossX = activeIdx !== null ? toX(activeIdx) : null
  const crossY = activeIdx !== null ? toY(series[activeIdx]) : null
  const labelText = activeIdx !== null ? formatValue(series[activeIdx]) : null
  // clamp label pill so it never overflows (pill is ~50 SVG units wide)
  const labelX = crossX !== null ? Math.max(5, Math.min(crossX - 25, 245)) : 0

  return (
    <View
      onLayout={(e) => { viewWidth.current = e.nativeEvent.layout.width }}
      {...panResponder.panHandlers}
    >
      <Svg viewBox="0 0 300 100" width="100%" height={90}>
        <Path d={area} fill={strokeColor} fillOpacity={0.15} stroke="none" />
        <Polyline points={line} fill="none" stroke={strokeColor} strokeWidth={2} />
        {activeIdx !== null && crossX !== null && crossY !== null && (
          <>
            <Line
              x1={crossX} y1={10} x2={crossX} y2={90}
              stroke="white" strokeOpacity={0.3} strokeWidth={1}
            />
            <Circle
              cx={crossX} cy={crossY} r={4}
              fill={strokeColor} stroke="white" strokeWidth={1.5}
            />
            <Rect x={labelX} y={2} width={50} height={18} rx={4} fill={colors.bgElevated} />
            <SvgText
              x={labelX + 25} y={14}
              textAnchor="middle"
              fill={colors.textPrimary}
              fontSize={10}
              fontFamily={fonts.mono}
            >
              {labelText}
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  )
}
