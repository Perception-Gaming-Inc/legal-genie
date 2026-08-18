'use strict';
/**
 * Follow-up to seed-knowledge-base-telegram-faqs.js.
 *
 * After that script ran, Tiffany pointed to real source documents sitting in
 * her Downloads folder — an actual filled-out EG Form No. 9 (EGLD-426, Rev.
 * No. 4, effective March 11, 2024), a real RNG certification report (GLI),
 * a real PAGCOR "Notice of Approval" letter (EGLD Ref. SYS-26-07-299), and
 * her own internal tracking spreadsheet "PENDING GAME APPROVAL
 * APPLICATIONS.xlsx" (which literally has GAME MANUAL / PARAMETER / RTP
 * CERTIFICATION as tracked checklist columns, and shows real Game ID /
 * Game Version conventions per GSA provider).
 *
 * This script upgrades the FAQ answers that those documents actually
 * settle from 'Draft' placeholders to sourced 'Pending Review' answers, and
 * adds one new FAQ (PAGCOR's own stated processing time from EG Form No. 9)
 * that's directly relevant to "how long will this take" questions without
 * making any promise Legal Genie itself hasn't verified.
 *
 * A few FAQs (internal contact/upload channel, exact file format for
 * Legal Genie's own intake) are still left as Draft — the source documents
 * only settle PAGCOR's side of things (where EGLD wants documents sent),
 * not Legal Genie's internal intake process, so those still need a real
 * answer from Legal.
 *
 * Usage:
 *   1. Make sure your server is running (node server.js) and you've
 *      already run seed-knowledge-base-telegram-faqs.js at least once.
 *   2. node scripts/update-knowledge-base-telegram-faqs.js [baseUrl] [username] [password]
 */
const readline = require('readline');

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const USERNAME = process.argv[3] || 'admin';

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

const SRC_FORM = '(Source: EG Form No. 9, PAGCOR EGLD-426 Rev. No. 4, effective March 11, 2024 — "Remote Games" version.)';
const SRC_TRACKER = '(Source: EG Form No. 9, and your own internal "Pending Game Approval Applications" tracker, which checklists Game Manual / Parameters / RTP Certification per submission.)';
const SRC_APPROVAL = '(Source: EG Form No. 9, and a real PAGCOR Notice of Approval — EGLD Ref. No. SYS-26-07-299 — which approved 9 games submitted together on one form.)';

