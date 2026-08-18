'use strict';
/**
 * One-time backfill #2: adds 5 more Knowledge Base entries, broken out of
 * the general "PAGCOR E-Games Licensing Department — announcements" page
 * entry that scripts/seed-knowledge-base.js already added — see that
 * script's own comment for why a separate backfill script is needed at all
 * (your real database was already seeded with your real cases/contracts/
 * etc. long before the Knowledge Base module existed, so server/seed.js's
 * one-time demo-data seeding never runs again to pick up new additions).
 *
 * This is a SEPARATE script from seed-knowledge-base.js specifically so
 * running it doesn't re-create the original 9 sources/2 FAQs you already
 * added — only run this once, after you've already run
 * seed-knowledge-base.js.
 *
 * Usage:
 *   1. Make sure your server is running (node server.js).
 *   2. node scripts/seed-knowledge-base-announcements.js [baseUrl] [username] [password]
 *      Defaults: baseUrl=http://localhost:3000, username=admin
 *      You'll be prompted for the password if not given as an argument.
 */
const readline = require('readline');

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const USERNAME = process.argv[3] || 'admin';

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

const ANNOUNCEMENTS_URL = 'https://www.pagcor.ph/regulatory/announcements-ebld.php';

const KB_DOCUMENTS = [
  {
    title: 'Clarification on the Scope of the Unified Gaming License and Form 57 Requirements',
    category: 'System / Platform', documentType: 'External Link', sourceUrl: ANNOUNCEMENTS_URL,
    publicationDate: '2026-07-16', status: 'Pending Review',
    notes: 'Listed on the E-Games Licensing announcements page (no separate PDF link given). Clarifies Unified Gaming License scope and EG Form No. 57 requirements.',
  },
  {
    title: 'Post-Operational Activities for GSAs and B2B Providers',
    category: 'Distributor / Reseller', documentType: 'External Link', sourceUrl: ANNOUNCEMENTS_URL,
    publicationDate: '2026-07-13', status: 'Pending Review',
    notes: 'Listed on the E-Games Licensing announcements page (no separate PDF link given).',
  },
  {
    title: 'Unified Gaming License',
    category: 'System / Platform', documentType: 'External Link', sourceUrl: ANNOUNCEMENTS_URL,
    publicationDate: '2026-07-06', status: 'Pending Review',
    notes: 'Listed on the E-Games Licensing announcements page (no separate PDF link given).',
  },
  {
    title: 'Implementation of EG Form No. 57 — Appointment as Exclusive Distributor/Reseller Declaration Form',
    category: 'Distributor / Reseller', documentType: 'External Link', sourceUrl: ANNOUNCEMENTS_URL,
    publicationDate: '2026-07-06', status: 'Pending Review',
    notes: 'Listed on the E-Games Licensing announcements page (no separate PDF link given).',
  },
  {
    title: 'Migration to New OneDrive Repository for Game-Related Applications and Game Deployment of Currently Implemented Games',
    category: 'OneDrive / Submission Repository', documentType: 'External Link', sourceUrl: ANNOUNCEMENTS_URL,
    publicationDate: '2026-02-09', status: 'Pending Review',
    notes: 'Listed on the E-Games Licensing announcements page (no separate PDF link given).',
  },
];

async function main() {
  const password = process.argv[4] || await prompt(`Password for ${USERNAME}: `);

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

  let created = 0, failed = 0;
  for (const doc of KB_DOCUMENTS) {
    const res = await fetch(`${BASE_URL}/api/kb-documents`, { method: 'POST', headers, body: JSON.stringify(doc) });
    if (res.ok) { created++; console.log(`  + document: ${doc.title}`); }
    else { failed++; console.error(`  ! failed: ${doc.title} —`, await res.text()); }
  }
  console.log(`\nDone: ${created} created, ${failed} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
