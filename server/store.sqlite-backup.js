'use strict';
/**
 * Embedded SQL datastore using Node's built-in `node:sqlite` module — still
 * zero external npm dependencies, but a real database engine instead of a
 * single JSON file. Every insert/update/delete is now one atomic SQL
 * statement instead of a full-file rewrite, which is what makes this safe
 * to run as an actual system of record (a crash mid-write can no longer
 * corrupt the entire database, and concurrent requests no longer race on
 * one giant file).
 *
 * Data model: one row per record, keyed by (collection, id), with the
 * record itself kept as a JSON blob in `data`. This is deliberate: it keeps
 * every existing call site in routes.js / auth.js / seed.js working
 * completely unchanged (same all/find/insert/update/remove/nextNumber
 * function signatures as the old JSON-file version), while gaining real
 * transactions, indexes, and crash-safety from SQLite underneath. If the
 * department outgrows a single embedded database file, this `records`
 * table shape maps cleanly onto a Postgres table with a JSONB column —
 * see README "Path to production".
 *
 * Note: `node:sqlite` is an "experimental" Node API (stable behavior, but
 * the label hasn't been removed yet). You may see a one-line
 * "ExperimentalWarning: SQLite is an experimental feature" notice in the
 * terminal on startup — that's expected and harmless.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

// DATA_DIR can be overridden via env var so a hosting platform can point it
// at a persistent disk mount (e.g. Render/Railway volumes) instead of the
// project folder. Defaults to the same place the old db.json lived.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'legal-genie.sqlite');
const LEGACY_JSON_PATH = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

const isNewDb = !fs.existsSync(DB_PATH);
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    collection TEXT NOT NULL,
    id TEXT NOT NULL,
    data TEXT NOT NULL,
    createdAt TEXT,
    PRIMARY KEY (collection, id)
  );
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_records_collection ON records(collection);');
db.exec(`
  CREATE TABLE IF NOT EXISTS counters (
    seq TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 0
  );
`);

function uuid() {
  return crypto.randomUUID();
}

// One-time migration from the old single-JSON-file datastore, if this is a
// fresh SQLite file and a legacy db.json is sitting next to it. Non-
// destructive: the original file is renamed (not deleted) once migrated.
if (isNewDb && fs.existsSync(LEGACY_JSON_PATH)) {
  try {
    const legacy = JSON.parse(fs.readFileSync(LEGACY_JSON_PATH, 'utf8'));
    const insertStmt = db.prepare('INSERT OR REPLACE INTO records (collection, id, data, createdAt) VALUES (?, ?, ?, ?)');
    const counterStmt = db.prepare('INSERT OR REPLACE INTO counters (seq, value) VALUES (?, ?)');
    let migratedRows = 0;
    db.exec('BEGIN');
    for (const [collection, rows] of Object.entries(legacy)) {
      if (collection === 'counters') {
        for (const [seq, value] of Object.entries(rows || {})) counterStmt.run(seq, Number(value) || 0);
        continue;
      }
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (!row || !row.id) continue;
        insertStmt.run(collection, row.id, JSON.stringify(row), row.createdAt || null);
        migratedRows += 1;
      }
    }
    db.exec('COMMIT');
    fs.renameSync(LEGACY_JSON_PATH, `${LEGACY_JSON_PATH}.migrated-backup`);
    console.log(`Migrated ${migratedRows} existing record(s) from db.json into the new SQLite datastore (old file kept as db.json.migrated-backup).`);
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) { /* nothing to roll back */ }
    console.error('Could not migrate legacy data/db.json — starting with an empty database instead:', e.message);
  }
}

const COLLECTIONS = [
  'users', 'roles', 'departments', 'cases', 'caseNotes', 'contracts',
  'contractVersions', 'documents', 'tasks', 'approvals',
  'notifications', 'sessions',
];

// Generic helpers -----------------------------------------------------------
function all(collection) {
  const rows = db.prepare('SELECT data FROM records WHERE collection = ?').all(collection);
  return rows.map((r) => JSON.parse(r.data));
}

function find(collection, id) {
  const row = db.prepare('SELECT data FROM records WHERE collection = ? AND id = ?').get(collection, id);
  return row ? JSON.parse(row.data) : null;
}

function insert(collection, record) {
  const row = { id: uuid(), createdAt: new Date().toISOString(), ...record };
  db.prepare('INSERT INTO records (collection, id, data, createdAt) VALUES (?, ?, ?, ?)')
    .run(collection, row.id, JSON.stringify(row), row.createdAt);
  return row;
}

function update(collection, id, patch) {
  const existing = find(collection, id);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  db.prepare('UPDATE records SET data = ? WHERE collection = ? AND id = ?')
    .run(JSON.stringify(updated), collection, id);
  return updated;
}

function remove(collection, id) {
  const result = db.prepare('DELETE FROM records WHERE collection = ? AND id = ?').run(collection, id);
  return result.changes > 0;
}

function nextNumber(seq, prefix, pad = 4) {
  db.prepare(`
    INSERT INTO counters (seq, value) VALUES (?, 1)
    ON CONFLICT(seq) DO UPDATE SET value = value + 1
  `).run(seq);
  const row = db.prepare('SELECT value FROM counters WHERE seq = ?').get(seq);
  return `${prefix}-${String(row.value).padStart(pad, '0')}`;
}

// Kept only for backward compatibility with seed.js's startup guard
// (`if (store.load().users.length > 0) return;`). Everything else should
// use all/find/insert/update/remove above, which talk to SQLite directly.
function load() {
  const snapshot = {};
  for (const key of COLLECTIONS) snapshot[key] = all(key);
  return snapshot;
}

// SQLite commits every statement immediately (auto-commit mode outside an
// explicit transaction), so there is nothing to flush. Kept as a no-op so
// any old call site expecting this function to exist doesn't break.
function persist() {}

module.exports = { load, persist, all, find, insert, update, remove, uuid, nextNumber, DB_PATH };
