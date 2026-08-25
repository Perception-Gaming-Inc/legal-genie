'use strict';
/**
 * Automated tests — Excel import column detection & row mapping
 * (server/import.js). Focused on the RTP / Jackpot RTP logic specifically,
 * since that's the newest, most compliance-critical part of the import
 * pipeline (the "combined RTP must stay under 97%" rule in server/ai.js
 * depends entirely on jackpotRtp being detected/parsed correctly here).
 *
 * Run with: node --test test/
 * (Node's built-in test runner — no extra npm install needed, Node 18+.)
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { detectColumns, mapRow, statusForStage } = require('../server/import.js');

test('detectRtpColumn prefers "Base Game RTP" over a jackpot-labeled RTP column', () => {
  // Real R88 template shape — see import.js's own comment on detectRtpColumn.
  const header = ['Game Name', 'Jackpot RTP%', 'Start Up%', 'Increment%', 'Base Game RTP %', 'Total Jackpot RTP %'];
  const map = detectColumns(header, null);
  assert.equal(header[map.rtp], 'Base Game RTP %');
});

test('detectRtpColumn falls back to a plain non-jackpot "rtp" column when there is no base/total-labeled one', () => {
  const header = ['Game Name', 'RTP (%)'];
  const map = detectColumns(header, null);
  assert.equal(header[map.rtp], 'RTP (%)');
});

test('detectJackpotRtpColumn prefers "Total Jackpot RTP" and excludes Start Up / Increment columns', () => {
  const header = ['Game Name', 'Jackpot RTP%', 'Start Up%', 'Increment%', 'Total Jackpot RTP %'];
  const map = detectColumns(header, null);
  assert.equal(header[map.jackpotRtp], 'Total Jackpot RTP %');
});

test('detectJackpotRtpColumn is undefined when the sheet has no jackpot RTP column at all', () => {
  const header = ['Game Name', 'RTP (%)', 'Minimum Bet', 'Maximum Bet'];
  const map = detectColumns(header, null);
  assert.equal(map.jackpotRtp, undefined);
});

test('mapRow converts an Excel fraction (<=1) to a percentage for both rtp and jackpotRtp', () => {
  const header = ['Game Name', 'Provider', 'Base Game RTP %', 'Total Jackpot RTP %', 'With Jackpot'];
  const colMap = detectColumns(header, null);
  // 0.9445 -> 94.45%, 0.02 -> 2%
  const row = ['Maya Gems', 'R88', 0.9445, 0.02, 'YES'];
  const mapped = mapRow(row, colMap, {}, 'R88', null);
  assert.equal(mapped.rtp, 94.45);
  assert.equal(mapped.jackpotRtp, 2);
  assert.equal(mapped.withJackpot, 'Yes');
});

test('mapRow leaves a value already >1 as-is (already a real percentage, not a raw fraction)', () => {
  const header = ['Game Name', 'Base Game RTP %'];
  const colMap = detectColumns(header, null);
  const row = ['Some Game', 94.45];
  const mapped = mapRow(row, colMap, {}, 'Sheet1', null);
  assert.equal(mapped.rtp, 94.45);
});

test('mapRow: jackpotRtp is null when the sheet has no jackpot RTP column (non-jackpot game)', () => {
  const header = ['Game Name', 'Base Game RTP %'];
  const colMap = detectColumns(header, null);
  const row = ['Some Game', 0.95];
  const mapped = mapRow(row, colMap, {}, 'Sheet1', null);
  assert.equal(mapped.jackpotRtp, null);
});

test('mapRow returns null (skips the row) when Game Name is blank', () => {
  const header = ['Game Name', 'Base Game RTP %'];
  const colMap = detectColumns(header, null);
  const row = ['', 0.95];
  const mapped = mapRow(row, colMap, {}, 'Sheet1', null);
  assert.equal(mapped, null);
});

test('statusForStage maps PAGCOR stages to the right case status', () => {
  assert.equal(statusForStage('Approved'), 'Closed');
  assert.equal(statusForStage('Rejected'), 'Closed');
  assert.equal(statusForStage('Pending Documents'), 'Open');
  assert.equal(statusForStage('Under Review'), 'In Progress');
});
