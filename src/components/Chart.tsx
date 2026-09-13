import React, { useRef, useState } from 'react'
import { PanResponder, View } from 'react-native'
import { Circle, Line, Path, Polyline, Rect, Svg, Text as SvgText } from 'react-native-svg'
import { buildChartPaths } from '../utils/chart'
import { colors, fonts } from '../utils/tokens'

const LABEL_W = 32
const BAR_Y   = 14
const BAR_H   = 96
const TL_H    = 20
const VW      = 300
const VH      = BAR_Y + BAR_H + TL_H  // 130

function fmtMM(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// [lo, hi] bpm pairs, one per time window
export function HrBarsChart({
  bars, minHr, maxHr, timeSec,
}: {
  bars: [number, number][]
  minHr: number
  maxHr: number
  timeSec: number
}) {
  const [svgWidth, setSvgWidth] = useState(0)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const viewWidth = useRef(0)

  const allVals = bars.flat()
  const dataMin = Math.min(...allVals)
  const dataMax = Math.max(...allVals)
  const range = dataMax - dataMin || 1
  const n = bars.length
  const barAreaW = VW - LABEL_W
  const slotW = barAreaW / n
  const barW = Math.max(1, slotW - 1.5)
  const toY = (v: number) => BAR_Y + BAR_H - ((v - dataMin) / range) * BAR_H

  const tl = [0, Math.round(timeSec / 2), timeSec]
  const tlX = [LABEL_W, LABEL_W + barAreaW / 2, VW]
  const tlAnchor = ['start', 'middle', 'end'] as const

  const setFromX = (locationX: number) => {
    const svgX = (locationX / viewWidth.current) * VW
    const idx = Math.max(0, Math.min(n - 1, Math.floor((svgX - LABEL_W) / slotW)))
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

  const activeLo = activeIdx !== null ? Math.round(bars[activeIdx][0]) : null
  const activeHi = activeIdx !== null ? Math.round(bars[activeIdx][1]) : null
  const activeBarCx = activeIdx !== null ? LABEL_W + activeIdx * slotW + slotW / 2 : null
  // clamp pill so it never overflows (pill ~60 SVG units wide)
  const pillX = activeBarCx !== null ? Math.max(LABEL_W, Math.min(activeBarCx - 30, VW - 60)) : 0

  return (
    <View
      onLayout={e => {
        viewWidth.current = e.nativeEvent.layout.width
        setSvgWidth(e.nativeEvent.layout.width)
      }}
      {...panResponder.panHandlers}
    >
      {svgWidth > 0 && (
        <Svg viewBox={`0 0 ${VW} ${VH}`} width={svgWidth} height={140}>
          {bars.map(([lo, hi], i) => (
            <Rect
              key={i}
              x={LABEL_W + i * slotW + (slotW - barW) / 2}
              y={toY(hi)}
              width={barW}
              height={Math.max(2, toY(lo) - toY(hi))}
              rx={1}
              fill={colors.hrLine}
              fillOpacity={activeIdx === null || activeIdx === i ? 0.85 : 0.3}
            />
          ))}

          {/* scrubber */}
          {activeIdx !== null && activeBarCx !== null && (
            <>
              <Line
                x1={activeBarCx} y1={BAR_Y} x2={activeBarCx} y2={BAR_Y + BAR_H}
                stroke="white" strokeOpacity={0.25} strokeWidth={1}
              />
              <Rect x={pillX} y={BAR_Y - 1} width={60} height={18} rx={4} fill={colors.bgElevated} />
              <SvgText
                x={pillX + 30} y={BAR_Y + 11}
                textAnchor="middle"
                fill={colors.textPrimary} fontSize={10} fontFamily={fonts.mono}
              >
                {activeLo}–{activeHi}
              </SvgText>
            </>
          )}

          {/* Y-axis labels — hidden while scrubbing so pill takes over */}
          {activeIdx === null && (
            <>
              <SvgText
                x={LABEL_W - 4} y={BAR_Y + 9}
                fill={colors.textMuted} fontSize={9} fontFamily={fonts.mono}
                textAnchor="end"
              >
                {maxHr}
              </SvgText>
              <SvgText
                x={LABEL_W - 4} y={BAR_Y + BAR_H}
                fill={colors.textMuted} fontSize={9} fontFamily={fonts.mono}
                textAnchor="end"
              >
                {minHr}
              </SvgText>
            </>
          )}

          <Line x1={LABEL_W} y1={BAR_Y + BAR_H + 6} x2={VW} y2={BAR_Y + BAR_H + 6}
            stroke={colors.borderSubtle} strokeWidth={0.5} />
          {tl.map((t, i) => (
            <SvgText
              key={i}
              x={tlX[i]} y={VH - 2}
              fill={colors.textMuted} fontSize={9} fontFamily={fonts.mono}
              textAnchor={tlAnchor[i]}
            >
              {fmtMM(t)}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  )
}

interface ChartProps {
  series: number[]
  strokeColor: string
  formatValue: (v: number) => string
}

export function Chart({ series, strokeColor, formatValue }: ChartProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [svgWidth, setSvgWidth] = useState(0)
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
  const labelX = crossX !== null ? Math.max(5, Math.min(crossX - 25, 245)) : 0

  return (
    <View
      onLayout={(e) => {
        viewWidth.current = e.nativeEvent.layout.width
        setSvgWidth(e.nativeEvent.layout.width)
      }}
      {...panResponder.panHandlers}
    >
      {svgWidth > 0 && (
        <Svg viewBox="0 0 300 100" width={svgWidth} height={90}>
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
      )}
    </View>
  )
}
