// viewBox 0 0 300 100, 10px top/bottom padding → 80px usable height
export function buildChartPaths(series: number[]): { area: string; line: string } {
  const n = series.length
  const min = Math.min(...series)
  const max = Math.max(...series)
  const range = max - min || 1
  const toX = (i: number) => (i / (n - 1)) * 300
  const toY = (v: number) => 100 - 10 - ((v - min) / range) * 80
  const pts = series.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
  return {
    area: `M ${toX(0).toFixed(1)},90 L ${pts.join(' L ')} L ${toX(n - 1).toFixed(1)},90 Z`,
    line: pts.join(' '),
  }
}
