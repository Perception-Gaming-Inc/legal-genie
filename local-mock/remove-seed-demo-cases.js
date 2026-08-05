'use strict';
/**
 * One-time convenience script for LOCAL TESTING ONLY: deletes the 5 demo
 * Cases server/seed.js creates on a fresh database (three general "sample"
 * cases plus two PAGCOR game-submission examples), leaving only your real
 * imported data behind. Useful right after running import-real-data.js when
 * you want the Case Management list to show ONLY your actual Excel data,
 * not the built-in demo cases too.
 *
 * Matches by exact title (the 5 fixed strings server/seed.js always uses),
 * not by any heuristic like "has no Provider" — two of the five seed cases
 * DO have a Provider (FC / JDB) set, same as real imported cases, so an
 * exact-title match is what avoids ever touching one of your real games by
 * mistake.
 *
 * This is NOT a new feature — it just calls the same DELETE /api/cases/:id
 * endpoint the trash-can icon in the Case Management list already uses, for
 * each of the 5 known seed titles, so you don't have to find and click each
 * one by hand.
 *
 * Usage (after your local server is already running):
 *   node local-mock/remove-seed-demo-cases.js
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
// demo case titles ever change.
const SEED_CASE_TITLES = [
  'Gaming license dispute - Nevada Gaming Commission',
  'Vendor contract breach - slot machine parts supplier',
  'Employee IP assignment review',
  'PAGCOR game submission - Fortune Dragon',
  'PAGCOR game submission - Golden Empire',
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

  console.log('Fetching all cases ...');
  const cases = await request('GET', '/api/cases', token);

  const toDelete = cases.filter((c) => SEED_CASE_TITLES.includes(c.title));
  if (!toDelete.length) {
    console.log('\nNo seed demo cases found (already removed, or this database was never seeded) — nothing to do.');
    return;
  }

  console.log(`\nFound ${toDelete.length} of the ${SEED_CASE_TITLES.length} known seed demo case(s):`);
  toDelete.forEach((c) => console.log(` - ${c.caseNumber}: ${c.title}`));

  let deleted = 0;
  for (const c of toDelete) {
    try {
      await request('DELETE', `/api/cases/${c.id}`, token);
      deleted++;
    } catch (err) {
      console.log(`  Failed to delete ${c.caseNumber}: ${err.message}`);
    }
  }
  console.log(`\nDone: ${deleted} seed demo case(s) deleted. Your other ${cases.length - deleted} case(s) are untouched.`);
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
