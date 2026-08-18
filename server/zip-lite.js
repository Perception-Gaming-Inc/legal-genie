'use strict';
/**
 * A tiny, dependency-free ZIP *writer* — the mirror image of xlsx-lite.js's
 * ZIP *reader* (see that file's comment for why: this project's sandbox has
 * no network access to the npm registry, so a package like `archiver` or
 * `jszip` literally cannot be installed here). Used by the Case detail
 * page's "Download All Documents" button (see server/routes.js's
 * GET /api/cases/:id/download-all) to bundle every document related to a
 * case into a single .zip the browser can save in one click.
 *
 * Only implements what that needs: a flat (or single-level-folder) set of
 * already-in-memory file buffers, DEFLATE-compressed via Node's built-in
 * zlib (which also exposes crc32() as of Node 22 — no separate CRC
 * implementation needed either). No streaming, no nested directories beyond
 * one prefix folder, no encryption/comments — a real-world PAGCOR submission
 * bundle is at most a few dozen small documents, so building the whole
 * archive in memory is simpler and plenty fast.
 */
const zlib = require('zlib');

const LOCAL_FILE_SIG = 0x04034b50;
const CENTRAL_DIR_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

// DOS date/time packing (ZIP's native timestamp format) — good enough for
// "when was this zip built", not meant to preserve each file's original
// upload time.
function dosDateTime(date) {
  const dosTime = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((Math.floor(date.getSeconds() / 2)) & 0x1f);
  const dosDate = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f);
  return { dosTime, dosDate };
}

/**
 * @param {Array<{name: string, data: Buffer}>} files — `name` is the path
 *   inside the archive (forward slashes; include a folder prefix like
 *   "CASE-0004 - Fortune Dragon/" to group everything under one top-level
 *   folder when extracted).
 * @returns {Buffer} the complete .zip file
 */
function buildZip(files) {
  const now = new Date();
  const { dosTime, dosDate } = dosDateTime(now);
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = zlib.crc32(data);
    const compressed = zlib.deflateRawSync(data);
    // DEFLATE can occasionally grow tiny/incompressible inputs — fall back
    // to storing uncompressed (method 0) rather than shipping bloated data.
    const useStore = compressed.length >= data.length;
    const method = useStore ? 0 : 8;
    const payload = useStore ? data : compressed;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(LOCAL_FILE_SIG, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    localChunks.push(localHeader, nameBuf, payload);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(CENTRAL_DIR_SIG, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal attributes
    centralHeader.writeUInt32LE(0, 38); // external attributes
    centralHeader.writeUInt32LE(offset, 42); // offset of local header

    centralChunks.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + payload.length;
  }

  const centralDirStart = offset;
  const centralDirBuf = Buffer.concat(centralChunks);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with central dir
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(centralDirStart, 16);
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localChunks, centralDirBuf, eocd]);
}

module.exports = { buildZip };
