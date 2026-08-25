'use strict';
/**
 * "Import Excel/CSV" — bulk-creates Case records (PAGCOR game submissions)
 * from a spreadsheet, instead of typing each one in by hand. Built directly
 * against Tiffany's real tracking workbook ("PENDING GAME APPROVAL
 * APPLICATIONS.xlsx" — one sheet per Provider of pending submissions, plus
 * an "APPROVED" sheet of already-approved games with its own extra columns),
 * so the column-name recognition below is tuned to that real shape, but it's
 * written to tolerate reasonable header variations rather than hard-coding
 * exact positions.
 *
 * Two-step flow (mirrors why: bulk-creating ~300+ records sight-unseen would
 * be a bad experience if the column mapping guessed wrong):
 *   1. preview(buffer) — parse the file, detect columns per sheet, and
 *      return a summary (row counts + a few sample mapped rows) so the user
 *      can see what a "Provider" override / default "Stage" for a sheet
 *      would produce before committing to anything.
 *   2. buildCasesForSheet(buffer, sheetName, settings) — the same parsing,
 *      but returns the FULL set of ready-to-insert case objects for one
 *      sheet, using the user-confirmed settings (see routes.js for how this
 *      is turned into real store.insert('cases', ...) calls).
 *
 * Uses server/xlsx-lite.js (a small dependency-free .xlsx reader written for
 * this project — see that file's header comment for why) rather than an npm
 * package.
 */
const { readXlsx, excelSerialToIsoDate } = require('./xlsx-lite');
// Fallback checklist items used only when a caller doesn't pass its own
// (e.g. anything calling preview()/buildCasesForSheet() directly without
// going through routes.js's Settings-aware wrapper) — see the
// checklistItems param on detectColumns/mapRow/preview/buildCasesForSheet
// below. Actual live installs get their real, possibly-customized list
// from Settings > Required Document Settings via routes.js; this constant
// exists so import.js still behaves sensibly standalone.
const { PAGCOR_CHECKLIST_ITEMS: DEFAULT_CHECKLIST_ITEMS } = require('./pagcor');
const { canonicalProviderName } = require('./providers');

// ---------------------------------------------------------------------------
// Column recognition
// ---------------------------------------------------------------------------
// Header text -> canonical field key. Matched case-insensitively after
// trimming, so "Game Name", "GAME NAME", " game name " all match the same
// alias. Listed in priority order per key isn't needed since each alias maps
// to exactly one key; first matching header wins if a sheet somehow repeats
// a header.
const COLUMN_ALIASES = {
  // 'list of games' added 2026-08-20 after Tiffany's GALATIC_YBGAMES...xlsx
  // (Yellow Bat's own template) failed to import — its header row uses
  // "List of Games" instead of "Game Name"/"Game Title", which didn't match
  // any existing alias (exactly OR as a "contains" fuzzy match, since
  // "list of games" doesn't contain "game name"/"game title"/"title" as a
  // substring), so gameTitle came back undetected and every row was
  // silently skipped (0 rows) — see mapRow()'s `if (!gameTitle) return
  // null;` guard just below.
  gameTitle: ['game name', 'game title', 'title', 'list of games'],
  // 'manufacturer' added alongside the above — the same Yellow Bat template
  // labels its Provider column "Manufacturer" rather than "Provider".
  provider: ['provider', 'manufacturer'],
  gameType: ['game type'],
  gameId: ['game id'],
  // 'version' added alongside the above — same template again, just
  // "Version" rather than "Game Version".
  gameVersion: ['game version', 'version'],
  // Added 2026-08-20 at Tiffany's request, so the AI Parameter Consistency
  // Check (see server/ai.js's checkDocumentConsistency) has real submitted
  // values to compare each game's documents against, instead of only
  // checking whether documents agree with EACH OTHER. Matches the real
  // PAGCOR "Annex A — New Games Request for Approval" template's own
  // headers ("MINIMUM BET", "MAXIMUM BET", "Total RTP (%)").
  minBet: ['minimum bet'],
  maxBet: ['maximum bet'],
  rtp: ['total rtp (%)', 'total rtp', 'rtp (%)', 'rtp'],
  status: ['status'],
  dateReceived: ['date received'],
  withJackpot: ['with jackpot', 'jackpot'],
  remarks: ['remarks', 'remark', 'notes', 'note'],
  // Added 2026-08-20 at Tiffany's request, for sheets like her "Reskin
  // games" tab (see GALATIC_FACHAI_NOJACKPOT_17GAMES_071626.xlsx) that
  // list re-themed versions of games PAGCOR has already approved, mapped
  // one-to-one against the original game's title/ID (e.g. "Original Game
  // Title_Game ID" -> "Chinese New Year Moreways_22064 (PAGCOR Approved)").
  // These aren't brand-new games, so rather than importing them
  // indistinguishably from the other 17 real new-submission rows, mapRow()
  // below carries this through as `reskinOf` so routes.js's rowToGame()
  // can stamp it onto the game record and the UI (see gameCardHtml in
  // app.js) can show "Reskin of: <original>" on the card.
  reskinOf: ['original game title', 'original title', 'reskin of', 'based on'],
};

