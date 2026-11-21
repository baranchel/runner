// syncNow(): push the outbox, then pull what changed in the cloud. Safe to call any time, any number of times.
import { pullSince, pushOp } from '../api/sync'
import { applyPulled, deleteOp, getEpoch, getMeta, markOpFailed, pendingOps, setMeta, type Table } from './queries'

const TABLES: Table[] = ['profiles', 'run_types', 'runs']  // types before runs: runs point at them

const listeners = new Set<() => void>()
/** Called after a pull changed local data (stores reload). */
export function onPulled(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

let running: Promise<void> | null = null
let again = false

/** Single-flight: a call during a sync makes it run once more afterwards instead of in parallel. */
export function syncNow(): Promise<void> {
  if (running) { again = true; return running }
  running = (async () => {
    try { do { again = false; await syncOnce() } while (again) } catch (e) { console.warn('[sync] failed', e) }
  })().finally(() => { running = null })
  return running
}

// epoch: clearAll() (logout) bumps it; a sync that started earlier must not write into the next user's data.
async function syncOnce() {
  const start = getEpoch()
  for (const op of pendingOps()) {
    const res = await pushOp(op.tbl, op.kind, op.row_id, JSON.parse(op.patch))
    if (getEpoch() !== start) return
    if (res === 'retry') return  // offline or temporary: keep this op and the rest for next time
    if (res === 'ok') deleteOp(op.seq)
    else markOpFailed(op.seq)
  }

  let changed = false
  for (const tbl of TABLES) {
    const key = `pulled:${tbl}`
    const rows = await pullSince(tbl, getMeta(key))
    if (getEpoch() !== start) return
    if (!rows) return
    if (rows.length === 0) continue
    applyPulled(tbl, rows)
    setMeta(key, String(rows[rows.length - 1].updated_at))  // rows are ordered by updated_at
    changed = true
  }
  if (changed) listeners.forEach(cb => cb())
}
