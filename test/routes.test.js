'use strict';
/**
 * Automated tests — Excel-import duplicate-game detection
 * (server/routes.js: buildExistingGameIndex / findExistingGameMatch /
 * titlesLikelySameGame). This is the logic behind the "這 X 個遊戲已經存在,
 * 要取代還是略過" prompt added 2026-08-25 — the exact feature that replaced
 * the silent-duplicate bug that created CASE-0039's two identical "Import
 * Source" documents. Tested here as pure logic (no store/network access),
 * via the `_testables` export routes.js attaches to its router purely for
 * this test file.
 *
 * Requires SUPABASE_URL=http://local-mock (see local-mock/README.md) so
 * requiring server/routes.js doesn't need a real Supabase project — see the
 * env vars set in package.json's "test" script.
 *
 * Run with: node --test test/
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../server/routes.js');
const { buildExistingGameIndex, findExistingGameMatch, titlesLikelySameGame } = router._testables;

// A modern multi-game case (games: [...]) and a legacy flat single-game case
// (gameTitle directly on the case), mirroring the two real shapes this
// system has on file — see buildExistingGameIndex's own comment.
const EXISTING_CASES = [
  {
    id: 'case-1',
    provider: 'R88',
    games: [
      { id: 'game-1', gameTitle: 'Maya Gems', gameId: 'MG-001' },
      { id: 'game-2', gameTitle: 'Fortune Panda', gameId: null },
    ],
  },
  {
    id: 'case-2-legacy',
    provider: 'Omniplay',
    gameTitle: 'Power of Odin',
    gameId: 'PO-777',
  },
];

test('findExistingGameMatch: matches a re-imported row by Game ID (multi-game case)', () => {
  const index = buildExistingGameIndex(EXISTING_CASES);
  const match = findExistingGameMatch({ provider: 'R88', gameTitle: 'Maya Gems (renamed)', gameId: 'MG-001' }, index);
  assert.ok(match);
  assert.equal(match.caseId, 'case-1');
  assert.equal(match.isLegacyFlat, false);
});

test('findExistingGameMatch: falls back to an exact Provider+Title match when there is no Game ID', () => {
  const index = buildExistingGameIndex(EXISTING_CASES);
  const match = findExistingGameMatch({ provider: 'R88', gameTitle: 'Fortune Panda', gameId: null }, index);
  assert.ok(match);
  assert.equal(match.gameRowId, 'game-2');
});

test('findExistingGameMatch: also catches duplicates against a legacy flat (single-game) case', () => {
  const index = buildExistingGameIndex(EXISTING_CASES);
  const match = findExistingGameMatch({ provider: 'Omniplay', gameTitle: 'Power of Odin', gameId: 'PO-777' }, index);
  assert.ok(match);
  assert.equal(match.caseId, 'case-2-legacy');
  assert.equal(match.isLegacyFlat, true);
});

test('findExistingGameMatch: returns null for a genuinely new game (no Title or Game ID collision)', () => {
  const index = buildExistingGameIndex(EXISTING_CASES);
  const match = findExistingGameMatch({ provider: 'R88', gameTitle: 'Brand New Game', gameId: 'NEW-001' }, index);
  assert.equal(match, null);
});

test('findExistingGameMatch: same Game Title under a DIFFERENT Provider is not a duplicate', () => {
  const index = buildExistingGameIndex(EXISTING_CASES);
  const match = findExistingGameMatch({ provider: 'Some Other Provider', gameTitle: 'Maya Gems', gameId: null }, index);
  assert.equal(match, null);
});

test('findExistingGameMatch: Provider+Title match is case-insensitive', () => {
  const index = buildExistingGameIndex(EXISTING_CASES);
  const match = findExistingGameMatch({ provider: 'r88', gameTitle: 'FORTUNE PANDA', gameId: null }, index);
  assert.ok(match);
});

// ---------------------------------------------------------------------------
// titlesLikelySameGame — used elsewhere (document-to-game matching) to catch
// punctuation-only typos like the real "CATLA_S MONEY MACHINE" vs
// "CATLA'S MONEY MACHINE" example from routes.js's own comment.
// ---------------------------------------------------------------------------
test('titlesLikelySameGame: punctuation-only difference still counts as the same game', () => {
  assert.equal(titlesLikelySameGame("CATLA'S MONEY MACHINE", 'CATLA_S MONEY MACHINE'), true);
});

test('titlesLikelySameGame: a short name embedded in a longer stylized one counts as the same game', () => {
  assert.equal(titlesLikelySameGame('Super Niubi Fortune', 'SuperNiubiFortuneX-huge'), true);
});

test('titlesLikelySameGame: two unrelated titles are not the same game', () => {
  assert.equal(titlesLikelySameGame('Maya Gems', 'Fortune Panda'), false);
});

test('titlesLikelySameGame: a short generic word is NOT enough to call two different long titles the same game', () => {
  // "ACE" is a substring of "ACE OF SPADES ULTRA" but that alone shouldn't
  // match it against an unrelated game that also happens to contain "ACE".
  assert.equal(titlesLikelySameGame('ACE', 'ACE OF SPADES ULTRA'), false);
});