function normalizeHeader(h) {
  return String(h == null ? '' : h).trim().toLowerCase().replace(/\s+/g, ' ');
}

// checklistCols is matched separately from the fixed COLUMN_ALIASES above
// — since 2026-08-12 the checklist items themselves are configurable
// (Settings > Required Document Settings, see routes.js's
// getChecklistItems), so there's no fixed set of column keys to alias
// anymore. Instead, each configured item's own *label* is matched
// case-insensitively against the header row directly (so a "Game Manual"
// column still auto-maps to the "Game Manual" checklist item, but so would
// a newly-added "Content Provider Certification" item once someone adds a
// matching column to their sheet — no code change needed).
// RTP priority pass — must run before the generic per-column passes below.
// Real workbooks with progressive jackpots have MULTIPLE columns whose
// header contains "RTP" (e.g. PAGCOR's R88 template: "Jackpot RTP% / Start
// Up% / Increment%", "Total Jackpot RTP %", "Base Game RTP %" — found
// 2026-08-24 diagnosing why CASE-0039's imported RTP came back null). The
// generic "first column left-to-right wins" passes below would grab
// whichever RTP-labeled column appears first, which in this template is
// the jackpot-specific one ("N/A" for non-jackpot games, or a different,
// much smaller number for ones that have a jackpot) — NOT the actual
// base/total RTP PAGCOR cares about for compliance (matched against
// RTP_MIN_PERCENT..RTP_MAX_PERCENT in server/ai.js). Prefer, in order:
//   1. a header containing "base game rtp" (most specific — the real
//      submitted RTP for the base game)
//   2. a header containing "total rtp" but not "jackpot" (older templates'
//      plain "Total RTP (%)" column)
//   3. any header containing "rtp" but not "jackpot" at all
// Only if NONE of those exist does the generic fallback below get a
// chance to pick a jackpot-labeled RTP column — better than leaving rtp
// completely undetected, and identical to the old behavior for any sheet
// that has no jackpot-RTP column at all (the common case).
function detectRtpColumn(headerRow) {
  const normed = headerRow.map((c) => normalizeHeader(c));
  const nonJackpot = (i) => !normed[i].includes('jackpot');
  let idx = normed.findIndex((n, i) => n.includes('base game rtp') && nonJackpot(i));
  if (idx === -1) idx = normed.findIndex((n, i) => n.includes('total rtp') && nonJackpot(i));
  if (idx === -1) idx = normed.findIndex((n, i) => n.includes('rtp') && nonJackpot(i));
  return idx === -1 ? undefined : idx;
}

