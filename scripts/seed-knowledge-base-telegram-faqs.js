'use strict';
/**
 * One-time backfill #3: adds Knowledge Base FAQ entries for the Telegram
 * Partner Assistant Bot's "③ FAQ / Knowledge Base" branch, per Tiffany's
 * FAQ design (categories ① Submission Process docs, ⑤ PAGCOR Requirements,
 * ⑥ Game Parameters, and the general/non-case-specific items from
 * ⑩ Common Questions).
 *
 * IMPORTANT — read before setting anything to Active:
 * Many of these answers are marked status: 'Draft' because they depend on
 * Legal Genie's own internal submission checklist/process (e.g. exact
 * document checklist, upload channel, internal contacts) rather than on
 * PAGCOR's published regulations — and that internal process was not
 * available to source from. Their `answer` text says so explicitly and
 * asks to confirm with Legal before publishing. Please review every
 * 'Draft' entry and fill in the real answer (or approve the drafted one)
 * before changing its status to Active — this is exactly the "Knowledge
 * Base has no data -> escalate to Legal Team" rule from the bot design,
 * applied at content-authoring time instead of query time.
 *
 * Entries marked 'Pending Review' ARE grounded in the regulatory content
 * already in this Knowledge Base (EG Form numbers, RTP/minimum-bet
 * language, etc.) — they still need a human sign-off before Active, per
 * this Knowledge Base's existing convention, but the underlying facts are
 * sourced.
 *
 * Usage:
 *   1. Make sure your server is running (node server.js).
 *   2. node scripts/seed-knowledge-base-telegram-faqs.js [baseUrl] [username] [password]
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

const DRAFT_SUFFIX = ' (草稿：此答案屬於妳們內部流程/尚未在知識庫中確認的細節，正式上線前請 Legal 確認或修改後再改為 Active。)';

const KB_FAQS = [
  // ---- Submission Process (documents needed before submitting a new game) ----
  {
    question: 'What documents are required for a new game submission?',
    answer: 'PAGCOR requires an EG Form No. 9 (New System, Game and/or Machine Request and Approval) for each new game or suite of games, submitted through your accredited Gaming System Administrator (GSA). Beyond that form, the full internal checklist (e.g. Game Manual, RNG/RTP certification, Game Parameters sheet) has not been documented in this Knowledge Base yet.' + DRAFT_SUFFIX,
    category: 'Game Submission', status: 'Draft',
  },
  {
    question: 'Do I need to submit the Game Manual?',
    answer: 'Not yet documented in this Knowledge Base — please confirm with Legal whether a Game Manual is a mandatory attachment for your submission.' + DRAFT_SUFFIX,
    category: 'Game Submission', status: 'Draft',
  },
  {
    question: 'Do I need to provide the RNG Certification?',
    answer: 'PAGCOR\'s Casino Regulatory Manual requires gaming equipment/EGMs to be certified by an Independent Testing Laboratory (ITL), which typically covers RNG certification — but the exact document requirement for your submission type has not been confirmed in this Knowledge Base.' + DRAFT_SUFFIX,
    category: 'Game Submission', status: 'Draft',
  },
  {
    question: 'Do I need to provide the RTP Certification?',
    answer: 'PAGCOR\'s Regulatory Framework for Offenses and Penalties requires every game offering to maintain its "prescribed Minimum Bet and Return-to-Player (RTP) percentage," and the Casino Regulatory Manual requires EGMs to be ITL-certified against PAGCOR-specified RTP thresholds. Whether an RTP certificate must be attached to every game submission has not been confirmed in this Knowledge Base.' + DRAFT_SUFFIX,
    category: 'Game Submission', status: 'Draft',
  },
  {
    question: 'What format should the submission documents be in?',
    answer: 'Not yet documented in this Knowledge Base — please confirm the accepted file formats with Legal.' + DRAFT_SUFFIX,
    category: 'Game Submission', status: 'Draft',
  },
  {
    question: 'Can I submit multiple games at the same time?',
    answer: 'PAGCOR\'s EG Form No. 9 covers "each new game or suite of games," which suggests batch/suite submissions are possible — but the internal process for submitting multiple games together has not been confirmed in this Knowledge Base.' + DRAFT_SUFFIX,
    category: 'Game Submission', status: 'Draft',
  },
  {
    question: 'Can I submit the required documents separately, or do they need to go together?',
    answer: 'Not yet documented in this Knowledge Base — please confirm with Legal.' + DRAFT_SUFFIX,
    category: 'Game Submission', status: 'Draft',
  },
  {
    question: 'What happens if one of the required documents is missing?',
    answer: 'In general, a submission cannot move forward to PAGCOR until all required documents are complete — check the case\'s Document Status for exactly what\'s missing. The exact internal handling (e.g. whether the case is held or returned) has not been confirmed in this Knowledge Base.' + DRAFT_SUFFIX,
    category: 'Game Submission', status: 'Draft',
  },

  // ---- PAGCOR Requirements ----
  {
    question: 'Why does PAGCOR need this document?',
    answer: 'PAGCOR requires supporting documentation to verify a game/operator/entity\'s compliance before approval — e.g. the Probity Checking Framework requires identity, integrity, competence, financial capacity, and background verification, and the Gaming Venue Operations framework requires equipment/games to be approved before deployment. The specific reason for a particular document depends on the document in question — check with Legal if it\'s unclear.',
    category: 'Regulatory Framework', status: 'Pending Review',
  },
  {
    question: 'What are PAGCOR\'s requirements for this game?',
    answer: 'Requirements vary by game type and category — see the "Regulatory Framework" documents in this Knowledge Base for the general rules (Gaming Venue Operations, Offenses and Penalties, Casino Regulatory Manual, etc.). For the requirements specific to one game, please check with Legal.',
    category: 'Regulatory Framework', status: 'Pending Review',
  },
  {
    question: 'Does this game require additional certification?',
    answer: 'PAGCOR requires ITL (Independent Testing Laboratory) certification for gaming equipment/EGMs and compliance with PAGCOR-specified RTP thresholds. Whether a specific game needs additional certification depends on its category and has not been fully documented in this Knowledge Base.' + DRAFT_SUFFIX,
    category: 'Regulatory Framework', status: 'Draft',
  },
  {
    question: 'Does changing the game version require resubmission?',
    answer: 'Generally yes — parameter/version changes to an already-approved game go through EG Form No. 10 (Game Conversion/Change in Parameter Settings), and games with progressive jackpot features always require a fresh approval request (EG Form No. 9) with supporting documentation, per PAGCOR\'s Memorandum on Approval of Currently Implemented Games. Previously-approved games that are unchanged do not need to be re-evaluated.',
    category: 'Regulatory Framework', status: 'Pending Review',
  },
  {
    question: 'Do I need to submit a new application for an updated game?',
    answer: 'If the update changes game parameters, use EG Form No. 10 (Game Conversion/Change in Parameter Settings). If it\'s a genuinely new game or suite of games, use EG Form No. 9 (New System, Game and/or Machine Request and Approval). Games with a progressive jackpot feature always need a new EG Form No. 9 approval regardless of prior approval status.',
    category: 'Regulatory Framework', status: 'Pending Review',
  },
  {
    question: 'What happens if PAGCOR rejects the submission?',
    answer: 'Not yet documented in this Knowledge Base — the general rejection/re-submission process has not been confirmed. Please contact the Legal Team for guidance on a specific rejected case.' + DRAFT_SUFFIX,
    category: 'Regulatory Framework', status: 'Draft',
  },
  {
    question: 'Can we appeal a rejection?',
    answer: 'PAGCOR\'s Probity Checking Framework has a documented appeals process for probity-check results specifically (written request to the Appropriate Licensing Department within 15 calendar days, with a decision within 15 working days). For a general game-submission rejection, no appeals process has been confirmed in this Knowledge Base — please contact the Legal Team.' + DRAFT_SUFFIX,
    category: 'Regulatory Framework', status: 'Draft',
  },
  {
    question: 'What is the difference between a new game submission and a subsequent (updated) game submission?',
    answer: 'A new game submission uses EG Form No. 9 (New System, Game and/or Machine Request and Approval) and goes through full evaluation. A subsequent/updated submission for an already-approved game generally uses EG Form No. 10 (Game Conversion/Change in Parameter Settings) and does not require re-evaluation of the whole game — except games with a progressive jackpot feature, which always require a new EG Form No. 9 approval.',
    category: 'Regulatory Framework', status: 'Pending Review',
  },

  // ---- Game Parameters ----
  {
    question: 'What information should be included in the Game Parameters?',
    answer: 'Not yet documented in this Knowledge Base — the exact required fields for a Game Parameters submission have not been confirmed. Please check with Legal for the current template.' + DRAFT_SUFFIX,
    category: 'Game Submission', status: 'Draft',
  },
  {
    question: 'What is the required Game Version format?',
    answer: 'Not yet documented in this Knowledge Base — please confirm the expected Game Version format with Legal.' + DRAFT_SUFFIX,
    category: 'Game Submission', status: 'Draft',
  },
  {
    question: 'What should I enter as the Game ID?',
    answer: 'Not yet documented in this Knowledge Base — this depends on Legal Genie\'s internal case/game ID convention. Please confirm with Legal.' + DRAFT_SUFFIX,
    category: 'Game Submission', status: 'Draft',
  },
  {
    question: 'What are the Minimum and Maximum Bet requirements?',
    answer: 'PAGCOR does not publish one universal min/max bet figure for electronic games — operators must maintain the "prescribed Minimum Bet and RTP percentage per game offering" as set in their approval. For land-based casino High Roller tables specifically, the Casino Regulatory Manual sets a minimum of USD 500 / HKD 5,000 / PhP 25,000 per hand, but that applies to a different game category. Please confirm the applicable min/max bet for your specific game with Legal.',
    category: 'Game Submission', status: 'Pending Review',
  },
  {
    question: 'What RTP information should be provided?',
    answer: 'PAGCOR requires each game offering to maintain a specified minimum RTP percentage, and EGMs must be ITL-certified against PAGCOR-specified RTP thresholds. The exact RTP documentation your submission needs to include has not been fully confirmed in this Knowledge Base.' + DRAFT_SUFFIX,
    category: 'Game Submission', status: 'Draft',
  },
  {
    question: 'What happens if the parameters change after submission?',
    answer: 'Parameter changes to an already-submitted/approved game go through EG Form No. 10 (Game Conversion/Change in Parameter Settings) rather than a brand-new application — except for progressive jackpot features, which always require a fresh EG Form No. 9 approval.',
    category: 'Game Submission', status: 'Pending Review',
  },
  {
    question: 'Do I need to update the Game Manual when the parameters change?',
    answer: 'Not yet documented in this Knowledge Base — whether the Game Manual needs updating alongside a parameter change (EG Form No. 10) has not been confirmed. Please check with Legal.' + DRAFT_SUFFIX,
    category: 'Game Submission', status: 'Draft',
  },

  // ---- Common Questions (general cooperation flow, non-case-specific) ----
  {
    question: 'Who should I send the submission documents to?',
    answer: 'Not yet documented in this Knowledge Base — please confirm the correct internal contact/channel with Legal.' + DRAFT_SUFFIX,
    category: 'FAQ / Internal SOP', status: 'Draft',
  },
  {
    question: 'Where should I upload the documents?',
    answer: 'Not yet documented in this Knowledge Base — please confirm whether documents go through Legal Genie\'s Document Center, email, or another channel.' + DRAFT_SUFFIX,
    category: 'FAQ / Internal SOP', status: 'Draft',
  },
  {
    question: 'Who should I contact if I have questions?',
    answer: 'Not yet documented in this Knowledge Base — please confirm the designated contact person/team with Legal.' + DRAFT_SUFFIX,
    category: 'FAQ / Internal SOP', status: 'Draft',
  },
  {
    question: 'Can I submit a new game through Telegram?',
    answer: 'This depends on the final Telegram Bot design — document upload via Telegram is not yet confirmed as supported. Until confirmed, partners should use the existing submission channel.' + DRAFT_SUFFIX,
    category: 'FAQ / Internal SOP', status: 'Draft',
  },
  {
    question: 'What is the next step after submitting the documents?',
    answer: 'After submission, the case enters Legal\'s review/validation queue. Once all documents are complete and validated, Legal submits the case to PAGCOR and follows the standard follow-up schedule (a reminder is created 30 days after the Submit Date by default). You can check a case\'s current stage using the bot\'s case status lookup.',
    category: 'FAQ / Internal SOP', status: 'Pending Review',
  },
  {
    question: 'Who is handling my submission?',
    answer: 'This is case-specific — please look up the case to see its assigned Legal staff member, rather than relying on a general FAQ answer.',
    category: 'FAQ / Internal SOP', status: 'Pending Review',
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

  let created = 0, failed = 0, draftCount = 0;
  for (const faq of KB_FAQS) {
    const res = await fetch(`${BASE_URL}/api/kb-faqs`, { method: 'POST', headers, body: JSON.stringify(faq) });
    if (res.ok) {
      created++;
      if (faq.status === 'Draft') draftCount++;
      console.log(`  + [${faq.status}] ${faq.question}`);
    } else {
      failed++; console.error(`  ! failed: ${faq.question} —`, await res.text());
    }
  }
  console.log(`\nDone: ${created} created (${draftCount} marked Draft, need Legal review), ${failed} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
