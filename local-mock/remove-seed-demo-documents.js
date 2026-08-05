'use strict';
/**
 * One-time convenience script for LOCAL TESTING ONLY: deletes the 6 demo
 * Documents server/seed.js creates on a fresh database (NDA template, AML
 * policy, a signed license agreement, a certificate, and two PAGCOR
 * report examples), leaving Document Center empty except for whatever you
 * actually upload yourself.
 *
 * These 6 seed records all have filePath: null — they were never real
 * uploaded files, just placeholder metadata rows shown so the module isn't
 * empty on a fresh install (that's also why their filenames in the UI show
 * as plain text instead of a clickable download link: there's nothing
 * behind them to download). Deleting them just removes those placeholder
 * rows; it has no effect on any real document you've uploaded.
 *
 * Matches by exact title (the 6 fixed strings server/seed.js always uses),
 * same approach as remove-seed-demo-cases.js, so it can never accidentally
 * touch a real document that happens to share a category/provider.
 *
 * This is NOT a new feature — it just calls the same DELETE
 * /api/documents/:id endpoint the trash-can icon in Document Center already
 * uses, for each of the 6 known seed titles, so you don't have to find and
 * click each one by hand.
 *
 * Usage (after your local server is already running):
 *   node local-mock/remove-seed-demo-documents.js
 *
 * Optional overrides (env vars, same names as import-real-data.js):
 *   LMS_BASE_URL   default http://localhost:3000
 *   LMS_USERNAME   default admin
 *   LMS_PASSWORD   default admin123
 */
const http = require('http');
const https = require('https');

const BASE_URL = process.env.LMS_BASE_URL || 'http://localhost:3000';
const USERNAME = process.env.LMS_USERNAME || 'admin';
const PASSWORD = process.env.LMS_PASSWORD || 'admin123';

// Exact titles from server/seed.js — keep this list in sync if seed.js's
// demo document titles ever change.
const SEED_DOCUMENT_TITLES = [
  'Standard NDA Template',
  'Anti-Money Laundering Policy',
  'PlayCloud License Agreement (Signed)',
  'Nevada Gaming License Certificate',
  'Fortune Dragon RNG Test Report',
  'Golden Empire Letter of Approval',
];

function request(method, urlPath, token, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const payload = body ? JSON.stringify(body) : null;
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let json;
        try { json = raw ? JSON.parse(raw) : {}; } catch (err) {
          return reject(new Error(`Non-JSON response (status ${res.statusCode}): ${raw.slice(0, 300)}`));
        }
        if (res.statusCode >= 400) {
          return reject(new Error(`${method} ${urlPath} -> ${res.statusCode}: ${json.error || raw}`));
        }
        resolve(json);
      });
    });
    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        reject(new Error(
          `Could not connect to ${BASE_URL}. Is your local server actually running? ` +
          `(Start it first with the usual "node server.js" command, then run this script in a *second* terminal tab.)`
        ));
      } else {
        reject(err);
      }
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  console.log(`Logging in as "${USERNAME}" at ${BASE_URL} ...`);
  const login = await request('POST', '/api/auth/login', null, { username: USERNAME, password: PASSWORD });
  const token = login.token;

  console.log('Fetching all documents ...');
  const docs = await request('GET', '/api/documents', token);

  const toDelete = docs.filter((d) => SEED_DOCUMENT_TITLES.includes(d.title));
  if (!toDelete.length) {
    console.log('\nNo seed demo documents found (already removed, or this database was never seeded) — nothing to do.');
    return;
  }

  console.log(`\nFound ${toDelete.length} of the ${SEED_DOCUMENT_TITLES.length} known seed demo document(s):`);
  toDelete.forEach((d) => console.log(` - ${d.title} (${d.fileName || 'no file'})`));

  let deleted = 0;
  for (const d of toDelete) {
    try {
      await request('DELETE', `/api/documents/${d.id}`, token);
      deleted++;
    } catch (err) {
      console.log(`  Failed to delete "${d.title}": ${err.message}`);
    }
  }
  console.log(`\nDone: ${deleted} seed demo document(s) deleted. Your other ${docs.length - deleted} document(s) are untouched.`);
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