// Companion to detectRtpColumn above — picks out the JACKPOT-specific RTP
// column instead of the base-game one (added 2026-08-25, at Tiffany's
// request, so the combined-RTP compliance rule in server/ai.js's
// checkDocumentConsistency has a real submitted Jackpot RTP figure to add
// onto the base game RTP). Same real R88 template has multiple
// jackpot-labeled RTP-ish columns ("Jackpot RTP%", "Total Jackpot RTP %",
// "Start Up%", "Increment%") — only the two that are actually a jackpot RTP
// percentage should match; "start up" and "increment" describe how the pool
// seeds/grows, not a percentage of RTP, so they're explicitly excluded.
// Prefers "total jackpot rtp" (most specific) over a plain "jackpot rtp".
function detectJackpotRtpColumn(headerRow) {
  const normed = headerRow.map((c) => normalizeHeader(c));
  const isJackpotRtp = (i) => normed[i].includes('jackpot') && normed[i].includes('rtp')
    && !normed[i].includes('start up') && !normed[i].includes('increment');
  let idx = normed.findIndex((n, i) => n.includes('total jackpot rtp') && isJackpotRtp(i));
  if (idx === -1) idx = normed.findIndex((n, i) => isJackpotRtp(i));
  return idx === -1 ? undefined : idx;
}

function detectColumns(headerRow, checklistItems) {
  const items = checklistItems || DEFAULT_CHECKLIST_ITEMS;
  const map = { checklistCols: {} };
  const rtpIdx = detectRtpColumn(headerRow);
  if (rtpIdx !== undefined) map.rtp = rtpIdx;
  const jackpotRtpIdx = detectJackpotRtpColumn(headerRow);
  if (jackpotRtpIdx !== undefined) map.jackpotRtp = jackpotRtpIdx;
  headerRow.forEach((cell, idx) => {
    const norm = normalizeHeader(cell);
    if (!norm) return;
    for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (map[key] !== undefined) continue; // first match wins
      if (aliases.includes(norm)) map[key] = idx;
    }
    for (const item of items) {
      if (map.checklistCols[item.key] !== undefined) continue;
      if (normalizeHeader(item.label) === norm) map.checklistCols[item.key] = idx;
    }
  });
  // Second, looser pass — added 2026-08-20 after a real PAGCOR "Annex A" new-
  // game-request template (Tiffany's GALATIC_FACHAI_NOJACKPOT_17GAMES file)
  // failed to import: that official government form's own header row reads
  // "GAME NAME/ SPORTS/ MARKETS" and "GAME ID/ TABLE ID" — combined column
  // headers that don't equal any COLUMN_ALIASES entry exactly, so gameTitle
  // and gameId came back undetected and every row was silently skipped (0
  // rows). Only runs for whichever keys the exact pass above left
  // unmatched, and only accepts a CONTAINS match (e.g. "game name/ sports/
  // markets" contains "game name"), so a sheet that already matches exactly
  // (the common case — this session's earlier real import used plain "Game
  // Name"/"Game ID" columns) behaves identically to before; this is purely
  // a fallback for combined/annotated header text.
  headerRow.forEach((cellVal, idx) => {
    const norm = normalizeHeader(cellVal);
    if (!norm) return;
    for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (map[key] !== undefined) continue;
      if (aliases.some((alias) => norm.includes(alias))) map[key] = idx;
    }
  });
  return map;
}

