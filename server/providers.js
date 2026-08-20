'use strict';
/**
 * Canonical PAGCOR provider display names.
 *
 * Provider is a free-text field (New Case modal, Excel import, AI intake),
 * so the same real-world provider can end up typed multiple different ways
 * across cases — e.g. "OP" as shorthand for "Omniplay". Left alone, that
 * makes the Case Management provider filter, Excel-import grouping,
 * Telegram provider routing, and the Dashboard all treat them as two
 * separate providers instead of one.
 *
 * PROVIDER_ALIASES maps a lowercased, trimmed alias to the canonical
 * display name it should be stored as. canonicalProviderName() is applied
 * wherever a Provider value is saved (case create/update in routes.js,
 * Excel import in import.js) so every path converges on the same spelling.
 * Add new aliases here as they come up — no other code changes needed.
 */
const PROVIDER_ALIASES = {
  op: 'Omniplay',
  omniplay: 'Omniplay',
  // Added 2026-08-20 at Tiffany's request — "Fa Chai" (the sheet-name-
  // derived default Provider for her GALATIC_FACHAI_NOJACKPOT_17GAMES
  // import) is really the same provider she otherwise refers to as "FC".
  'fa chai': 'FC',
  'fachai': 'FC',
  'galatic_fa chai': 'FC',
};

function canonicalProviderName(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return s;
  const key = s.toLowerCase();
  return PROVIDER_ALIASES[key] || s;
}

module.exports = { canonicalProviderName, PROVIDER_ALIASES };
