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

// ---------------------------------------------------------------------------
// Column recognition
// ---------------------------------------------------------------------------
// Header text -> canonical field key. Matched case-insensitively after
// trimming, so "Game Name", "GAME NAME", " game name " all match the same
// alias. Listed in priority order per key isn't needed since each alias maps
// to exactly one key; first matching header wins if a sheet somehow repeats
// a header.
const COLUMN_ALIASES = {
  gameTitle: ['game name', 'game title', 'title'],
  provider: ['provider'],
  gameType: ['game type'],
  gameId: ['game id'],
  gameVersion: ['game version'],
  status: ['status'],
  dateReceived: ['date received'],
  withJackpot: ['with jackpot', 'jackpot'],
  remarks: ['remarks', 'remark', 'notes', 'note'],
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
function detectColumns(headerRow, checklistItems) {
  const items = checklistItems || DEFAULT_CHECKLIST_ITEMS;
  const map = { checklistCols: {} };
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
  return map;
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

  const provider = colMap.provider !== undefined
    ? (asTrimmedString(cell(row, colMap.provider)) || sheetSettings.provider || sheetName)
    : (sheetSettings.provider || sheetName);

  const pagcorStage = isApprovedRow ? 'Approved' : (sheetSettings.pagcorStage || 'Pending Documents');

  const remarks = asTrimmedString(cell(row, colMap.remarks));
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
    gameId: asTrimmedString(cell(row, colMap.gameId)),
    gameVersion: asTrimmedString(cell(row, colMap.gameVersion)),
    withJackpot: colMap.withJackpot !== undefined ? normalizeYesNo(cell(row, colMap.withJackpot)) : null,
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

// Finds the first row that looks like a real header (has at least 2
// non-empty cells) — tolerates a file that has a title/blank row above the
// actual header, though every sheet in the real workbook this was built
// against has the header on row 1.
function findHeaderRowIndex(rows) {
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
  const dataRows = sheet.rows.slice(headerIdx + 1);
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
