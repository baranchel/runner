// All local reads/writes. Every user change goes through writeChange (local row + outbox, one transaction).
import type { SQLiteBindValue } from 'expo-sqlite'
import { db } from './schema'
import { JSON_COLS, filterPulled, type RunRow } from './merge'
import type { ProfileRow } from '../utils/profile'

export type Table = 'runs' | 'run_types' | 'profiles'
export interface RunTypeRow { id: string; name: string; hue: number; deleted: number }
export interface PendingOp { seq: number; tbl: Table; row_id: string; kind: 'insert' | 'update'; patch: string }

const COLS: Record<Table, readonly string[]> = {
  runs: ['id', 'healthkit_uuid', 'type_id', 'name', 'date', 'started_at', 'distance_km', 'time_sec', 'avg_hr', 'max_hr',
    'min_hr', 'elev_gain', 'cadence', 'calories','source', 'notes', 'splits', 'segments', 'hr_hist', 'weather', 'edits', 'updated_at'],
  run_types: ['id', 'name', 'hue', 'deleted', 'updated_at'],
  profiles: ['id', 'unit', 'first_name', 'last_name', 'dob', 'sex', 'height_cm', 'weight_kg', 'resting_hr',
    'vo2max', 'hr_max', 'hr_max_manual', 'zone_method', 'lthr', 'zone_bounds', 'updated_at'],
}

// JS value → SQLite value: objects/arrays as JSON text, booleans as 0/1
function toSql(v: unknown): SQLiteBindValue {
  if (v === undefined || v === null) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'object') return JSON.stringify(v)
  return v as SQLiteBindValue
}

function parseRun(r: Record<string, unknown>): RunRow {
  const out: Record<string, unknown> = { ...r }
  for (const c of JSON_COLS) out[c] = r[c] == null ? (c === 'edits' ? {} : null) : JSON.parse(r[c] as string)
  return out as unknown as RunRow
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/** The signed-in user's profile (the phone holds one user's data), or null before the first pull. */
export function loadProfile(): ProfileRow | null {
  const r = db.getFirstSync<Record<string, unknown>>('SELECT * FROM profiles LIMIT 1')
  if (!r) return null
  return {
    ...r,
    hr_max_manual: r.hr_max_manual === 1,
    zone_bounds: r.zone_bounds == null ? null : JSON.parse(r.zone_bounds as string),
  } as unknown as ProfileRow
}

export const loadRuns = (): RunRow[] =>
  db.getAllSync<Record<string, unknown>>('SELECT * FROM runs ORDER BY date DESC, started_at DESC').map(parseRun)

export function getRunRow(id: string): RunRow | null {
  const r = db.getFirstSync<Record<string, unknown>>('SELECT * FROM runs WHERE id = ?', [id])
  return r ? parseRun(r) : null
}

export const loadRunTypes = (): RunTypeRow[] =>
  db.getAllSync<RunTypeRow>('SELECT * FROM run_types WHERE deleted = 0 ORDER BY hue')

// ─── Writes ──────────────────────────────────────────────────────────────────

/** Offline before the first pull there is no local profile row yet; an update needs one. The cloud row always exists (signup trigger). */
export const ensureProfileRow = (userId: string) =>
  db.runSync('INSERT OR IGNORE INTO profiles (id, unit) VALUES (?, \'km\')', [userId])

function upsertLocal(tbl: Table, row: Record<string, unknown>) {
  const cols = COLS[tbl].filter(c => c in row)  // drops cloud-only columns such as user_id
  db.runSync(
    `INSERT INTO ${tbl} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})
     ON CONFLICT(id) DO UPDATE SET ${cols.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`).join(',')}`,
    cols.map(c => toSql(row[c])),
  )
}

/**
 * A user change: update the local row and queue it for upload, atomically.
 * insert = add if missing (an existing row is left alone and nothing is queued);
 * update = set only the given columns.
 */
export function writeChange(tbl: Table, kind: 'insert' | 'update', row: { id: string } & Record<string, unknown>) {
  db.withTransactionSync(() => {
    if (kind === 'insert') {
      const cols = COLS[tbl].filter(c => c in row)
      const res = db.runSync(
        `INSERT OR IGNORE INTO ${tbl} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
        cols.map(c => toSql(row[c])),
      )
      if (res.changes === 0) return
    } else {
      const cols = COLS[tbl].filter(c => c !== 'id' && c in row)
      if (cols.length === 0) return
      db.runSync(`UPDATE ${tbl} SET ${cols.map(c => `${c} = ?`).join(',')} WHERE id = ?`,
        [...cols.map(c => toSql(row[c])), row.id])
    }
    db.runSync('INSERT INTO pending_ops (tbl, row_id, kind, patch) VALUES (?, ?, ?, ?)',
      [tbl, row.id, kind, JSON.stringify(row)])
  })
}

/**
 * Rows from the cloud. Rows with unsent local *updates* are skipped (local wins until pushed).
 * A pending *insert* for a row the cloud already has can never win (the push is ignored as a duplicate),
 * so the cloud row is applied and that insert op dropped.
 */
export function applyPulled(tbl: Table, rows: Record<string, unknown>[]) {
  const updating = new Set(pendingOps().filter(o => o.tbl === tbl && o.kind === 'update').map(o => o.row_id))
  db.withTransactionSync(() => {
    for (const r of filterPulled(rows as ({ id: string } & Record<string, unknown>)[], updating)) {
      upsertLocal(tbl, r)
      db.runSync("DELETE FROM pending_ops WHERE tbl = ? AND row_id = ? AND kind = 'insert'", [tbl, r.id])
    }
  })
}

// ─── Outbox ──────────────────────────────────────────────────────────────────

/** Ops still to send, oldest first. Failed ops (rejected by the server) are kept but skipped. */
export const pendingOps = (): PendingOp[] =>
  db.getAllSync<PendingOp>('SELECT seq, tbl, row_id, kind, patch FROM pending_ops WHERE failed = 0 ORDER BY seq')
export const pendingCount = () =>
  db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM pending_ops WHERE failed = 0')?.n ?? 0
export const deleteOp = (seq: number) => db.runSync('DELETE FROM pending_ops WHERE seq = ?', [seq])
export const markOpFailed = (seq: number) => db.runSync('UPDATE pending_ops SET failed = 1 WHERE seq = ?', [seq])

// ─── Meta (last pull time per table, owner of the local data) ────────────────

export const getMeta = (key: string) =>
  db.getFirstSync<{ value: string }>('SELECT value FROM sync_state WHERE key = ?', [key])?.value ?? null
export const setMeta = (key: string, value: string) =>
  db.runSync('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)', [key, value])

let epoch = 0
/** Bumped by clearAll(); a sync that started before a logout stops writing. */
export const getEpoch = () => epoch

/** Log out: the next user of this phone must see nothing of this one. */
export function clearAll() {
  epoch++
  db.execSync('DELETE FROM runs; DELETE FROM run_types; DELETE FROM profiles; DELETE FROM pending_ops; DELETE FROM sync_state;')
}