// Updates keyed by the exact question text already in the Knowledge Base.
const UPDATES = [
  {
    question: 'What documents are required for a new game submission?',
    answer: 'For a new/upgraded game under EG Form No. 9, PAGCOR requires: (1) Game documents — rules and mechanics, pay table, bonus features and special prizes, total RTP percentage per game, progressive jackpot details if any; (2) Game parameters — bet denominations, minimum and maximum bet, progressive increment percentage, RTP settings, payout cap if any; (3) Certification from a gaming laboratory that the RNG is compliant with GSRM Regulation 8 Section 2(b); (4) Certification (from a gaming laboratory or the Content Provider) that the RTP percentage is within PAGCOR\'s prescribed range, with testing results attached. If it also involves a new/upgraded electronic system, additional system documents, system accounting description, and system-level RNG certification are required too. ' + SRC_FORM,
    status: 'Pending Review',
  },
  {
    question: 'Do I need to submit the Game Manual?',
    answer: 'Yes. EG Form No. 9 requires "game documents" describing rules/mechanics, pay table, bonus features and RTP — and your own internal tracker lists "Game Manual" as one of the checklisted items per submission (alongside Parameters and RTP Certification). ' + SRC_TRACKER,
    status: 'Pending Review',
  },
  {
    question: 'Do I need to provide the RNG Certification?',
    answer: 'Yes. EG Form No. 9 requires a "Certification from gaming Laboratory" showing the Random Number Generator (RNG) used is compliant with subsection (b) under Section 2 of Regulation 8 of the Gaming Site Regulatory Manual (GSRM). In practice this is a report from an accredited testing lab (e.g. GLI — Gaming Laboratories International) evaluated against a standard such as GLI-19 Chapter 3 (RNG Requirements). ' + SRC_FORM,
    status: 'Pending Review',
  },
  {
    question: 'Do I need to provide the RTP Certification?',
    answer: 'Yes. EG Form No. 9 requires certification (from a gaming laboratory, or from the Content Provider with testing results attached) confirming each game\'s RTP percentage falls within PAGCOR\'s prescribed range — and "RTP Certification" is one of the columns your own team tracks per submission. ' + SRC_TRACKER,
    status: 'Pending Review',
  },
  {
    question: 'What format should the submission documents be in?',
    answer: 'On PAGCOR\'s side: EG Form No. 9 says hard copies may be submitted directly to the EGLD office, or scanned copies may be emailed to eGaming_Policy@pagcor.ph — it doesn\'t prescribe a specific file format beyond "scanned." What format Legal Genie itself wants from partners for the intake/Document Center step hasn\'t been confirmed — please check with Legal.' + DRAFT_HEDGE(),
    status: 'Draft',
  },
  {
    question: 'Can I submit multiple games at the same time?',
    answer: 'Yes — this is standard practice. EG Form No. 9 explicitly covers "each new game or suite of games," and a real example on file shows 9 Omniplay games submitted together on a single EG Form No. 9 and approved together in one Notice of Approval (EGLD Ref. No. SYS-26-07-299). ' + SRC_APPROVAL,
    status: 'Pending Review',
  },
  {
    question: 'Can I submit the required documents separately, or do they need to go together?',
    answer: 'They need to go together. EG Form No. 9 states: "Only requests with complete documentation will be processed. Failure to provide complete documents and information could result in non-processing of this request." ' + SRC_FORM,
    status: 'Pending Review',
  },
  {
    question: 'What happens if one of the required documents is missing?',
    answer: 'PAGCOR will not process an incomplete request. EG Form No. 9\'s own action-taken section has "RETURNED due to incomplete documentation or information" as a formal outcome EGLD can select — so an incomplete submission is typically returned rather than held. ' + SRC_FORM,
    status: 'Pending Review',
  },
  {
    question: 'What information should be included in the Game Parameters?',
    answer: 'Per EG Form No. 9, Game Parameters should include: bet denominations, minimum and maximum bet, progressive increment percentage (if applicable), RTP settings (if applicable), and any capping on payout. ' + SRC_FORM,
    status: 'Pending Review',
  },
  {
    question: 'What is the required Game Version format?',
    answer: 'There isn\'t one universal format — it follows whatever your Gaming System Administrator/provider uses. Real examples on file: Omniplay uses "{GameID}-{version}" (e.g. "100001-2.0.0"), JDB uses a build-tag style like "v3.193.0-h.2/v{hash}", and Vertex Play uses a simple "v1.1" style. Use whatever version string the GSA itself assigns to that build.',
    status: 'Pending Review',
  },
  {
    question: 'What should I enter as the Game ID?',
    answer: 'Game ID convention is set by each GSA/provider, not by one single Legal Genie-wide format. Real examples on file: Omniplay uses 6-digit numeric IDs (e.g. "100001"), FC and JDB use shorter numeric IDs (e.g. "22024", "8021"), and Vertex Play prefixes with "VP_" (e.g. "VP_230008_1"). Use the ID your provider/GSA assigns to the game.',
    status: 'Pending Review',
  },
  {
    question: 'What are the Minimum and Maximum Bet requirements?',
    answer: 'There\'s no single PAGCOR-fixed number for electronic games — minimum and maximum bet are values you propose yourself in the Game Parameters section of EG Form No. 9, and operators must maintain whatever "prescribed Minimum Bet and RTP percentage" gets approved for that game. (Land-based casino High Roller tables are a separate case, with a published minimum of USD 500 / HKD 5,000 / PhP 25,000 per hand — that doesn\'t apply to electronic/remote games.) ' + SRC_FORM,
    status: 'Pending Review',
  },
  {
    question: 'What RTP information should be provided?',
    answer: 'EG Form No. 9 requires: the total RTP percentage for each game (in the game documents), the RTP settings as part of Game Parameters, and a certification (from a gaming lab or the Content Provider, with testing results attached) confirming the RTP falls within PAGCOR\'s prescribed range. ' + SRC_FORM,
    status: 'Pending Review',
  },
  {
    question: 'What happens if the parameters change after submission?',
    answer: 'EG Form No. 9 itself says it plainly: "The Operator/Service Provider shall not make any change to the parameter settings of any electronic game/electronic bingo game (i.e. bet denomination, minimum or maximum bet, number of bet credits allowed, progressive system groupings, RTP percentage) unless notification/approval is submitted to EGLD." In practice this notification/approval goes through EG Form No. 10 (Game Conversion/Change in Parameter Settings). ' + SRC_FORM,
    status: 'Pending Review',
  },
  {
    question: 'Who should I send the submission documents to?',
    answer: 'On PAGCOR\'s side: EG Form No. 9 goes to the Electronic Gaming Licensing Department (EGLD), either as hard copy to PAGCOR\'s corporate office or by email to eGaming_Policy@pagcor.ph. Who a partner should send documents to on Legal Genie\'s side (before Legal forwards to PAGCOR) hasn\'t been confirmed — please check with Legal.' + DRAFT_HEDGE(),
    status: 'Draft',
  },
];

