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
const crypto = require('crypto');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Local/offline testing (see local-mock/README.md) sets SUPABASE_URL to this
// exact sentinel value and expects @supabase/supabase-js to resolve to the
// in-memory fake package under local-mock/node_modules instead of the real
// one. Originally this relied on NODE_PATH putting local-mock/node_modules
// ahead of the real node_modules — but Node's module resolution actually
// checks the ordinary node_modules folder tree *before* ever consulting
// NODE_PATH, so once `npm install` has installed the real
// @supabase/supabase-js (which it always will, since it's a normal
// dependency in package.json), the real package wins regardless of
// NODE_PATH, and this would try to make a real network call to the fake
// "http://local-mock" host and fail. Requiring the mock by its exact path
// here, only when that sentinel URL is set, sidesteps resolution order
// entirely. In production this branch never triggers (no real Supabase
// project is ever actually at that URL), and the local-mock folder doesn't
// exist in the deployed source anyway.
const { createClient } = SUPABASE_URL === 'http://local-mock'
  ? require(path.join(__dirname, '..', 'local-mock', 'node_modules', '@supabase', 'supabase-js'))
  : require('@supabase/supabase-js');

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

// Supabase/PostgREST caps how many rows a single select returns (the
// project's "Max Rows" setting, 1000 by default) — a plain `.select()` with
// no .range() silently returns just the first page once a collection grows
// past that cap, with no error, which every caller here (case/document
// lists, dashboard, login's user lookup, session lookup) assumed could
// never happen. Paginates internally instead, so every existing caller
// keeps working unchanged and genuinely gets everything. .order('id') gives
// a stable cursor across pages — pagination without an explicit order isn't
// guaranteed stable in Postgres if rows are being written concurrently.
const PAGE_SIZE = 1000;
async function all(collection) {
  const out = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('records').select('data').eq('collection', collection)
      .order('id').range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`store.all(${collection}): ${error.message}`);
    out.push(...data.map((row) => row.data));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

async function find(collection, id) {
  const { data, error } = await supabase
    .from('records').select('data').eq('collection', collection).eq('id', id).maybeSingle();
  if (error) throw new Error(`store.find(${collection}, ${id}): ${error.message}`);
  return data ? data.data : null;
}

async function insert(collection, record) {
  const row = { id: uuid(), createdAt: new Date().toISOString(), ...record };
  // version: 1 — see update()'s comment below for why this exists. Every
  // record starts at version 1; requires the `version` column added by the
  // migration in supabase-schema.sql.
  const { error } = await supabase.from('records').insert({
    collection, id: row.id, data: row, created_at: row.createdAt, version: 1,
  });
  if (error) throw new Error(`store.insert(${collection}): ${error.message}`);
  return row;
}

// Optimistic-locking update, replacing what used to be a plain
// read-modify-write: read the row, merge the patch in JS, write the whole
// merged object back. That pattern has a real lost-update race — two
// concurrent updates to the SAME record both read the same starting
// snapshot, and whichever write lands second silently overwrites the
// first's change (e.g. two admins each save a different Settings tab at
// nearly the same time; the second save's merge is based on stale data, so
// it silently reverts the first admin's change even though both requests
// return success).
//
// Fixed here using a `version` integer column (see supabase-schema.sql):
// the UPDATE is conditioned on `.eq('version', currentVersion)` in the same
// atomic statement as the write, so if another update already landed
// between our read and our write, this one matches zero rows instead of
// blindly overwriting. On that conflict, retry (bounded — see maxAttempts)
// by re-reading the now-current row and reapplying THIS caller's patch on
// top of it, rather than silently losing the caller's change or silently
// clobbering the other update's. A plain top-level column filter
// (`version`, not a JSONB path into `data`) is used deliberately — it's the
// same simple `.eq()` pattern already used everywhere else in this file,
// not something new to get subtly wrong against real Postgres.
async function update(collection, id, patch, _attempt = 1) {
  const { data: row, error: readErr } = await supabase
    .from('records').select('data, version').eq('collection', collection).eq('id', id).maybeSingle();
  if (readErr) throw new Error(`store.update(${collection}, ${id}): ${readErr.message}`);
  if (!row) return null;
  const currentVersion = row.version || 1;
  const updated = { ...row.data, ...patch, updatedAt: new Date().toISOString() };
  const { error, count } = await supabase
    .from('records')
    .update({ data: updated, version: currentVersion + 1 }, { count: 'exact' })
    .eq('collection', collection).eq('id', id).eq('version', currentVersion);
  if (error) throw new Error(`store.update(${collection}, ${id}): ${error.message}`);
  if (!count) {
    const maxAttempts = 5;
    if (_attempt >= maxAttempts) {
      throw new Error(`store.update(${collection}, ${id}): gave up after ${maxAttempts} conflicting concurrent updates`);
    }
    return update(collection, id, patch, _attempt + 1);
  }
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
  'contractVersions', 'documents', 'tasks', 'approvals',
  'notifications', 'sessions', 'auditLog',
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
