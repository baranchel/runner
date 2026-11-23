// The phone's copy of the user's data + the outbox. Same column names as the cloud (supabase/schema.sql).
import * as SQLite from 'expo-sqlite'

export const db = SQLite.openDatabaseSync('chronodrom.db')

const VERSION = 7  // bump + add an `if (v < N)` block to change the schema later

const v = db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0
if (v < 1) {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS run_types (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, hue INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY, healthkit_uuid TEXT, type_id TEXT, name TEXT NOT NULL, date TEXT NOT NULL,
      started_at TEXT, calories INTEGER,
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
if (v >= 1 && v < 2) db.execSync('ALTER TABLE runs ADD COLUMN started_at TEXT;')
if (v >= 1 && v < 3) db.execSync(`ALTER TABLE runs ADD COLUMN calories INTEGER; PRAGMA user_version = ${VERSION};`)
if (v < 4) db.execSync(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY, unit TEXT, first_name TEXT, last_name TEXT, dob TEXT, sex TEXT,
    height_cm REAL, weight_kg REAL, resting_hr REAL, vo2max REAL, hr_max REAL,
    hr_max_manual INTEGER NOT NULL DEFAULT 0, updated_at TEXT
  );
  PRAGMA user_version = ${VERSION};
`)
// RA-9: HR histogram replaces stored zones; zone settings on the profile.
// A fresh install runs every block (v = 0), so the v1 tables get altered here too.
// One transaction: a failure part-way must not leave hr_hist added with user_version still 4 (crash on every launch).
if (v < 5) db.withTransactionSync(() => db.execSync(`
  ALTER TABLE runs ADD COLUMN hr_hist TEXT;
  ALTER TABLE runs DROP COLUMN zones;
  ALTER TABLE profiles ADD COLUMN zone_method TEXT;
  ALTER TABLE profiles ADD COLUMN lthr REAL;
  ALTER TABLE profiles ADD COLUMN zone_bounds TEXT;
  PRAGMA user_version = ${VERSION};
`))
// Real HR chart line (replaces the fake seeded one).
if (v < 6) db.execSync(`ALTER TABLE runs ADD COLUMN hr_curve TEXT; PRAGMA user_version = ${VERSION};`)
// RA-29: Insights hide/order choice (JSON text, like zone_bounds).
// Checks the real column, not only user_version: a dev phone can already be at v7 without it
// (a fast refresh mid-edit, another branch), and then every profile write fails with "no such column".
const hasColumn = (table: string, col: string) =>
  db.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`).some(c => c.name === col)
if (!hasColumn('profiles', 'insights_layout')) db.execSync('ALTER TABLE profiles ADD COLUMN insights_layout TEXT;')
if (v < 7) db.execSync(`PRAGMA user_version = ${VERSION};`)
