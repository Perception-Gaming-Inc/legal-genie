'use strict';
/**
 * One-time migration: renames every case's PAGCOR Stage from the old
 * 6-value list to the new, simpler 5-value list Tiffany asked for on
 * 2026-08-12 (see server/pagcor.js and public/js/app.js's
 * PAGCOR_STAGE_OPTIONS for the new canonical list).
 *
 * Mapping used (confirmed with Tiffany before writing this):
 *   Not Started         -> Pending Documents
 *   Preparing Documents -> Pending Documents
 *   Submitted to PAGCOR -> For Review
 *   Under PAGCOR Review -> On Process
 *   LOA Approved         -> Approved
 *   Rejected              (unchanged)
 *
 * Safe to re-run: any case already on a new-list value is left untouched
 * (its mapped value would equal its current value, so it's skipped).
 *
 * IMPORTANT SIDE EFFECT — please read before running with --apply:
 * Changing a case's pagcorStage — even just this rename — also resets
 * that case's "time in current stage" clock (pagcorStageChangedAt), which
 * is what the Dashboard's 30-day PAGCOR follow-up reminder is based on
 * (see server/routes.js's cases onUpdate). That's just how any stage edit
 * works today; this script doesn't add a workaround for it. Practically:
 * right after running this with --apply, a game that was, say, 40 days
 * overdue for follow-up will stop showing on the Dashboard's follow-up
 * list until it's been sitting in its (renamed) stage for another 30 days.
 * It isn't lost — the case's real progress/data is untouched, only the
 * "how long has it been idle" clock restarts. If you want to know which
 * games were about to be flagged before running this, it's worth a quick
 * look at the Dashboard's "PAGCOR Follow-ups Due" list first.
 *
 * Usage:
 *   1. Make sure your server is running (node server.js).
 *   2. Dry run first (default — makes no changes, just prints a plan):
 *      node scripts/migrate-pagcor-stages.js [baseUrl] [username] [password]
 *   3. Once you've checked the plan looks right, actually apply it:
 *      node scripts/migrate-pagcor-stages.js [baseUrl] [username] [password] --apply
 *      Defaults: baseUrl=http://localhost:3000, username=admin
 *      You'll be prompted for the password if not given as an argument.
 */
const readline = require('readline');

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const USERNAME = process.argv[3] || 'admin';
const APPLY = process.argv.includes('--apply');

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

const STAGE_MAP = {
  'Not Started': 'Pending Documents',
  'Preparing Documents': 'Pending Documents',
  'Submitted to PAGCOR': 'For Review',
  'Under PAGCOR Review': 'On Process',
  'LOA Approved': 'Approved',
};

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

  const toMigrate = cases
    .filter((c) => c.pagcorStage && STAGE_MAP[c.pagcorStage])
    .map((c) => ({ ...c, newStage: STAGE_MAP[c.pagcorStage] }));

  if (!toMigrate.length) {
    console.log('Nothing to migrate — every case is already on the new stage names (or has no PAGCOR Stage set).');
    return;
  }

  console.log(`${APPLY ? 'Applying' : 'Plan (dry run — pass --apply to actually make these changes)'}:\n`);
  const byTransition = {};
  for (const c of toMigrate) {
    const key = `${c.pagcorStage} -> ${c.newStage}`;
    (byTransition[key] = byTransition[key] || []).push(c);
  }
  for (const [transition, list] of Object.entries(byTransition)) {
    console.log(`  ${transition}  (${list.length} case${list.length === 1 ? '' : 's'})`);
  }
  console.log(`\nTotal: ${toMigrate.length} case(s) affected.\n`);

  if (!APPLY) {
    console.log('No changes made (dry run). Re-run with --apply once this plan looks right.');
    return;
  }

  let updated = 0, failed = 0;
  for (const c of toMigrate) {
    const res = await fetch(`${BASE_URL}/api/cases/${c.id}`, {
      method: 'PUT', headers, body: JSON.stringify({ pagcorStage: c.newStage }),
    });
    if (res.ok) {
      updated++;
      console.log(`  + ${c.caseNumber} — ${c.title}: ${c.pagcorStage} -> ${c.newStage}`);
    } else {
      failed++;
      console.error(`  ! failed: ${c.caseNumber} — ${c.title} —`, await res.text());
    }
  }
  console.log(`\nDone: ${updated} updated, ${failed} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
