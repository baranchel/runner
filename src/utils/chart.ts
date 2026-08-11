function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h >>> 0
}

function makeLcg(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

export function genSeries(
  seedKey: string,
  n: number,
  base: number,
  variance: number,
  driftTotal: number,
): number[] {
  const rand = makeLcg(hashStr(seedKey))
  const drift = driftTotal / n
  const series: number[] = []
  let v = base - driftTotal / 2
  for (let i = 0; i < n; i++) {
    v += drift + (rand() - 0.5) * variance * 2
    series.push(v)
  }
  return series
}

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

// ponytail: remove before prod — dev-only determinism check
if (__DEV__) {
  const s = genSeries('test', 4, 100, 5, 0)
  const same = genSeries('test', 4, 100, 5, 0)
  if (s.join() !== same.join()) throw new Error('genSeries is not deterministic')
}
