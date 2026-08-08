import type { Run, RunType } from './types'

// ─── Run Types ───────────────────────────────────────────────────────────────

export const MOCK_RUN_TYPES: RunType[] = [
  { id: 'easy',     name: 'Easy Run',  hue: 155 },
  { id: 'long',     name: 'Long Run',  hue: 225 },
  { id: 'tempo',    name: 'Tempo',     hue: 55  },
  { id: 'interval', name: 'Intervals', hue: 300 },
]

// ─── Runs ─────────────────────────────────────────────────────────────────────
//
// Long run progression: 7 → 9 → 11 → 11 → 13 → 15 km (Jul–Aug)
//
// Identical-structure pairs (same distance + layout, different performance):
//   run-05 vs run-08  — both 8×400m interval, 8.0 km  (run-05 faster)
//   run-06 vs run-09  — both long 11.0 km              (run-09 faster)

export const MOCK_RUNS: Run[] = [

  // ── July ──────────────────────────────────────────────────────────────────

  {
    id: 'run-01',
    healthkitUuid: 'hk-00000000-0001-4000-8000-000000000001',
    typeId: 'easy',
    name: 'Easy Run: 6.0km',
    date: '2026-07-01',
    distanceKm: 6.0,
    timeSec: 2280,   // 38:00 · 6:20/km
    avgHr: 134, maxHr: 152, elevGain: 42, cadence: 168,
    source: 'apple_health',
    notes: null,
    segments: null,
    splits: [
      { km: 1, timeSec: 383, avgHr: 130 },
      { km: 2, timeSec: 378, avgHr: 132 },
      { km: 3, timeSec: 380, avgHr: 134 },
      { km: 4, timeSec: 382, avgHr: 135 },
      { km: 5, timeSec: 377, avgHr: 136 },
      { km: 6, timeSec: 380, avgHr: 137 },
    ],
  },

  {
    id: 'run-02',
    healthkitUuid: 'hk-00000000-0002-4000-8000-000000000002',
    typeId: 'long',
    name: 'Long Run: 7.0km',
    date: '2026-07-06',
    distanceKm: 7.0,
    timeSec: 2870,   // 47:50 · 6:50/km — progression #1
    avgHr: 140, maxHr: 161, elevGain: 78, cadence: 166,
    source: 'apple_health',
    notes: null,
    segments: null,
    splits: [
      { km: 1, timeSec: 408, avgHr: 136 },
      { km: 2, timeSec: 412, avgHr: 138 },
      { km: 3, timeSec: 408, avgHr: 139 },
      { km: 4, timeSec: 412, avgHr: 140 },
      { km: 5, timeSec: 412, avgHr: 142 },
      { km: 6, timeSec: 408, avgHr: 143 },
      { km: 7, timeSec: 410, avgHr: 144 },
    ],
  },

  {
    id: 'run-03',
    healthkitUuid: 'hk-00000000-0003-4000-8000-000000000003',
    typeId: 'tempo',
    name: 'Tempo: 9.0km',
    date: '2026-07-09',
    distanceKm: 9.0,
    timeSec: 2820,   // 47:00 · 2km warmup + 6km @4:45/km + 1km cooldown
    avgHr: 150, maxHr: 173, elevGain: 55, cadence: 174,
    source: 'apple_health',
    notes: '2km warmup · 6km @4:45/km · 1km cooldown',
    segments: [
      { type: 'warmup',   label: 'Warmup',   distanceKm: 2.0, timeSec:  720, avgHr: 132 },
      { type: 'main',     label: 'Tempo',    distanceKm: 6.0, timeSec: 1710, avgHr: 162 },
      { type: 'cooldown', label: 'Cooldown', distanceKm: 1.0, timeSec:  390, avgHr: 128 },
    ],
    // dist: 9.0km ✓  time: 720+1710+390=2820s ✓
    splits: [
      { km: 1, timeSec: 360, avgHr: 130 },
      { km: 2, timeSec: 360, avgHr: 132 },
      { km: 3, timeSec: 285, avgHr: 158 },
      { km: 4, timeSec: 283, avgHr: 161 },
      { km: 5, timeSec: 285, avgHr: 163 },
      { km: 6, timeSec: 285, avgHr: 164 },
      { km: 7, timeSec: 285, avgHr: 163 },
      { km: 8, timeSec: 285, avgHr: 162 },
      { km: 9, timeSec: 392, avgHr: 130 },
    ],
  },

  {
    id: 'run-04',
    healthkitUuid: 'hk-00000000-0004-4000-8000-000000000004',
    typeId: 'long',
    name: 'Long Run: 9.0km',
    date: '2026-07-13',
    distanceKm: 9.0,
    timeSec: 3690,   // 61:30 · 6:50/km — progression #2
    avgHr: 142, maxHr: 163, elevGain: 92, cadence: 165,
    source: 'apple_health',
    notes: null,
    segments: null,
    splits: [
      { km: 1, timeSec: 408, avgHr: 137 },
      { km: 2, timeSec: 412, avgHr: 139 },
      { km: 3, timeSec: 410, avgHr: 140 },
      { km: 4, timeSec: 408, avgHr: 141 },
      { km: 5, timeSec: 412, avgHr: 143 },
      { km: 6, timeSec: 410, avgHr: 144 },
      { km: 7, timeSec: 410, avgHr: 145 },
      { km: 8, timeSec: 408, avgHr: 146 },
      { km: 9, timeSec: 412, avgHr: 147 },
    ],
  },

  {
    // Identical structure to run-08 (8×400m, 8.0km) — this session was faster
    id: 'run-05',
    healthkitUuid: 'hk-00000000-0005-4000-8000-000000000005',
    typeId: 'interval',
    name: 'Intervals: 8.0km',
    date: '2026-07-16',
    distanceKm: 8.0,
    timeSec: 2748,   // 45:48 · reps @92s each
    avgHr: 148, maxHr: 183, elevGain: 58, cadence: 177,
    source: 'apple_health',
    notes: '2km warmup · 8×400m (92s rep / 90s rest) · 1.6km cooldown',
    segments: [
      { type: 'warmup',   label: 'Warmup',   distanceKm: 2.00, timeSec: 700, avgHr: 129 },
      { type: 'rep',      label: 'Rep 1',    distanceKm: 0.40, timeSec:  92, avgHr: 176 },
      { type: 'rest',     label: 'Rest 1',   distanceKm: 0.15, timeSec:  90, avgHr: 151 },
      { type: 'rep',      label: 'Rep 2',    distanceKm: 0.40, timeSec:  92, avgHr: 177 },
      { type: 'rest',     label: 'Rest 2',   distanceKm: 0.15, timeSec:  90, avgHr: 152 },
      { type: 'rep',      label: 'Rep 3',    distanceKm: 0.40, timeSec:  92, avgHr: 179 },
      { type: 'rest',     label: 'Rest 3',   distanceKm: 0.15, timeSec:  90, avgHr: 153 },
      { type: 'rep',      label: 'Rep 4',    distanceKm: 0.40, timeSec:  92, avgHr: 180 },
      { type: 'rest',     label: 'Rest 4',   distanceKm: 0.15, timeSec:  90, avgHr: 154 },
      { type: 'rep',      label: 'Rep 5',    distanceKm: 0.40, timeSec:  92, avgHr: 181 },
      { type: 'rest',     label: 'Rest 5',   distanceKm: 0.15, timeSec:  90, avgHr: 155 },
      { type: 'rep',      label: 'Rep 6',    distanceKm: 0.40, timeSec:  92, avgHr: 181 },
      { type: 'rest',     label: 'Rest 6',   distanceKm: 0.15, timeSec:  90, avgHr: 154 },
      { type: 'rep',      label: 'Rep 7',    distanceKm: 0.40, timeSec:  92, avgHr: 182 },
      { type: 'rest',     label: 'Rest 7',   distanceKm: 0.15, timeSec:  90, avgHr: 155 },
      { type: 'rep',      label: 'Rep 8',    distanceKm: 0.40, timeSec:  92, avgHr: 181 },
      { type: 'rest',     label: 'Rest 8',   distanceKm: 0.15, timeSec:  90, avgHr: 154 },
      { type: 'cooldown', label: 'Cooldown', distanceKm: 1.60, timeSec: 592, avgHr: 125 },
    ],
    // dist: 2.0 + 8×(0.4+0.15) + 1.6 = 8.0km ✓  time: 700+8×92+8×90+592=2748s ✓
    splits: [
      { km: 1, timeSec: 375, avgHr: 129 },
      { km: 2, timeSec: 373, avgHr: 131 },
      { km: 3, timeSec: 315, avgHr: 163 },
      { km: 4, timeSec: 312, avgHr: 166 },
      { km: 5, timeSec: 310, avgHr: 167 },
      { km: 6, timeSec: 312, avgHr: 165 },
      { km: 7, timeSec: 378, avgHr: 131 },
      { km: 8, timeSec: 373, avgHr: 127 },
    ],
  },

  {
    // Identical structure to run-09 (long 11.0km) — slower session, heavier legs
    id: 'run-06',
    healthkitUuid: 'hk-00000000-0006-4000-8000-000000000006',
    typeId: 'long',
    name: 'Long Run: 11.0km',
    date: '2026-07-20',
    distanceKm: 11.0,
    timeSec: 4565,   // 76:05 · ~6:57/km — progression #3
    avgHr: 145, maxHr: 169, elevGain: 118, cadence: 165,
    source: 'apple_health',
    notes: null,
    segments: null,
    splits: [
      { km:  1, timeSec: 412, avgHr: 140 },
      { km:  2, timeSec: 418, avgHr: 141 },
      { km:  3, timeSec: 415, avgHr: 142 },
      { km:  4, timeSec: 412, avgHr: 143 },
      { km:  5, timeSec: 418, avgHr: 144 },
      { km:  6, timeSec: 415, avgHr: 145 },
      { km:  7, timeSec: 416, avgHr: 146 },
      { km:  8, timeSec: 412, avgHr: 147 },
      { km:  9, timeSec: 418, avgHr: 148 },
      { km: 10, timeSec: 415, avgHr: 149 },
      { km: 11, timeSec: 414, avgHr: 150 },
    ],
  },

  {
    id: 'run-07',
    healthkitUuid: 'hk-00000000-0007-4000-8000-000000000007',
    typeId: 'easy',
    name: 'Easy Run: 5.5km',
    date: '2026-07-23',
    distanceKm: 5.5,
    timeSec: 2090,   // 34:50 · 6:20/km
    avgHr: 131, maxHr: 149, elevGain: 32, cadence: 167,
    source: 'apple_health',
    notes: null,
    segments: null,
    splits: [
      { km:  1,  timeSec: 380, avgHr: 128 },
      { km:  2,  timeSec: 382, avgHr: 130 },
      { km:  3,  timeSec: 378, avgHr: 131 },
      { km:  4,  timeSec: 380, avgHr: 132 },
      { km:  5,  timeSec: 382, avgHr: 133 },
      { km:  5.5, timeSec: 188, avgHr: 132 },
    ],
  },

  {
    // Identical structure to run-05 (8×400m, 8.0km) — off day, reps slower
    id: 'run-08',
    healthkitUuid: 'hk-00000000-0008-4000-8000-000000000008',
    typeId: 'interval',
    name: 'Intervals: 8.0km',
    date: '2026-07-25',
    distanceKm: 8.0,
    timeSec: 2870,   // 47:50 · reps @100s each
    avgHr: 151, maxHr: 186, elevGain: 61, cadence: 174,
    source: 'apple_health',
    notes: '2km warmup · 8×400m (100s rep / 90s rest) · 1.6km cooldown',
    segments: [
      { type: 'warmup',   label: 'Warmup',   distanceKm: 2.00, timeSec: 730, avgHr: 131 },
      { type: 'rep',      label: 'Rep 1',    distanceKm: 0.40, timeSec: 100, avgHr: 178 },
      { type: 'rest',     label: 'Rest 1',   distanceKm: 0.15, timeSec:  90, avgHr: 153 },
      { type: 'rep',      label: 'Rep 2',    distanceKm: 0.40, timeSec: 100, avgHr: 179 },
      { type: 'rest',     label: 'Rest 2',   distanceKm: 0.15, timeSec:  90, avgHr: 154 },
      { type: 'rep',      label: 'Rep 3',    distanceKm: 0.40, timeSec: 100, avgHr: 181 },
      { type: 'rest',     label: 'Rest 3',   distanceKm: 0.15, timeSec:  90, avgHr: 155 },
      { type: 'rep',      label: 'Rep 4',    distanceKm: 0.40, timeSec: 100, avgHr: 182 },
      { type: 'rest',     label: 'Rest 4',   distanceKm: 0.15, timeSec:  90, avgHr: 156 },
      { type: 'rep',      label: 'Rep 5',    distanceKm: 0.40, timeSec: 100, avgHr: 183 },
      { type: 'rest',     label: 'Rest 5',   distanceKm: 0.15, timeSec:  90, avgHr: 157 },
      { type: 'rep',      label: 'Rep 6',    distanceKm: 0.40, timeSec: 100, avgHr: 183 },
      { type: 'rest',     label: 'Rest 6',   distanceKm: 0.15, timeSec:  90, avgHr: 157 },
      { type: 'rep',      label: 'Rep 7',    distanceKm: 0.40, timeSec: 100, avgHr: 184 },
      { type: 'rest',     label: 'Rest 7',   distanceKm: 0.15, timeSec:  90, avgHr: 158 },
      { type: 'rep',      label: 'Rep 8',    distanceKm: 0.40, timeSec: 100, avgHr: 183 },
      { type: 'rest',     label: 'Rest 8',   distanceKm: 0.15, timeSec:  90, avgHr: 157 },
      { type: 'cooldown', label: 'Cooldown', distanceKm: 1.60, timeSec: 620, avgHr: 128 },
    ],
    // dist: 2.0 + 8×(0.4+0.15) + 1.6 = 8.0km ✓  time: 730+8×100+8×90+620=2870s ✓
    splits: [
      { km: 1, timeSec: 380, avgHr: 131 },
      { km: 2, timeSec: 378, avgHr: 132 },
      { km: 3, timeSec: 330, avgHr: 166 },
      { km: 4, timeSec: 328, avgHr: 168 },
      { km: 5, timeSec: 326, avgHr: 169 },
      { km: 6, timeSec: 328, avgHr: 167 },
      { km: 7, timeSec: 398, avgHr: 133 },
      { km: 8, timeSec: 402, avgHr: 130 },
    ],
  },

  {
    // Identical structure to run-06 (long 11.0km) — fresher legs, faster pace
    id: 'run-09',
    healthkitUuid: 'hk-00000000-0009-4000-8000-000000000009',
    typeId: 'long',
    name: 'Long Run: 11.0km',
    date: '2026-07-27',
    distanceKm: 11.0,
    timeSec: 4455,   // 74:15 · ~6:44/km — progression #4 (same route, better day)
    avgHr: 141, maxHr: 165, elevGain: 112, cadence: 167,
    source: 'apple_health',
    notes: null,
    segments: null,
    splits: [
      { km:  1, timeSec: 403, avgHr: 136 },
      { km:  2, timeSec: 407, avgHr: 137 },
      { km:  3, timeSec: 405, avgHr: 138 },
      { km:  4, timeSec: 403, avgHr: 139 },
      { km:  5, timeSec: 407, avgHr: 140 },
      { km:  6, timeSec: 405, avgHr: 141 },
      { km:  7, timeSec: 407, avgHr: 142 },
      { km:  8, timeSec: 403, avgHr: 143 },
      { km:  9, timeSec: 405, avgHr: 144 },
      { km: 10, timeSec: 407, avgHr: 145 },
      { km: 11, timeSec: 403, avgHr: 146 },
    ],
  },

  {
    id: 'run-10',
    healthkitUuid: 'hk-00000000-0010-4000-8000-000000000010',
    typeId: 'tempo',
    name: 'Tempo: 8.0km',
    date: '2026-07-30',
    distanceKm: 8.0,
    timeSec: 2498,   // 41:38 · 1.5km warmup + 5.5km @4:45/km + 1km cooldown
    avgHr: 151, maxHr: 174, elevGain: 48, cadence: 175,
    source: 'apple_health',
    notes: '1.5km warmup · 5.5km @4:45/km · 1km cooldown',
    segments: [
      { type: 'warmup',   label: 'Warmup',   distanceKm: 1.5, timeSec:  540, avgHr: 132 },
      { type: 'main',     label: 'Tempo',    distanceKm: 5.5, timeSec: 1567, avgHr: 163 },
      { type: 'cooldown', label: 'Cooldown', distanceKm: 1.0, timeSec:  391, avgHr: 128 },
    ],
    // dist: 8.0km ✓  time: 540+1567+391=2498s ✓
    splits: [
      { km: 1, timeSec: 360, avgHr: 130 },
      { km: 2, timeSec: 323, avgHr: 148 },  // 0.5km warmup + 0.5km tempo
      { km: 3, timeSec: 285, avgHr: 160 },
      { km: 4, timeSec: 285, avgHr: 163 },
      { km: 5, timeSec: 285, avgHr: 165 },
      { km: 6, timeSec: 285, avgHr: 164 },
      { km: 7, timeSec: 285, avgHr: 162 },
      { km: 8, timeSec: 390, avgHr: 129 },
    ],
  },

  // ── August ────────────────────────────────────────────────────────────────

  {
    id: 'run-11',
    healthkitUuid: 'hk-00000000-0011-4000-8000-000000000011',
    typeId: 'long',
    name: 'Long Run: 13.0km',
    date: '2026-08-03',
    distanceKm: 13.0,
    timeSec: 5330,   // 88:50 · ~6:50/km — progression #5
    avgHr: 146, maxHr: 170, elevGain: 138, cadence: 165,
    source: 'apple_health',
    notes: null,
    segments: null,
    splits: [
      { km:  1, timeSec: 410, avgHr: 140 },
      { km:  2, timeSec: 408, avgHr: 141 },
      { km:  3, timeSec: 412, avgHr: 142 },
      { km:  4, timeSec: 410, avgHr: 143 },
      { km:  5, timeSec: 408, avgHr: 144 },
      { km:  6, timeSec: 412, avgHr: 145 },
      { km:  7, timeSec: 410, avgHr: 146 },
      { km:  8, timeSec: 408, avgHr: 147 },
      { km:  9, timeSec: 412, avgHr: 148 },
      { km: 10, timeSec: 410, avgHr: 150 },
      { km: 11, timeSec: 408, avgHr: 151 },
      { km: 12, timeSec: 412, avgHr: 152 },
      { km: 13, timeSec: 410, avgHr: 153 },
    ],
  },

  {
    id: 'run-12',
    healthkitUuid: 'hk-00000000-0012-4000-8000-000000000012',
    typeId: 'easy',
    name: 'Easy Run: 6.5km',
    date: '2026-08-10',
    distanceKm: 6.5,
    timeSec: 2470,   // 41:10 · 6:20/km
    avgHr: 133, maxHr: 150, elevGain: 38, cadence: 168,
    source: 'apple_health',
    notes: null,
    segments: null,
    splits: [
      { km:  1,  timeSec: 380, avgHr: 129 },
      { km:  2,  timeSec: 378, avgHr: 131 },
      { km:  3,  timeSec: 382, avgHr: 133 },
      { km:  4,  timeSec: 380, avgHr: 134 },
      { km:  5,  timeSec: 378, avgHr: 135 },
      { km:  6,  timeSec: 382, avgHr: 135 },
      { km:  6.5, timeSec: 190, avgHr: 134 },
    ],
  },

  {
    id: 'run-13',
    healthkitUuid: 'hk-00000000-0013-4000-8000-000000000013',
    typeId: 'long',
    name: 'Long Run: 15.0km',
    date: '2026-08-17',
    distanceKm: 15.0,
    timeSec: 6150,   // 102:30 · ~6:50/km — progression #6
    avgHr: 148, maxHr: 173, elevGain: 158, cadence: 164,
    source: 'apple_health',
    notes: null,
    segments: null,
    splits: [
      { km:  1, timeSec: 408, avgHr: 141 },
      { km:  2, timeSec: 410, avgHr: 142 },
      { km:  3, timeSec: 412, avgHr: 143 },
      { km:  4, timeSec: 408, avgHr: 144 },
      { km:  5, timeSec: 410, avgHr: 145 },
      { km:  6, timeSec: 412, avgHr: 146 },
      { km:  7, timeSec: 408, avgHr: 147 },
      { km:  8, timeSec: 410, avgHr: 148 },
      { km:  9, timeSec: 412, avgHr: 149 },
      { km: 10, timeSec: 408, avgHr: 151 },
      { km: 11, timeSec: 410, avgHr: 152 },
      { km: 12, timeSec: 412, avgHr: 153 },
      { km: 13, timeSec: 408, avgHr: 154 },
      { km: 14, timeSec: 410, avgHr: 155 },
      { km: 15, timeSec: 412, avgHr: 157 },
    ],
  },

  {
    id: 'run-14',
    healthkitUuid: 'hk-00000000-0014-4000-8000-000000000014',
    typeId: 'interval',
    name: 'Intervals: 10.0km',
    date: '2026-08-24',
    distanceKm: 10.0,
    timeSec: 3520,   // 58:40 · 2km warmup + 10×400m + 2.5km cooldown
    avgHr: 149, maxHr: 187, elevGain: 72, cadence: 176,
    source: 'apple_health',
    notes: '2km warmup · 10×400m (96s rep / 90s rest) · 2.5km cooldown',
    segments: [
      { type: 'warmup',   label: 'Warmup',   distanceKm: 2.00, timeSec: 720, avgHr: 131 },
      { type: 'rep',      label: 'Rep 1',    distanceKm: 0.40, timeSec:  96, avgHr: 174 },
      { type: 'rest',     label: 'Rest 1',   distanceKm: 0.15, timeSec:  90, avgHr: 147 },
      { type: 'rep',      label: 'Rep 2',    distanceKm: 0.40, timeSec:  96, avgHr: 176 },
      { type: 'rest',     label: 'Rest 2',   distanceKm: 0.15, timeSec:  90, avgHr: 149 },
      { type: 'rep',      label: 'Rep 3',    distanceKm: 0.40, timeSec:  96, avgHr: 177 },
      { type: 'rest',     label: 'Rest 3',   distanceKm: 0.15, timeSec:  90, avgHr: 150 },
      { type: 'rep',      label: 'Rep 4',    distanceKm: 0.40, timeSec:  96, avgHr: 179 },
      { type: 'rest',     label: 'Rest 4',   distanceKm: 0.15, timeSec:  90, avgHr: 151 },
      { type: 'rep',      label: 'Rep 5',    distanceKm: 0.40, timeSec:  96, avgHr: 180 },
      { type: 'rest',     label: 'Rest 5',   distanceKm: 0.15, timeSec:  90, avgHr: 152 },
      { type: 'rep',      label: 'Rep 6',    distanceKm: 0.40, timeSec:  96, avgHr: 180 },
      { type: 'rest',     label: 'Rest 6',   distanceKm: 0.15, timeSec:  90, avgHr: 151 },
      { type: 'rep',      label: 'Rep 7',    distanceKm: 0.40, timeSec:  96, avgHr: 181 },
      { type: 'rest',     label: 'Rest 7',   distanceKm: 0.15, timeSec:  90, avgHr: 152 },
      { type: 'rep',      label: 'Rep 8',    distanceKm: 0.40, timeSec:  96, avgHr: 182 },
      { type: 'rest',     label: 'Rest 8',   distanceKm: 0.15, timeSec:  90, avgHr: 152 },
      { type: 'rep',      label: 'Rep 9',    distanceKm: 0.40, timeSec:  96, avgHr: 183 },
      { type: 'rest',     label: 'Rest 9',   distanceKm: 0.15, timeSec:  90, avgHr: 151 },
      { type: 'rep',      label: 'Rep 10',   distanceKm: 0.40, timeSec:  96, avgHr: 182 },
      { type: 'rest',     label: 'Rest 10',  distanceKm: 0.15, timeSec:  90, avgHr: 150 },
      { type: 'cooldown', label: 'Cooldown', distanceKm: 2.50, timeSec: 940, avgHr: 128 },
    ],
    // dist: 2.0 + 10×(0.4+0.15) + 2.5 = 10.0km ✓  time: 720+10×186+940=3520s ✓
    splits: [
      { km:  1, timeSec: 360, avgHr: 131 },
      { km:  2, timeSec: 360, avgHr: 132 },
      { km:  3, timeSec: 342, avgHr: 166 },
      { km:  4, timeSec: 340, avgHr: 169 },
      { km:  5, timeSec: 338, avgHr: 170 },
      { km:  6, timeSec: 336, avgHr: 171 },
      { km:  7, timeSec: 336, avgHr: 169 },
      { km:  8, timeSec: 357, avgHr: 148 },  // rep zone ends ~7.5km, cooldown begins
      { km:  9, timeSec: 376, avgHr: 130 },
      { km: 10, timeSec: 375, avgHr: 128 },
    ],
  },
]
