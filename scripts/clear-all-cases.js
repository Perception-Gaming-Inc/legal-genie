'use strict';
/**
 * Clears out every record in Case Management, at Tiffany's request
 * (2026-08-12) — including real, already-imported PAGCOR case data, not
 * just the original demo/seed cases. This is a genuinely destructive,
 * hard-to-undo operation on real business data, so this script is written
 * defensively:
 *
 *   1. It always backs up every case it's about to delete to a local JSON
 *      file first (see BACKUP below) — before touching anything — so
 *      there's a real, complete copy of the data even after it's gone from
 *      the app itself.
 *   2. It's a dry run by default. It will NOT delete anything unless you
 *      pass --apply.
 *   3. It only touches the `cases` collection. It does not touch Documents,
 *      Contracts, Tasks, Approvals, or Notifications.
 *
 * What deleting a case does and doesn't affect elsewhere in the app:
 *   - Each case's own auto-generated "追進度" 30-day follow-up task (Task
 *     Management) is automatically cleaned up too — no orphaned tasks left
 *     behind (see server/routes.js's cases `afterDelete`).
 *   - Any Document Center file that had this case set as its "Related Case"
 *     is NOT deleted and NOT touched — it stays exactly where it is, just
 *     its Related Case link will point at a case that no longer exists
 *     (the link will simply stop resolving to anything in the UI). This
 *     script does not attempt to clear those links.
 *   - Approvals, Notifications, and Contracts are unaffected.
 *
 * Usage:
 *   1. Make sure your server is running (node server.js).
 *   2. Dry run first (default — makes no changes, just writes the backup
 *      file and prints how many cases would be deleted):
 *      node scripts/clear-all-cases.js [baseUrl] [username] [password]
 *   3. Once you've checked the backup file looks complete and you're sure,
 *      actually delete everything:
 *      node scripts/clear-all-cases.js [baseUrl] [username] [password] --apply
 *      Defaults: baseUrl=http://localhost:3000, username=admin
 *      You'll be prompted for the password if not given as an argument.
 */
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const USERNAME = process.argv[3] || 'admin';
const APPLY = process.argv.includes('--apply');

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

async function main() {
  const passwordArg = process.argv[4] === '--apply' ? undefined : process.argv[4];
  const password = passwordArg || await prompt(`Password for ${USERNAME}: `);

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.token) {
    console.error('Login failed:', loginData.error || loginRes.status);
    process.exit(1);
  }
  const token = loginData.token;
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${token}` };

  const casesRes = await fetch(`${BASE_URL}/api/cases`, { headers });
  if (!casesRes.ok) {
    console.error('Failed to fetch cases:', casesRes.status, await casesRes.text());
    process.exit(1);
  }
  const cases = await casesRes.json();

  if (!cases.length) {
    console.log('Case Management is already empty — nothing to do.');
    return;
  }

  // Always write the backup, dry run or not — cheap, safe, and means the
  // backup file exists BEFORE you ever pass --apply.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(__dirname, `cases-backup-${stamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(cases, null, 2));
  console.log(`Backed up ${cases.length} case(s) to:\n  ${backupPath}\n`);

  console.log(`${APPLY ? 'Deleting' : 'Plan (dry run — pass --apply to actually delete)'}: ${cases.length} case(s), including:`);
  cases.slice(0, 10).forEach((c) => console.log(`  - ${c.caseNumber} — ${c.title}`));
  if (cases.length > 10) console.log(`  ...and ${cases.length - 10} more (full list is in the backup file above).`);

  if (!APPLY) {
    console.log('\nNo changes made (dry run). Check the backup file, then re-run with --apply to actually delete everything.');
    return;
  }

  // Each delete is wrapped in its own try/catch — a single network hiccup
  // (timeout, connection reset, etc.) must not abort the whole run and
  // leave the rest of the list untouched. Earlier version of this script
  // didn't do this and stopped partway through on a transient network
  // error, leaving a chunk of cases undeleted with no clear signal why.
  let deleted = 0, failed = 0;
  const failedCases = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    try {
      const res = await fetch(`${BASE_URL}/api/cases/${c.id}`, { method: 'DELETE', headers });
      if (res.ok) {
        deleted++;
      } else {
        failed++;
        failedCases.push(c);
        console.error(`  ! failed to delete ${c.caseNumber} — ${c.title} —`, await res.text());
      }
    } catch (err) {
      failed++;
      failedCases.push(c);
      console.error(`  ! failed to delete ${c.caseNumber} — ${c.title} — ${err.message} (will keep going)`);
    }
    if ((i + 1) % 20 === 0 || i === cases.length - 1) {
      console.log(`  progress: ${i + 1}/${cases.length} processed (${deleted} deleted, ${failed} failed so far)`);
    }
  }
  console.log(`\nDone: ${deleted} deleted, ${failed} failed. Backup is still at:\n  ${backupPath}`);
  if (failedCases.length) {
    console.log(`\n${failedCases.length} case(s) could not be deleted — just re-run this script with --apply again; it will pick up whatever's still left (it always re-fetches the current list first).`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