function DRAFT_HEDGE() {
  return ' (草稿：此部分屬於妳們內部流程,尚未在知識庫中確認,正式上線前請 Legal 確認或修改後再改為 Active。)';
}

// New FAQ to add — PAGCOR's own stated processing time, kept clearly
// distinct from Legal Genie's internal 30-day follow-up reminder so the
// bot never conflates the two.
const NEW_FAQS = [
  {
    question: 'How long does PAGCOR typically take to process a submission?',
    answer: 'EG Form No. 9 itself states: "Please allow thirty (30) business days from the submission of complete information and attachments for EGLD to process your request." This is PAGCOR\'s own stated processing time for a COMPLETE submission — it is not a guarantee, and it\'s a different thing from Legal Genie\'s internal follow-up reminder (which fires 30 CALENDAR days after the Submit Date by default, regardless of whether PAGCOR has responded). Do not tell partners their game "will be approved within 30 days" — only that PAGCOR states it allows up to 30 business days to process a complete request, and that Legal follows up around 30 days after submission if there\'s no update. ' + SRC_FORM,
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

  const listRes = await fetch(`${BASE_URL}/api/kb-faqs`, { headers });
  const existing = await listRes.json();

  let updated = 0, notFound = 0, failed = 0;
  for (const u of UPDATES) {
    const match = existing.find((f) => f.question.trim() === u.question.trim());
    if (!match) { notFound++; console.error(`  ? not found: ${u.question}`); continue; }
    const res = await fetch(`${BASE_URL}/api/kb-faqs/${match.id}`, {
      method: 'PUT', headers, body: JSON.stringify({ answer: u.answer, status: u.status }),
    });
    if (res.ok) { updated++; console.log(`  ~ [${u.status}] ${u.question}`); }
    else { failed++; console.error(`  ! failed: ${u.question} —`, await res.text()); }
  }

  let created = 0;
  for (const faq of NEW_FAQS) {
    const res = await fetch(`${BASE_URL}/api/kb-faqs`, { method: 'POST', headers, body: JSON.stringify(faq) });
    if (res.ok) { created++; console.log(`  + [${faq.status}] ${faq.question}`); }
    else { failed++; console.error(`  ! failed to create: ${faq.question} —`, await res.text()); }
  }

  console.log(`\nDone: ${updated} updated, ${created} new, ${notFound} not found, ${failed} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
