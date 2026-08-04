'use strict';
/**
 * One-time convenience script for LOCAL TESTING ONLY: automatically runs
 * your real PENDING_GAME_APPROVAL_APPLICATIONS.xlsx through the "Import
 * Excel/CSV" feature's actual API (the same /api/cases/import/preview and
 * /api/cases/import/commit routes the "Import Excel/CSV" button in the UI
 * calls), using the exact per-sheet settings you already decided on:
 *
 *   - OMNIPLAY / FC / YELLOW BAT / JDB / VERTEX PLAY sheets (pending games):
 *     PAGCOR Stage = "Under PAGCOR Review", Provider = the sheet's own name
 *   - " APPROVED " sheet (35 already-approved games):
 *     PAGCOR Stage = "LOA Approved" (each row's own Provider column is used
 *     automatically since that sheet already has a Provider column)
 *
 * This is NOT a new feature — it's a shortcut so you don't have to click
 * through the upload modal and set 5 dropdowns by hand just to get your
 * real data loaded for testing. The "Import Excel/CSV" button in the UI
 * still works the normal way for any file, any time.
 *
 * Usage (after your local server is already running):
 *   node local-mock/import-real-data.js
 *
 * Optional overrides (env vars):
 *   LMS_BASE_URL   default http://localhost:3000  (change if you used a
 *                  different PORT, e.g. http://localhost:3001)
 *   LMS_FILE       default ~/Downloads/PENDING_GAME_APPROVAL_APPLICATIONS.xlsx
 *   LMS_USERNAME   default admin
 *   LMS_PASSWORD   default admin123
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');

const BASE_URL = process.env.LMS_BASE_URL || 'http://localhost:3000';
const FILE_PATH = process.env.LMS_FILE
  || path.join(os.homedir(), 'Downloads', 'PENDING_GAME_APPROVAL_APPLICATIONS.xlsx');
const USERNAME = process.env.LMS_USERNAME || 'admin';
const PASSWORD = process.env.LMS_PASSWORD || 'admin123';

// Per-sheet settings matching your earlier decisions. Sheet names must match
// the workbook's actual tab names exactly (the APPROVED tab has a leading
// and trailing space in the real file, hence " APPROVED " below).
const PENDING_SHEETS = ['OMNIPLAY', 'FC', 'YELLOW BAT', 'JDB', 'VERTEX PLAY'];
const APPROVED_SHEET = ' APPROVED ';

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
  console.log(`Reading ${FILE_PATH} ...`);
  if (!fs.existsSync(FILE_PATH)) {
    throw new Error(
      `File not found: ${FILE_PATH}\n` +
      `Set LMS_FILE=/full/path/to/your/file.xlsx if it's somewhere else, e.g.:\n` +
      `  LMS_FILE="$HOME/Downloads/PENDING_GAME_APPROVAL_APPLICATIONS.xlsx" node local-mock/import-real-data.js`
    );
  }
  const fileContentBase64 = fs.readFileSync(FILE_PATH).toString('base64');
  const fileName = path.basename(FILE_PATH);

  console.log(`Logging in as "${USERNAME}" at ${BASE_URL} ...`);
  const login = await request('POST', '/api/auth/login', null, { username: USERNAME, password: PASSWORD });
  const token = login.token;

  console.log('Previewing the file (no data written yet) ...');
  const { sheets } = await request('POST', '/api/cases/import/preview', token, { fileName, fileContentBase64 });
  const foundNames = sheets.map((s) => s.name);
  console.log('Sheets found in file:', foundNames.map((n) => JSON.stringify(n)).join(', '));

  const missing = [...PENDING_SHEETS, APPROVED_SHEET].filter((n) => !foundNames.includes(n));
  if (missing.length) {
    throw new Error(
      `This file's sheet names don't match what this script expects: ${missing.map((n) => JSON.stringify(n)).join(', ')} not found.\n` +
      `Found instead: ${foundNames.map((n) => JSON.stringify(n)).join(', ')}\n` +
      `(If you renamed a tab, either rename it back or tell Claude the new names so the script can be updated.)`
    );
  }

  // Use the server's own suggestedProvider for each sheet (same Title-Case
  // logic the Import modal's UI uses) rather than re-deriving it here, so
  // the Provider values exactly match what clicking through the UI would
  // have produced (and match the "OMNIPLAY"/"JDB"/etc. spelling already
  // used elsewhere in the app, e.g. by the Provider filter and demo data).
  const byName = Object.fromEntries(sheets.map((s) => [s.name, s]));
  const sheetSettings = [
    ...PENDING_SHEETS.map((name) => ({
      name, include: true, provider: byName[name].suggestedProvider, pagcorStage: 'Under PAGCOR Review',
    })),
    { name: APPROVED_SHEET, include: true, pagcorStage: 'LOA Approved' },
    // Any other sheet in the file that isn't in the two lists above is left
    // out (include defaults to false server-side when a sheet isn't listed).
  ];

  console.log('Committing import (this actually creates the Cases) ...');
  const result = await request('POST', '/api/cases/import/commit', token, { fileName, fileContentBase64, sheets: sheetSettings });

  console.log(`\nDone: ${result.created} case(s) created.`);
  if (result.errors && result.errors.length) {
    console.log(`${result.errors.length} row error(s):`);
    result.errors.slice(0, 20).forEach((e) => console.log(' -', e));
    if (result.errors.length > 20) console.log(`  ...and ${result.errors.length - 20} more.`);
  }
  console.log('\nOpen the app and check the Cases list — filter by Provider or Stage to see them.');
}

main().catch((err) => {
  console.error('\nImport failed:', err.message);
  process.exit(1);
});
