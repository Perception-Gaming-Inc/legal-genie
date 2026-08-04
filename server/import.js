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
const pagcor = require('./pagcor');

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
  gameManual: ['game manual'],
  parameter: ['parameter'],
  rtpCertification: ['rtp certification', 'rtp cert', 'rtp'],
  remarks: ['remarks', 'remark', 'notes', 'note'],
};

function normalizeHeader(h) {
  return String(h == null ? '' : h).trim().toLowerCase().replace(/\s+/g, ' ');
}

function detectColumns(headerRow) {
  const map = {};
  headerRow.forEach((cell, idx) => {
    const norm = normalizeHeader(cell);
    if (!norm) return;
    for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (map[key] !== undefined) continue; // first match wins
      if (aliases.includes(norm)) map[key] = idx;
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

function normalizeYesNoToBool(raw) {
  const yn = normalizeYesNo(raw);
  return yn === 'Yes';
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

function statusForStage(stage) {
  if (stage === 'LOA Approved' || stage === 'Rejected') return 'Closed';
  if (stage === 'Not Started') return 'Open';
  return 'In Progress';
}

function checklistDefaultDoneForStage(stage) {
  // A stage of "Not Started" / "Preparing Documents" means the package
  // isn't complete yet; anything from "Submitted to PAGCOR" onward implies
  // the full package (incl. these 3 items) was already assembled.
  return !(stage === 'Not Started' || stage === 'Preparing Documents');
}

// ---------------------------------------------------------------------------
// Row -> Case mapping
// ---------------------------------------------------------------------------
/**
 * @param {any[]} row raw cell values for one data row
 * @param {object} colMap output of detectColumns()
 * @param {{provider?: string, pagcorStage?: string}} sheetSettings
 * @returns {object|null} a ready-to-insert case payload, or null to skip
 *   this row (no game name — covers blank spacer rows and "TOTAL" rows)
 */
function mapRow(row, colMap, sheetSettings, sheetName) {
  const gameTitle = asTrimmedString(cell(row, colMap.gameTitle));
  if (!gameTitle) return null;

  const rawStatus = asTrimmedString(cell(row, colMap.status));
  const isApprovedRow = rawStatus && rawStatus.toUpperCase() === 'APPROVED';

  const provider = colMap.provider !== undefined
    ? (asTrimmedString(cell(row, colMap.provider)) || sheetSettings.provider || sheetName)
    : (sheetSettings.provider || sheetName);

  const pagcorStage = isApprovedRow ? 'LOA Approved' : (sheetSettings.pagcorStage || 'Preparing Documents');

  const hasPerItemChecklist = colMap.gameManual !== undefined || colMap.parameter !== undefined || colMap.rtpCertification !== undefined;
  const defaultDone = checklistDefaultDoneForStage(pagcorStage);
  const pagcorChecklist = pagcor.PAGCOR_CHECKLIST_ITEMS.map((item) => {
    if (hasPerItemChecklist && colMap[item.key] !== undefined) {
      return { ...item, done: normalizeYesNoToBool(cell(row, colMap[item.key])) };
    }
    return { ...item, done: defaultDone };
  });

  const remarks = asTrimmedString(cell(row, colMap.remarks));
  const dateReceived = formatDateish(cell(row, colMap.dateReceived));
  const descParts = [`Imported from Excel (sheet: ${sheetName}).`];
  if (dateReceived) descParts.push(`Date received: ${dateReceived}.`);
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
    pagcorStage,
    pagcorChecklist,
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

function sheetToRows(sheet) {
  const headerIdx = findHeaderRowIndex(sheet.rows);
  if (headerIdx === -1) return { headerRow: [], dataRows: [], colMap: {} };
  const headerRow = sheet.rows[headerIdx];
  const colMap = detectColumns(headerRow);
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

function preview(buffer, fileName) {
  const sheets = loadWorkbook(buffer, fileName);
  return sheets.map((sheet) => {
    const { headerRow, dataRows, colMap } = sheetToRows(sheet);
    const suggestedProvider = suggestedProviderFromSheetName(sheet.name);
    const previewSettings = { provider: suggestedProvider, pagcorStage: 'Preparing Documents' };
    const mapped = [];
    for (const row of dataRows) {
      const m = mapRow(row, colMap, previewSettings, sheet.name);
      if (m) mapped.push(m);
      if (mapped.length >= 3) break;
    }
    let rowCount = 0;
    for (const row of dataRows) if (mapRow(row, colMap, previewSettings, sheet.name)) rowCount++;
    return {
      name: sheet.name,
      rowCount,
      hasProviderColumn: colMap.provider !== undefined,
      hasStatusColumn: colMap.status !== undefined,
      suggestedProvider,
      detectedColumns: Object.keys(colMap),
      headerRow: headerRow.filter((h) => h !== null && h !== undefined && String(h).trim() !== ''),
      sampleRows: mapped.map((m) => ({ title: m.title, provider: m.provider, gameType: m.gameType, pagcorStage: m.pagcorStage, status: m.status })),
    };
  });
}

function buildCasesForSheet(buffer, fileName, sheetName, settings) {
  const sheets = loadWorkbook(buffer, fileName);
  const sheet = sheets.find((s) => s.name === sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found in this file.`);
  const { dataRows, colMap } = sheetToRows(sheet);
  const out = [];
  for (const row of dataRows) {
    const m = mapRow(row, colMap, settings || {}, sheetName);
    if (m) out.push(m);
  }
  return out;
}

module.exports = { preview, buildCasesForSheet, detectColumns, mapRow };