// Added 2026-08-20 after Tiffany's Yellow Bat GALATIC_YBGAMES...xlsx
// template failed to import Minimum/Maximum Bet: that sheet's header is
// split across TWO rows — a parent label ("Bet (PHP)") in the header row,
// with "Minimum"/"Maximum" sub-labels in the row directly beneath it (the
// same shape a merged Excel header cell takes once unmerged — the parent
// text only appears once, in its own leftmost column, blank in the columns
// to its right until the next parent label starts). detectColumns() above
// only ever looks at a single row, so neither "Bet (PHP)" alone nor
// "Minimum"/"Maximum" alone matches COLUMN_ALIASES's "minimum bet"/"maximum
// bet" phrasing, and those columns silently come back undetected.
//
// This combines each sub-label with the nearest parent label above it
// (forward-filling blank parent cells the same way a merged cell's
// unmerged blanks need to inherit the one real label to their left) into
// phrases like "Minimum Bet (PHP)" / "Maximum Bet (PHP)", which DO match
// the ordinary aliases as a "contains" fuzzy match. Only ever fills in keys
// existingColMap left undetected — never overrides a confident single-row
// match — and only treats the row below the header as a real second header
// row (rather than the first actual data row) when every one of its
// non-blank cells reads like a short text label rather than real data
// (numbers, IDs, long free text), so a sheet that has no second header row
// at all is completely unaffected.
function detectTwoRowHeader(headerRow, subRow, existingColMap) {
  if (!subRow || !subRow.length) return { used: false, colMap: {} };
  const nonBlank = subRow.filter((v) => asTrimmedString(v) !== null);
  if (!nonBlank.length) return { used: false, colMap: {} };
  const looksLikeLabelRow = nonBlank.every((v) => {
    const s = asTrimmedString(v);
    return s !== null && s.length <= 30 && !/^-?\d+(\.\d+)?$/.test(s);
  });
  if (!looksLikeLabelRow) return { used: false, colMap: {} };

  const parents = [];
  let lastParent = '';
  headerRow.forEach((v, idx) => {
    const s = asTrimmedString(v);
    if (s) lastParent = s;
    parents[idx] = lastParent;
  });

  const colMap = {};
  let matchedAny = false;
  subRow.forEach((v, idx) => {
    const sub = asTrimmedString(v);
    if (!sub) return;
    const parent = parents[idx] || '';
    if (!parent) return; // no parent label to combine with — nothing to merge
    const combos = [normalizeHeader(`${sub} ${parent}`), normalizeHeader(`${parent} ${sub}`)];
    for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (existingColMap[key] !== undefined || colMap[key] !== undefined) continue;
      if (aliases.some((alias) => combos.some((combo) => combo.includes(alias)))) {
        colMap[key] = idx;
        matchedAny = true;
      }
    }
  });
  return { used: matchedAny, colMap };
}

// ---------------------------------------------------------------------------
// Value normalization
// ---------------------------------------------------------------------------
function cell(row, idx) {
  if (idx === undefined || idx === null) return null;
  const v = row[idx];
  return v === undefined ? null : v;
}

function asTrimmedString(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  const s = String(v).trim();
  return s === '' ? null : s;
}

// Bet amounts (MINIMUM BET / MAXIMUM BET) — plain numbers in the real
// workbook (e.g. 0.5, 1000). Returns null for blank/non-numeric cells
// rather than 0, so "not filled in" stays distinguishable from "really is
// zero" downstream (checkDocumentConsistency in server/ai.js treats null as
// "no expected value to compare against").
function asNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(/[, ]+/g, ''));
  return Number.isFinite(n) ? n : null;
}

// RTP — Excel stores a "%"-formatted cell as its underlying fraction (0.9445
// for what's displayed as "94.45%"), but someone can also just type a plain
// number like "94.45" directly into an unformatted cell. Both appear in real
// workbooks, so: a value already >1 is assumed to already be a percentage
// and passed through; anything <=1 is assumed to be the raw Excel fraction
// and scaled up. Always returns a percentage number (94.45), never a
// fraction, so it lines up 1:1 with the percentages written in RTP
// verification/evaluation report documents.
function asRtpPercent(v) {
  const n = asNumber(v);
  if (n === null) return null;
  return n <= 1 ? Math.round(n * 100 * 100) / 100 : Math.round(n * 100) / 100;
}

function normalizeGameType(raw) {
  const s = asTrimmedString(raw);
  if (!s) return null;
  const norm = s.toUpperCase().replace(/[\s-]+/g, ' ').trim();
  if (norm === 'SLOTS' || norm === 'SLOT') return 'Slots';
  if (norm === 'ARCADE TYPE' || norm === 'ARCADE-TYPE') return 'Arcade-Type';
  if (norm === 'TABLE') return 'Table';
  if (norm === 'EBINGO') return 'eBingo';
  return 'Other';
}

// Handles the mix this real data actually has: real booleans (true/false),
// "YES"/"NO"/"NONE" strings (NONE meaning "no", as used for With Jackpot),
// and blanks. Returns 'Yes' / 'No' / null (null = genuinely unknown/blank).
function normalizeYesNo(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
  const s = String(raw).trim().toUpperCase();
  if (s === 'YES' || s === 'Y' || s === 'TRUE') return 'Yes';
  if (s === 'NO' || s === 'N' || s === 'NONE' || s === 'FALSE') return 'No';
  return null;
}

