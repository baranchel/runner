// The phone's copy of the user's data + the outbox. Same column names as the cloud (supabase/schema.sql).
import * as SQLite from 'expo-sqlite'

export const db = SQLite.openDatabaseSync('chronodrom.db')

const VERSION = 1  // bump + add an `if (v < N)` block to change the schema later

const v = db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0
if (v < 1) {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS run_types (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, hue INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY, healthkit_uuid TEXT, type_id TEXT, name TEXT NOT NULL, date TEXT NOT NULL,
      distance_km REAL NOT NULL, time_sec INTEGER NOT NULL,
      avg_hr INTEGER, max_hr INTEGER, min_hr INTEGER, elev_gain INTEGER, cadence INTEGER,
      source TEXT NOT NULL, notes TEXT,
      splits TEXT NOT NULL, segments TEXT, zones TEXT, weather TEXT, edits TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS pending_ops (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      tbl TEXT NOT NULL, row_id TEXT NOT NULL, kind TEXT NOT NULL, patch TEXT NOT NULL,
      failed INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sync_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    PRAGMA user_version = ${VERSION};
  `)
}
