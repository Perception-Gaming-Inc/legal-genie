'use strict';
/**
 * Shared PAGCOR-domain constants — the standard checklist and stage list for
 * a "game submitted to PAGCOR for a Letter of Approval" case. Kept as one
 * small, dependency-free module so both routes.js (case-creation defaults)
 * and assistant.js (AI Assistant context/prompt) use the exact same list
 * instead of two copies drifting apart. The frontend (public/js/app.js)
 * can't `require()` this (it's plain browser JS, no bundler), so it keeps
 * its own matching copy of these same arrays — see PAGCOR_STAGE_OPTIONS /
 * PAGCOR_CHECKLIST_ITEMS near the top of app.js's Case Management section.
 * If you ever change the wording/keys here, update that copy too.
 */
const PAGCOR_STAGE_OPTIONS = [
  'Not Started',
  'Preparing Documents',
  'Submitted to PAGCOR',
  'Under PAGCOR Review',
  'LOA Approved',
  'Rejected',
];

// Updated to match the exact 3 items Tiffany's team actually tracks per
// game submission (confirmed against her real "PENDING GAME APPROVAL
// APPLICATIONS.xlsx" tracking sheet's APPROVED tab, which records these
// three as separate yes/no columns per game — not the originally-guessed
// Math Model / RNG Report / Cover Letter / Fee Proof list, which didn't
// match how her team actually tracks this). "With Jackpot" is a game
// attribute (see the `withJackpot` case field), not a checklist item.
const PAGCOR_CHECKLIST_ITEMS = [
  { key: 'gameManual', label: 'Game Manual' },
  { key: 'parameter', label: 'Parameter' },
  { key: 'rtpCertification', label: 'RTP Certification' },
];

function defaultChecklist() {
  return PAGCOR_CHECKLIST_ITEMS.map((item) => ({ ...item, done: false }));
}

module.exports = { PAGCOR_STAGE_OPTIONS, PAGCOR_CHECKLIST_ITEMS, defaultChecklist };
