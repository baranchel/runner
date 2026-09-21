import React, { useRef, useState } from 'react'
import { PanResponder, View } from 'react-native'
import { Circle, Line, Path, Polyline, Rect, Svg, Text as SvgText } from 'react-native-svg'
import { buildChartPaths } from '../utils/chart'
import { fmtMMSS } from '../utils/format'
import { colors, fonts } from '../utils/tokens'
import type { Split } from '../types'

const R_LABEL = 28   // right-side label column
const DOT_Y   = 14
const DOT_H   = 86
const DOT_TL  = 20
const DOT_VW  = 300
const DOT_VH  = DOT_Y + DOT_H + DOT_TL
const DOT_RENDER_H = 130   // px height the Svg is rendered at

function fmtElapsed(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

// HR range bars — each bar spans min→max bpm of a time window
export function HrRangeBarsChart({ dots, timeSec }: {
  dots: number[]
  timeSec: number
}) {
  const [svgWidth, setSvgWidth] = useState(0)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const viewWidth = useRef(0)

  const plotW = DOT_VW - R_LABEL
  const dataMin = Math.min(...dots)
  const dataMax = Math.max(...dots)
  const range = dataMax - dataMin || 1
  const toY = (v: number) => DOT_Y + DOT_H - ((v - dataMin) / range) * DOT_H

  // bucket readings into range bars
  const bucket = Math.max(1, Math.ceil(dots.length / 80))
  const bars: [number, number][] = []
  for (let i = 0; i < dots.length; i += bucket) {
    const slice = dots.slice(i, i + bucket)
    bars.push([Math.min(...slice), Math.max(...slice)])
  }
  const m = bars.length
  const slotW = plotW / m
  const barW = Math.max(1.5, slotW * 0.6)
  const barCx = (i: number) => (i + 0.5) * slotW

  const tl = [0, Math.round(timeSec / 2), timeSec]
  const tlX = [0, plotW / 2, plotW]
  const tlAnchor = ['start', 'middle', 'end'] as const

  const setFromX = (locationX: number) => {
    const w = viewWidth.current
    if (!w) return
    // invert the preserveAspectRatio="meet" transform: content is uniformly
    // scaled and centered, so undo the scale + horizontal letterbox offset
    const scale = Math.min(w / DOT_VW, DOT_RENDER_H / DOT_VH)
    const offsetX = (w - DOT_VW * scale) / 2
    const vbX = (locationX - offsetX) / scale
    const idx = Math.max(0, Math.min(m - 1, Math.floor(vbX / slotW)))
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

  const activeX   = activeIdx !== null ? barCx(activeIdx) : null
  const activeLo  = activeIdx !== null ? bars[activeIdx][0] : null
  const activeHi  = activeIdx !== null ? bars[activeIdx][1] : null
  const FONT = 10
  const CHAR_W = FONT * 0.6          // monospace glyph advance
  const label = activeIdx !== null ? `${activeLo}–${activeHi} bpm` : ''
  const labelW = label.length * CHAR_W
  const PILL_W = labelW + 12         // pad label
  const PILL_H = 18
  const pillX  = activeX !== null ? Math.max(0, Math.min(activeX - PILL_W / 2, plotW - PILL_W)) : 0
  const pillY  = DOT_Y - 2
  // manual centering — textAnchor/dominantBaseline are ignored in this rn-svg build
  const textX  = pillX + (PILL_W - labelW) / 2
  const textY  = pillY + PILL_H / 2 + FONT * 0.34

  return (
    <View
      onLayout={e => {
        viewWidth.current = e.nativeEvent.layout.width
        setSvgWidth(e.nativeEvent.layout.width)
      }}
      {...panResponder.panHandlers}
    >
      {svgWidth > 0 && (
        <Svg viewBox={`0 0 ${DOT_VW} ${DOT_VH}`} width={svgWidth} height={DOT_RENDER_H}>
          {bars.map(([lo, hi], i) => (
            <Rect
              key={i}
              x={barCx(i) - barW / 2}
              y={toY(hi)}
              width={barW}
              height={Math.max(2, toY(lo) - toY(hi))}
              rx={barW / 2}
              fill={colors.hrLine}
              fillOpacity={activeIdx === null || activeIdx === i ? 0.9 : 0.3}
            />
          ))}

          {/* scrubber */}
          {activeIdx !== null && activeX !== null && (
            <>
              <Line
                x1={activeX} y1={DOT_Y} x2={activeX} y2={DOT_Y + DOT_H}
                stroke="white" strokeOpacity={0.25} strokeWidth={1}
              />
              <Rect x={pillX} y={pillY} width={PILL_W} height={PILL_H} rx={4} fill={colors.bgElevated} />
              <SvgText
                x={textX} y={textY}
                fill={colors.textPrimary} fontSize={FONT} fontFamily={fonts.mono}
              >
                {label}
              </SvgText>
            </>
          )}

          {/* right-side min/max aligned to actual data positions */}
          {activeIdx === null && (
            <>
              <SvgText x={DOT_VW - 2} y={toY(dataMax) + 4}
                textAnchor="end" fill={colors.textMuted} fontSize={9} fontFamily={fonts.mono}
              >
                {dataMax}
              </SvgText>
              <SvgText x={DOT_VW - 2} y={toY(dataMin) - 2}
                textAnchor="end" fill={colors.textMuted} fontSize={9} fontFamily={fonts.mono}
              >
                {dataMin}
              </SvgText>
            </>
          )}

          <Line x1={0} y1={DOT_Y + DOT_H + 6} x2={plotW} y2={DOT_Y + DOT_H + 6}
            stroke={colors.borderSubtle} strokeWidth={0.5} />
          {tl.map((t, i) => (
            <SvgText key={i} x={tlX[i]} y={DOT_VH - 2}
              fill={colors.textMuted} fontSize={9} fontFamily={fonts.mono}
              textAnchor={tlAnchor[i]}
            >
              {fmtElapsed(t)}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  )
}

const P_LABEL_W = 38
const P_BAR_Y   = 8
const P_BAR_H   = 78
const P_VW      = 300
const P_VH      = P_BAR_Y + P_BAR_H + 4

export function PaceBarsChart({ splits, avgPace, strokeColor, unit }: {
  splits: Split[]
  avgPace: number
  strokeColor: string
  unit: 'km' | 'mi'
}) {
  const [svgWidth, setSvgWidth] = useState(0)

  let prevKm = 0
  const paces = splits.map(s => {
    const segKm = s.km - prevKm
    prevKm = s.km
    return segKm > 0 ? s.timeSec / segKm : avgPace
  })

  const n = paces.length
  const minPace = Math.min(...paces)
  const maxPace = Math.max(...paces)
  const paceRange = maxPace - minPace || 1
  const barAreaW = P_VW - P_LABEL_W
  const slotW = barAreaW / n
  const barW = Math.max(2, slotW - 2)

  // faster pace (lower sec/km) = taller bar
  const toBarH = (p: number) => Math.max(2, ((maxPace - p) / paceRange) * P_BAR_H)
  const toY    = (p: number) => P_BAR_Y + P_BAR_H - toBarH(p)
  const avgY   = toY(avgPace)

  return (
    <View onLayout={e => setSvgWidth(e.nativeEvent.layout.width)}>
      {svgWidth > 0 && (
        <Svg viewBox={`0 0 ${P_VW} ${P_VH}`} width={svgWidth} height={95}>
          {paces.map((pace, i) => {
            const h = toBarH(pace)
            const opacity = n > 1 ? 0.35 + (i / (n - 1)) * 0.65 : 1
            return (
              <Rect
                key={i}
                x={P_LABEL_W + i * slotW + (slotW - barW) / 2}
                y={P_BAR_Y + P_BAR_H - h}
                width={barW}
                height={h}
                rx={2}
                fill={strokeColor}
                fillOpacity={opacity}
              />
            )
          })}

          {/* avg dashed line */}
          <Line
            x1={P_LABEL_W} y1={avgY} x2={P_VW} y2={avgY}
            stroke={strokeColor} strokeOpacity={0.5} strokeWidth={1}
            strokeDasharray="4 3"
          />

          {/* Y-axis: fastest at top, slowest at bottom */}
          <SvgText x={P_LABEL_W - 4} y={P_BAR_Y + 8}
            textAnchor="end" fill={colors.textMuted} fontSize={9} fontFamily={fonts.mono}>
            {fmtMMSS(minPace)}
          </SvgText>
          <SvgText x={P_LABEL_W - 4} y={P_BAR_Y + P_BAR_H}
            textAnchor="end" fill={colors.textMuted} fontSize={9} fontFamily={fonts.mono}>
            {fmtMMSS(maxPace)}
          </SvgText>
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
