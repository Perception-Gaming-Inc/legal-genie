'use strict';
/**
 * A tiny, dependency-free .xlsx reader — used by the Case Management "Import
 * Excel/CSV" feature (see server/import.js). Written from scratch instead of
 * pulling in a package like `xlsx`/`exceljs` because this project's sandbox
 * has no network access to the npm registry when this was built, so any new
 * dependency literally could not be installed. An .xlsx file is just a ZIP
 * archive of XML files, and ZIP's "deflate" compression is exactly what
 * Node's built-in `zlib.inflateRawSync` already understands — so no ZIP or
 * XML library is actually required, just careful binary/string parsing.
 *
 * This only implements the subset needed to read plain data tables (sheet
 * names, header row, data rows as arrays of primitive values). It does NOT
 * handle formulas, merged-cell layout, styles/formatting, or embedded
 * objects — none of that matters for reading in tabular tracking data.
 */
const zlib = require('zlib');

// ---------------------------------------------------------------------------
// Minimal ZIP central-directory reader
// ---------------------------------------------------------------------------
function readZip(buffer) {
  const EOCD_SIG = 0x06054b50;
  let eocdOffset = -1;
  // The End Of Central Directory record is near the end of the file; scan
  // backwards (it's a fixed 22-byte record when there's no zip comment,
  // but we search a little further back just in case one exists).
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 65536); i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) { eocdOffset = i; break; }
  }
  if (eocdOffset === -1) throw new Error('This does not look like a valid .xlsx file (no ZIP end-of-directory record found).');

  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
  const cdEntryCount = buffer.readUInt16LE(eocdOffset + 10);

  const entries = {};
  let offset = cdOffset;
  const CDH_SIG = 0x02014b50;
  for (let i = 0; i < cdEntryCount; i++) {
    if (buffer.readUInt32LE(offset) !== CDH_SIG) break;
    const compMethod = buffer.readUInt16LE(offset + 10);
    const compSize = buffer.readUInt32LE(offset + 20);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLen);
    entries[name] = { compMethod, compSize, localHeaderOffset };
    offset += 46 + nameLen + extraLen + commentLen;
  }

  function readEntry(name) {
    const entry = entries[name];
    if (!entry) return null;
    const lh = entry.localHeaderOffset;
    const nameLen = buffer.readUInt16LE(lh + 26);
    const extraLen = buffer.readUInt16LE(lh + 28);
    const dataStart = lh + 30 + nameLen + extraLen;
    const compressed = buffer.subarray(dataStart, dataStart + entry.compSize);
    if (entry.compMethod === 0) return Buffer.from(compressed);
    if (entry.compMethod === 8) return zlib.inflateRawSync(compressed);
    throw new Error(`Unsupported .xlsx internal compression method (${entry.compMethod}) for ${name}`);
  }

  return { names: Object.keys(entries), readEntry };
}

// ---------------------------------------------------------------------------
// Tiny XML helpers (regex-based — good enough for the well-known, machine-
// generated XML shapes inside an .xlsx; not a general-purpose XML parser)
// ---------------------------------------------------------------------------
function unescapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&');
}

function attr(tag, name) {
  const m = new RegExp(`${name}="([^"]*)"`).exec(tag);
  return m ? unescapeXml(m[1]) : null;
}

function colLettersToIndex(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1; // 0-based
}

// ---------------------------------------------------------------------------
// Shared strings (xl/sharedStrings.xml) — every <si> may contain plain
// <t>text</t> or multiple rich-text <r><t>...</t></r> runs; concatenate all
// text nodes within each <si> to get that entry's real string value.
// ---------------------------------------------------------------------------
function parseSharedStrings(xml) {
  if (!xml) return [];
  const text = xml.toString('utf8');
  const items = [];
  const siRe = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(text))) {
    const inner = m[1];
    let combined = '';
    const tRe = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
    let tm;
    while ((tm = tRe.exec(inner))) combined += unescapeXml(tm[1]);
    items.push(combined);
  }
  return items;
}

