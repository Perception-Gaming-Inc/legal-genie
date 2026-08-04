'use strict';
/**
 * Supabase (hosted Postgres) datastore, for the Vercel + Supabase deployment
 * path — see the Go-Live Guide. Talks to Supabase over the network via
 * @supabase/supabase-js, so every function here is async (unlike the
 * previous SQLite version, which was synchronous local-disk access). That
 * is the one change that ripples through the rest of the backend: every
 * call site in routes.js / auth.js / seed.js now needs `await`.
 *
 * Data model: one row per record, keyed by (collection, id), with the
 * record itself kept as a JSONB blob in `data`. Same reasoning as the
 * SQLite version had — this keeps the JS-level shape of every record
 * identical to what routes.js / auth.js / seed.js already expect, so the
 * only real change needed elsewhere is adding `await`, not restructuring
 * data access. Run the SQL in `supabase-schema.sql` (in this folder) once,
 * in your Supabase project's SQL editor, before first boot.
 *
 * If you deploy this on Render instead (see server/store.sqlite-backup.js
 * and the Go-Live Guide's earlier Render path), swap this file back for
 * that one — routes.js/auth.js/seed.js don't need to change either way,
 * since both versions expose the same function names, just sync vs async.
 */
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables. ' +
    'Set them in your Vercel project settings — see the Go-Live Guide.'
  );
}

// The service role key is used deliberately (not the public anon key): this
// app's own routes.js already enforces all permission checks server-side,
// so Supabase Row Level Security would just be redundant here. This key
// must only ever be set as a server-side environment variable — never sent
// to the browser or committed to source control.
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function uuid() {
  return crypto.randomUUID();
}

async function all(collection) {
  const { data, error } = await supabase.from('records').select('data').eq('collection', collection);
  if (error) throw new Error(`store.all(${collection}): ${error.message}`);
  return data.map((row) => row.data);
}

async function find(collection, id) {
  const { data, error } = await supabase
    .from('records').select('data').eq('collection', collection).eq('id', id).maybeSingle();
  if (error) throw new Error(`store.find(${collection}, ${id}): ${error.message}`);
  return data ? data.data : null;
}

async function insert(collection, record) {
  const row = { id: uuid(), createdAt: new Date().toISOString(), ...record };
  const { error } = await supabase.from('records').insert({
    collection, id: row.id, data: row, created_at: row.createdAt,
  });
  if (error) throw new Error(`store.insert(${collection}): ${error.message}`);
  return row;
}

async function update(collection, id, patch) {
  const existing = await find(collection, id);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  const { error } = await supabase
    .from('records').update({ data: updated }).eq('collection', collection).eq('id', id);
  if (error) throw new Error(`store.update(${collection}, ${id}): ${error.message}`);
  return updated;
}

async function remove(collection, id) {
  const { error, count } = await supabase
    .from('records').delete({ count: 'exact' }).eq('collection', collection).eq('id', id);
  if (error) throw new Error(`store.remove(${collection}, ${id}): ${error.message}`);
  return (count || 0) > 0;
}

// Atomic increment via a small Postgres function (increment_counter, defined
// in supabase-schema.sql) — a plain upsert() from the JS client can't
// express "set value = value + 1", only "replace with this literal value",
// which would race under concurrent requests. The RPC call keeps the
// increment atomic on the database side, same guarantee the SQLite version
// got from a single `ON CONFLICT ... DO UPDATE SET value = value + 1`.
async function nextNumber(seq, prefix, pad = 4) {
  const { data, error } = await supabase.rpc('increment_counter', { seq_name: seq });
  if (error) throw new Error(`store.nextNumber(${seq}): ${error.message}`);
  return `${prefix}-${String(data).padStart(pad, '0')}`;
}

const COLLECTIONS = [
  'users', 'roles', 'departments', 'cases', 'caseNotes', 'contracts',
  'contractVersions', 'compliance', 'documents', 'tasks', 'approvals',
  'notifications', 'sessions',
];

// Kept only for backward compatibility with seed.js's startup guard
// (`if ((await store.load()).users.length > 0) return;`).
async function load() {
  const snapshot = {};
  for (const key of COLLECTIONS) snapshot[key] = await all(key);
  return snapshot;
}

// Supabase commits each request as its own transaction server-side, so
// there is nothing to flush from here. Kept as a no-op for compatibility.
function persist() {}

module.exports = { load, persist, all, find, insert, update, remove, uuid, nextNumber };
