'use strict';
/**
 * One-time backfill: adds the 9 real PAGCOR source-pack entries + 2 starter
 * FAQ entries to the Knowledge Base, via the app's own REST API (not a
 * direct database write) — safe to run against your real, already-seeded
 * system since it only creates new Knowledge Base rows, it never touches
 * cases/contracts/documents/users/etc.
 *
 * This is only needed because server/seed.js's demo-data seeding only ever
 * runs once, automatically, the very first time the app starts against a
 * brand-new empty database — since your real database already has your
 * real cases/contracts/etc. in it, that one-time seeding already happened
 * long ago and won't run again, so the new Knowledge Base source pack
 * (added to seed.js alongside the rest of the demo data) never got backfilled
 * in for you automatically. Run this once to add it manually instead.
 *
 * Usage:
 *   1. Make sure your server is running (node server.js).
 *   2. node scripts/seed-knowledge-base.js [baseUrl] [username] [password]
 *      Defaults: baseUrl=http://localhost:3000, username=admin
 *      You'll be prompted for the password if not given as an argument.
 *
 * Safe to run more than once — it does not check for existing duplicates,
 * so running it twice will create the 9+2 entries twice. If that happens,
 * just delete the extras from the Knowledge Base page in the app.
 */
const readline = require('readline');

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const USERNAME = process.argv[3] || 'admin';

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

const KB_DOCUMENTS = [
  {
    title: 'PAGCOR Electronic Gaming Licensing — main page', category: 'Regulatory Framework',
    documentType: 'External Link', sourceUrl: 'https://www.pagcor.ph/regulatory/cegs.php',
    status: 'Pending Review',
    notes: 'Electronic Gaming Licensing Department scope; regulatory frameworks, application kits, operational request forms, schedule of fees, registered brands/domains.',
  },
  {
    title: 'PAGCOR E-Games Licensing Department — announcements', category: 'Regulatory Framework',
    documentType: 'External Link', sourceUrl: 'https://www.pagcor.ph/regulatory/announcements-ebld.php',
    status: 'Pending Review',
    notes: 'Latest memoranda/regulatory updates, amendments, OneDrive repository updates, approved-game announcements, EG Form updates, B2B/distributor-related updates.',
  },
  {
    title: 'Regulatory Framework for Accreditation of Service Providers and Processing of System-Related Requests',
    category: 'Regulatory Framework', documentType: 'External Link',
    sourceUrl: 'https://www.pagcor.ph/regulatory/pdf/GSRM/Regulatory%20Manuals/Regulatory%20Framework%20for%20the%20Accreditation%20of%20Service%20Providers%20and%20Processing%20of%20System-Related%20Requests%20Rev.%20No.%203.pdf',
    version: 'Rev. No. 3', revisionNumber: '3', effectivityDate: '2025-02-27', status: 'Pending Review',
    notes: 'Service Provider accreditation, system-related requests, game/system approval processes, documentary requirements, testing/walkthrough and parameter-related requirements.',
  },
  {
    title: 'PAGCOR Memorandum — Amendments to Existing Regulatory Frameworks for Electronic Gaming Operations',
    category: 'Regulatory Framework', documentType: 'External Link',
    sourceUrl: 'https://www.pagcor.ph/regulatory/pdf/App%20Kits/AMENDMENTS%20TO%20THE%20PROVISIONS%20OF%20EXISTING%20REGULATORY%20FRAMEWORKS%20FOR%20ELECTRONICS%20GAMING%20OPERATIONS.pdf',
    publicationDate: '2025-02-27', status: 'Pending Review',
    notes: '2025 amendments; use for cross-checking whether older requirements have been amended.',
  },
  {
    title: 'PAGCOR Memorandum — Approval of Currently Implemented Games',
    category: 'Game Approval', documentType: 'External Link',
    sourceUrl: 'https://www.pagcor.ph/regulatory/pdf/announcements/Memorandum-on-Approval-of-Currently-Implemented-Games.pdf',
    publicationDate: '2025-06-02', status: 'Pending Review',
    notes: 'Previously approved games currently allowed to be implemented; notification of implementation; Proposed Game List and Parameters Settings Checklist; progressive jackpot games and EG Form No. 9; minimum bet and RTP compliance.',
  },
  {
    title: 'PAGCOR Application Kits', category: 'Application Forms',
    documentType: 'External Link', sourceUrl: 'https://www.pagcor.ph/regulatory/application-kit.php',
    status: 'Pending Review',
    notes: 'Official application forms; current form numbers; checking whether a form is an official PAGCOR application form.',
  },
  {
    title: 'PAGCOR Regulatory Frameworks — index', category: 'Regulatory Framework',
    documentType: 'External Link', sourceUrl: 'https://www.pagcor.ph/regulatory/regulatory-manual-ebld.php',
    status: 'Pending Review',
    notes: 'Current regulatory framework index, amendments and annexes; identifying which framework should be reviewed for a specific question.',
  },
  {
    title: 'PAGCOR Operational Request Forms', category: 'Operational Forms',
    documentType: 'External Link', sourceUrl: 'https://www.pagcor.ph/regulatory/operational-request-forms.php',
    status: 'Pending Review',
    notes: 'Official operational request forms; cross-checking form names/numbers.',
  },
  {
    title: 'PAGCOR Regulatory Contact', category: 'Regulatory Framework',
    documentType: 'External Link', sourceUrl: 'https://www.pagcor.ph/regulatory/contact.php',
    status: 'Pending Review',
    notes: 'Official regulatory department contact information; escalation when the knowledge base cannot answer a question.',
  },
];

const KB_FAQS = [
  {
    question: 'Where do I find the current official PAGCOR application forms?',
    answer: 'See the PAGCOR Application Kits page in this Knowledge Base — it links to the current official forms and form numbers directly from PAGCOR\'s site.',
    category: 'Application Forms', status: 'Pending Review',
  },
  {
    question: 'How long after Submission Date should we follow up with PAGCOR?',
    answer: 'The system automatically creates a follow-up reminder 30 days after a case\'s Submit Date by default (configurable in Settings > Submission Settings).',
    category: 'Game Submission', status: 'Pending Review',
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
  for (const faq of KB_FAQS) {
    const res = await fetch(`${BASE_URL}/api/kb-faqs`, { method: 'POST', headers, body: JSON.stringify(faq) });
    if (res.ok) { created++; console.log(`  + FAQ: ${faq.question}`); }
    else { failed++; console.error(`  ! failed: ${faq.question} —`, await res.text()); }
  }
  console.log(`\nDone: ${created} created, ${failed} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