// ---------------------------------------------------------------------------
// Workbook + relationships — sheet order/names, and which worksheetN.xml
// file each sheet actually lives in (sheet order in workbook.xml doesn't
// always match the worksheet file numbering).
// ---------------------------------------------------------------------------
function parseWorkbookSheets(workbookXml, relsXml) {
  const wbText = workbookXml.toString('utf8');
  const relsText = relsXml ? relsXml.toString('utf8') : '';

  const relTarget = {};
  const relRe = /<Relationship\s[^>]*\/>/g;
  let rm;
  while ((rm = relRe.exec(relsText))) {
    const tag = rm[0];
    const id = attr(tag, 'Id');
    const target = attr(tag, 'Target');
    if (id && target) relTarget[id] = target.replace(/^\/?xl\//, '').replace(/^\.?\//, '');
  }

  const sheets = [];
  const sheetRe = /<sheet\s[^>]*\/>/g;
  let sm;
  while ((sm = sheetRe.exec(wbText))) {
    const tag = sm[0];
    const name = attr(tag, 'name');
    const rId = attr(tag, 'r:id') || attr(tag, 'r:id ');
    const target = rId && relTarget[rId] ? relTarget[rId] : null;
    sheets.push({ name, path: target ? `xl/${target}` : null });
  }
  return sheets;
}

// ---------------------------------------------------------------------------
// A single worksheetN.xml -> array of rows, each row an array of cell values
// (index = 0-based column position; gaps for empty cells are `null`).
// Numbers that look like Excel date serials are left as raw numbers — the
// caller decides whether/how to interpret a given column as a date, since
// that needs column-name context this module doesn't have.
// ---------------------------------------------------------------------------
function parseSheet(sheetXml, sharedStrings) {
  const text = sheetXml.toString('utf8');
  const rows = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRe.exec(text))) {
    const rowInner = rm[1];
    const row = [];
    const cellRe = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    while ((cm = cellRe.exec(rowInner))) {
      const attrs = cm[1];
      const cellInner = cm[2] || '';
      const refMatch = /r="([A-Z]+)\d+"/.exec(attrs);
      if (!refMatch) continue;
      const colIdx = colLettersToIndex(refMatch[1]);
      const type = (/t="([^"]*)"/.exec(attrs) || [])[1];

      let value = null;
      if (type === 's') {
        const vMatch = /<v>([\s\S]*?)<\/v>/.exec(cellInner);
        value = vMatch ? (sharedStrings[parseInt(vMatch[1], 10)] ?? null) : null;
      } else if (type === 'inlineStr') {
        const tMatch = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/.exec(cellInner);
        value = tMatch ? unescapeXml(tMatch[1]) : null;
      } else if (type === 'b') {
        const vMatch = /<v>([\s\S]*?)<\/v>/.exec(cellInner);
        value = vMatch ? vMatch[1] === '1' : null;
      } else if (type === 'str') {
        const vMatch = /<v>([\s\S]*?)<\/v>/.exec(cellInner);
        value = vMatch ? unescapeXml(vMatch[1]) : null;
      } else {
        // Numeric (or empty) cell — no `t` attribute, or t="n".
        const vMatch = /<v>([\s\S]*?)<\/v>/.exec(cellInner);
        value = vMatch && vMatch[1] !== '' ? Number(vMatch[1]) : null;
      }
      row[colIdx] = value;
    }
    // Fill any gaps left by skipped/empty columns so row.length is consistent.
    for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = null;
    rows.push(row);
  }
  return rows;
}

// Excel's date "epoch" is 1899-12-30 (it has a well-known but harmless bug
// modeling 1900 as a leap year, which every spreadsheet tool shares, so we
// intentionally don't correct for it here — this matches what Excel itself
// displays). Only call this on a column you already know should be a date.
function excelSerialToIsoDate(serial) {
  if (typeof serial !== 'number' || !isFinite(serial)) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000); // 25569 = days between 1899-12-30 and 1970-01-01
  const d = new Date(ms);
  if (isNaN(d)) return null;
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
/**
 * @param {Buffer} buffer raw .xlsx file bytes
 * @returns {{name: string, rows: any[][]}[]} one entry per sheet, in
 *   workbook order, each `rows` a plain array-of-arrays (row 0 is whatever
 *   the first non-empty row in the sheet is — usually the header row, but
 *   the caller should still sanity-check it).
 */
function readXlsx(buffer) {
  const zip = readZip(buffer);
  const workbookXml = zip.readEntry('xl/workbook.xml');
  if (!workbookXml) throw new Error('This .xlsx file is missing xl/workbook.xml — it may be corrupted or not a real Excel file.');
  const relsXml = zip.readEntry('xl/_rels/workbook.xml.rels');
  const sharedStringsXml = zip.readEntry('xl/sharedStrings.xml');
  const sharedStrings = parseSharedStrings(sharedStringsXml);
  const sheetDefs = parseWorkbookSheets(workbookXml, relsXml);

  return sheetDefs.map((def, idx) => {
    // Fall back to the conventional xl/worksheets/sheetN.xml path (1-based,
    // in workbook order) if relationship resolution didn't find a path —
    // covers the common case where the .rels file is laid out simply.
    const path = def.path || `xl/worksheets/sheet${idx + 1}.xml`;
    const sheetXml = zip.readEntry(path);
    const rows = sheetXml ? parseSheet(sheetXml, sharedStrings) : [];
    return { name: def.name, rows };
  });
}

// Used by server/ai.js's filePart(): AI smart-fill (extractFields, the
// consistency check, etc.) sends Gemini either inlineData (PDF/images) or a
// plain `text` part — there's no third "spreadsheet" input type, so an
// .xlsx upload gets converted to a flat tab-separated text table instead
// and sent the same way a pasted-in text excerpt would be. Reuses
// readXlsx() above rather than re-parsing the file a second way, so both
// the Excel-import feature and AI smart-fill stay behind one xlsx reader.
const MAX_XLSX_TEXT_CHARS = 60000; // keeps the AI prompt a sane size for very large workbooks
function xlsxToText(buffer) {
  const sheets = readXlsx(buffer);
  if (!sheets.length || sheets.every((s) => !s.rows.length)) {
    throw new Error('No worksheet content was found in this .xlsx file.');
  }
  const cellText = (v) => (v === null || v === undefined ? '' : String(v));
  let out = '';
  let truncated = false;
  for (const sheet of sheets) {
    if (truncated) break;
    const label = sheets.length > 1 ? `[Sheet: ${sheet.name || '(unnamed)'}]\n` : '';
    const sheetText = `${label}${sheet.rows.map((r) => r.map(cellText).join('\t')).join('\n')}\n`;
    if (out.length + sheetText.length > MAX_XLSX_TEXT_CHARS) {
      out += sheetText.slice(0, Math.max(0, MAX_XLSX_TEXT_CHARS - out.length));
      truncated = true;
    } else {
      out += sheetText;
    }
  }
  if (truncated) out += '\n...(content too long, truncated)';
  return out.trim();
}

module.exports = { readXlsx, excelSerialToIsoDate, xlsxToText };
