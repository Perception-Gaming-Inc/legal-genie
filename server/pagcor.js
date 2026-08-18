'use strict';
/**
 * Shared PAGCOR-domain constants — the stage list for a "game submitted to
 * PAGCOR for a Letter of Approval" case. Kept as one small, dependency-free
 * module so routes.js (case-creation defaults) uses the exact same list
 * instead of a second copy drifting apart. The frontend (public/js/app.js)
 * can't `require()` this (it's plain browser JS, no bundler), so it keeps
 * its own matching copy of this same array — see PAGCOR_STAGE_OPTIONS near
 * the top of app.js's Case Management section. If you ever change the
 * wording here, update that copy too.
 *
 * This module also exports PAGCOR_CHECKLIST_ITEMS — a manual 3-item
 * "Game Manual / Parameter / RTP Certification" checkbox list tracked per
 * case, matching the columns in Tiffany's real tracking spreadsheet. This
 * was removed once (at Tiffany's request) when the AI Parameter
 * Consistency Check's documentCompleteness section started covering
 * similar "which required documents are missing" ground automatically —
 * but brought back 2026-08-12, also at her request, since she still wants
 * the simple manual checklist alongside the AI check rather than instead
 * of it. GET /api/cases/:id/download-all's "ready to download" gate
 * deliberately still only depends on the AI check (see that route in
 * routes.js) — the checklist here is informational/tracking only, it does
 * not gate anything.
 *
 * It was also previously used by server/assistant.js (the "AI Assistant"
 * chat feature, so the Provider/PAGCOR context in its system prompt matched
 * the same stage list) — that whole feature was removed at Tiffany's
 * request; see the removed /api/assistant/* routes in routes.js's history.
 */
// Changed 2026-08-12 at Tiffany's request from the earlier 6-stage list
// (Not Started / Preparing Documents / Submitted to PAGCOR / Under PAGCOR
// Review / LOA Approved / Rejected) to this simpler 5-stage one. Existing
// cases carrying an old stage value were migrated via
// scripts/migrate-pagcor-stages.js — see that file for the exact mapping.
const PAGCOR_STAGE_OPTIONS = [
  'Pending Documents',
  'For Review',
  'On Process',
  'Approved',
  'Rejected',
];

// Brought back 2026-08-12 — see the header comment above. This is now only
// the DEFAULT list, used to seed Settings > Required Document Settings'
// `checklistItems` the first time getSystemSettings() runs (see
// routes.js) — from that point on, the actual live list of checklist items
// lives in the `settings` row, not here, because 2026-08-12 (later the same
// day) Tiffany asked for these to be editable from the UI instead of fixed
// in code. Keys match the checklist field names stored on each case
// (case.checklist.<key>); server/import.js's Excel/CSV import matches
// column headers against each configured item's *label* dynamically (not
// hardcoded to these 3 anymore either) — see DEFAULT_CHECKLIST_ITEMS there.
// Changed 2026-08-18 at Tiffany's request to match the actual 3 required
// checklist documents shown on Galatic Events Corp's "New Game Application
// Process to PAGCOR" flowchart (Game Manual / RTP Certification / RNG
// Certification) — dropped 'parameter' since on that flowchart "Game
// Parameters (Jackpot/No Jackpot)" is a game attribute captured on the case
// itself (see withJackpot on the case form), not one of the three required
// document checklist items. Existing cases that already have a stored
// `checklist.parameter` value keep it in their data (harmless, just no
// longer surfaced anywhere since it's not in this list) — no migration
// needed since parseChecklist_-style merge logic only ever reads the keys
// it's told to.
const PAGCOR_CHECKLIST_ITEMS = [
  { key: 'gameManual', label: 'Game Manual' },
  { key: 'rtpCertification', label: 'RTP Certification' },
  { key: 'rngCertification', label: 'RNG Certification' },
];

module.exports = { PAGCOR_STAGE_OPTIONS, PAGCOR_CHECKLIST_ITEMS };