// A given "date-ish" cell might come through as a real Excel date serial
// (number) or as free text someone typed directly into the cell (e.g. "March
// 12, 2026") — both appear in the same column in the real workbook this was
// built against. Only serial numbers can be converted with confidence;
// text is passed through as-is rather than guessed at.
function formatDateish(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return excelSerialToIsoDate(raw) || String(raw);
  return String(raw).trim() || null;
}

// Sheet tab names like "FC" / "JDB" / "VP" are already good short Provider
// codes and are left as-is; longer ones like "YELLOW BAT" / "VERTEX PLAY"
// read as shouting in the UI, so those get Title Cased. This is only ever
// a *suggested default* — the person importing can always override the
// Provider name per sheet before committing.
function suggestedProviderFromSheetName(name) {
  const trimmed = String(name || '').trim();
  if (trimmed.length <= 3) return trimmed.toUpperCase();
  return trimmed
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Checklist columns (Game Manual / Parameter / RTP Certification) use the
// same YES/TRUE/NO/blank vocabulary as With Jackpot, but the checklist
// stores real booleans (checkbox state), not a Yes/No/null tri-state — an
// unrecognized or blank cell defaults to "not done yet" (false) rather than
// leaving it ambiguous, since that's the safer default for a compliance
// checklist (better to under-claim completeness than over-claim it).
function normalizeChecklistBool(raw) {
  return normalizeYesNo(raw) === 'Yes';
}

function statusForStage(stage) {
  if (stage === 'Approved' || stage === 'Rejected') return 'Closed';
  if (stage === 'Pending Documents') return 'Open';
  return 'In Progress';
}

// ---------------------------------------------------------------------------
// Row -> Case mapping
// ---------------------------------------------------------------------------
/**
 * @param {any[]} row raw cell values for one data row
 * @param {object} colMap output of detectColumns()
 * @param {{provider?: string, pagcorStage?: string}} sheetSettings
 * @param {string} sheetName
 * @param {Array<{key: string, label: string}>} [checklistItems] the
 *   currently-configured PAGCOR Checklist items (Settings > Required
 *   Document Settings) — defaults to DEFAULT_CHECKLIST_ITEMS if omitted.
 * @returns {object|null} a ready-to-insert case payload, or null to skip
 *   this row (no game name — covers blank spacer rows and "TOTAL" rows)
 */
function mapRow(row, colMap, sheetSettings, sheetName, checklistItems) {
  const gameTitle = asTrimmedString(cell(row, colMap.gameTitle));
  if (!gameTitle) return null;

  const rawStatus = asTrimmedString(cell(row, colMap.status));
  const isApprovedRow = rawStatus && rawStatus.toUpperCase() === 'APPROVED';

  // Normalize Provider spelling (e.g. "OP" -> "Omniplay") so an Excel sheet
  // using a shorthand doesn't fragment into a separate provider/case group
  // from one already using the full name — see server/providers.js.
  const provider = canonicalProviderName(colMap.provider !== undefined
    ? (asTrimmedString(cell(row, colMap.provider)) || sheetSettings.provider || sheetName)
    : (sheetSettings.provider || sheetName));

  const pagcorStage = isApprovedRow ? 'Approved' : (sheetSettings.pagcorStage || 'Pending Documents');

  const remarks = asTrimmedString(cell(row, colMap.remarks));
  // See the reskinOf alias comment above — carries the original approved
  // game's title/ID through untouched (e.g. "Chinese New Year
  // Moreways_22064 (PAGCOR Approved)") so it can be stamped onto the game
  // record rather than silently dropped.
  const reskinOf = colMap.reskinOf !== undefined ? asTrimmedString(cell(row, colMap.reskinOf)) : null;
  // dateReceived used to only be folded into the free-text description
  // below; since 2026-08-12 it's a real field on the case (see
  // caseFormFields() in app.js and the "Date Received" table column in
  // renderCases()) at Tiffany's request, so it's no longer duplicated into
  // the description text here.
  const dateReceived = formatDateish(cell(row, colMap.dateReceived));
  const descParts = [`Imported from Excel (sheet: ${sheetName}).`];
  if (remarks) descParts.push(`Remarks: ${remarks}.`);

  return {
    title: gameTitle,
    type: 'Regulatory',
    priority: 'Medium',
    status: statusForStage(pagcorStage),
    provider,
    gameTitle,
    gameType: normalizeGameType(cell(row, colMap.gameType)),
    // Guards against a combined header like "Re Skin Game Title_Game ID"
    // (see the reskinOf alias comment above) matching BOTH gameTitle and
    // gameId to the exact same column — without this, gameId would just
    // duplicate the title text verbatim, which is never a real ID and would
    // be actively misleading if this row ends up as its own case (e.g. a
    // reskin row that finds no Game-ID match to merge onto — see routes.js's
    // import commit handler).
    gameId: (colMap.gameId !== undefined && colMap.gameId !== colMap.gameTitle)
      ? asTrimmedString(cell(row, colMap.gameId))
      : null,
    gameVersion: asTrimmedString(cell(row, colMap.gameVersion)),
    minBet: colMap.minBet !== undefined ? asNumber(cell(row, colMap.minBet)) : null,
    maxBet: colMap.maxBet !== undefined ? asNumber(cell(row, colMap.maxBet)) : null,
    rtp: colMap.rtp !== undefined ? asRtpPercent(cell(row, colMap.rtp)) : null,
    jackpotRtp: colMap.jackpotRtp !== undefined ? asRtpPercent(cell(row, colMap.jackpotRtp)) : null,
    withJackpot: colMap.withJackpot !== undefined ? normalizeYesNo(cell(row, colMap.withJackpot)) : null,
    reskinOf,
    dateReceived,
    checklist: Object.fromEntries((checklistItems || DEFAULT_CHECKLIST_ITEMS).map((item) => [
      item.key,
      normalizeChecklistBool(cell(row, (colMap.checklistCols || {})[item.key])),
    ])),
    pagcorStage,
    pagcorStageChangedAt: new Date().toISOString(),
    description: descParts.join(' '),
    // Not persisted on the Case itself (routes.js strips this before
    // insert) — flags a row as coming from an "APPROVED"-style row (a sheet
    // with its own Status column reading "APPROVED") so routes.js's import
    // commit handler can prefer it over a same-game row from a different
    // sheet (e.g. a Provider's own pending-list tab that hasn't been
    // updated since the game was actually approved elsewhere).
    isApprovedRow,
  };
}

// Finds the first row that looks like a real header. Two passes:
//
// 1. Prefer a row containing a cell whose text CONTAINS "game name" or
//    "game title" — a strong, near-unambiguous signal for the real header,
//    since that's always present on a real game-submission sheet. Added
//    2026-08-20: a real official PAGCOR "Annex A" template (Tiffany's
//    GALATIC_FACHAI_NOJACKPOT_17GAMES file) puts a
//    "GAME CONTENT PROVIDER: | <name>" label row above the actual header —
//    that label row has exactly 2 non-empty cells (the label + the
//    provider name), so the old single-pass "first row with >= 2 non-empty
//    cells" heuristic below picked IT as the header instead of the real one
//    a few rows further down, and every data row was silently skipped as a
//    result (see detectColumns()'s matching comment for the other half of
//    that bug).
// 2. Falls back to the original heuristic — first row with >= 2 non-empty
//    cells — when no row matches pass 1, so a sheet using different wording
//    entirely (e.g. only "Title", no "Game Name") still gets a best-effort
//    header guess instead of failing outright.
function findHeaderRowIndex(rows) {
  for (let i = 0; i < rows.length; i++) {
    const hasStrongSignal = (rows[i] || []).some((v) => {
      const norm = normalizeHeader(v);
      return norm.includes('game name') || norm.includes('game title');
    });
    if (hasStrongSignal) return i;
  }
  for (let i = 0; i < rows.length; i++) {
    const nonEmpty = (rows[i] || []).filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    if (nonEmpty.length >= 2) return i;
  }
  return -1;
}

function sheetToRows(sheet, checklistItems) {
  const headerIdx = findHeaderRowIndex(sheet.rows);
  if (headerIdx === -1) return { headerRow: [], dataRows: [], colMap: { checklistCols: {} } };
  const headerRow = sheet.rows[headerIdx];
  const colMap = detectColumns(headerRow, checklistItems);
  // See detectTwoRowHeader()'s own header comment — handles templates like
  // "Bet (PHP)" / "Minimum" / "Maximum" split across the header row and the
  // row directly beneath it. Only ever fills in colMap keys the single-row
  // pass above left undetected, and only consumes (skips) that second row
  // as data when it actually looks like sub-header labels rather than a
  // real first data row.
  const twoRowHeader = detectTwoRowHeader(headerRow, sheet.rows[headerIdx + 1], colMap);
  if (twoRowHeader.used) Object.assign(colMap, twoRowHeader.colMap);
  const dataRows = sheet.rows.slice(headerIdx + (twoRowHeader.used ? 2 : 1));
  return { headerRow, dataRows, colMap };
}

// ---------------------------------------------------------------------------
// CSV support (kept intentionally simple — one sheet, comma-separated,
// double-quote escaping only; good enough for a plain CSV export)
// ---------------------------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------
function loadWorkbook(buffer, fileName) {
  const isCsv = /\.csv$/i.test(fileName || '');
  if (isCsv) {
    const rows = parseCsv(buffer.toString('utf8'));
    return [{ name: (fileName || 'Sheet1').replace(/\.csv$/i, ''), rows }];
  }
  return readXlsx(buffer);
}

function preview(buffer, fileName, checklistItems) {
  const sheets = loadWorkbook(buffer, fileName);
  return sheets.map((sheet) => {
    const { headerRow, dataRows, colMap } = sheetToRows(sheet, checklistItems);
    const suggestedProvider = suggestedProviderFromSheetName(sheet.name);
    const previewSettings = { provider: suggestedProvider, pagcorStage: 'Pending Documents' };
    const mapped = [];
    for (const row of dataRows) {
      const m = mapRow(row, colMap, previewSettings, sheet.name, checklistItems);
      if (m) mapped.push(m);
      if (mapped.length >= 3) break;
    }
    let rowCount = 0;
    for (const row of dataRows) if (mapRow(row, colMap, previewSettings, sheet.name, checklistItems)) rowCount++;
    // checklistCols is an { itemKey: colIndex } object, not a plain matched
    // column key like the rest of colMap — flattened into its own
    // "checklist:<key>" entries here so detectedColumns stays a flat list
    // of strings instead of leaking that internal shape.
    const { checklistCols, ...restColMap } = colMap;
    const detectedColumns = [
      ...Object.keys(restColMap),
      ...Object.keys(checklistCols || {}).map((key) => `checklist:${key}`),
    ];
    return {
      name: sheet.name,
      rowCount,
      hasProviderColumn: colMap.provider !== undefined,
      hasStatusColumn: colMap.status !== undefined,
      suggestedProvider,
      detectedColumns,
      headerRow: headerRow.filter((h) => h !== null && h !== undefined && String(h).trim() !== ''),
      sampleRows: mapped.map((m) => ({ title: m.title, provider: m.provider, gameType: m.gameType, pagcorStage: m.pagcorStage, status: m.status })),
    };
  });
}

function buildCasesForSheet(buffer, fileName, sheetName, settings, checklistItems) {
  const sheets = loadWorkbook(buffer, fileName);
  const sheet = sheets.find((s) => s.name === sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found in this file.`);
  const { dataRows, colMap } = sheetToRows(sheet, checklistItems);
  const out = [];
  for (const row of dataRows) {
    const m = mapRow(row, colMap, settings || {}, sheetName, checklistItems);
    if (m) out.push(m);
  }
  return out;
}

module.exports = { preview, buildCasesForSheet, detectColumns, mapRow, statusForStage };
