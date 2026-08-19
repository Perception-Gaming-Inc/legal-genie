'use strict';
/**
 * "Import Approval Notice" — matches games from a real PAGCOR "Notice of
 * Approval" letter (read by AI in server/ai.js's extractApprovalNotice,
 * since these letters are usually scanned images with no text layer) up
 * against Tiffany's own tracked cases, and auto-advances any matched case's
 * PAGCOR Stage to "Approved" without her having to manually look each
 * one up or update it by hand.
 *
 * An earlier version of this feature instead cross-referenced PAGCOR's own
 * public "List of EGLD-approved Electronic Games" PDFs (one per accredited
 * provider/brand, at https://www.pagcor.ph/regulatory/pdf/App%20Kits/).
 * That was removed by explicit request: those public PDFs lag real
 * approvals by weeks in practice (Tiffany's own notice letters arrive well
 * before PAGCOR's batch-published list catches up), so daily-checking them
 * was providing little real value over just acting on the notice letter
 * directly, and the PDF-parsing logic that PAGCOR's own text layout
 * required was itself a maintenance burden the daily cron job carried for
 * hardly any benefit. This file now only contains the notice-matching
 * logic; the PDF-fetching/parsing code and its pdf-parse dependency have
 * been removed entirely along with it.
 */

// "Omniplay", "OMNIPLAY", "omni-play", " Omniplay " all normalize the same
// way, so Provider field spelling/casing quirks in her data don't cause an
// otherwise-correct provider match to be missed.
function normalizeProviderKey(provider) {
  return String(provider || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Loose (case/punctuation/whitespace-insensitive) title comparison — used
// only as a FALLBACK match in applyApprovalNoticeGames below, when a notice
// doesn't state a Game ID. Mirrors the same "ignore punctuation, not
// meaning" spirit as the existing Excel-import de-dup logic elsewhere in
// this project (see server/import.js's Stage 2.5 collision handling).
function normalizeTitleForMatch(title) {
  return String(title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Applies the games extracted from a real PAGCOR "Notice of Approval"
// letter (via server/ai.js's extractApprovalNotice) against the actual
// case list. Does NOT require the case's Provider to be any particular
// known brand — any case can match here, since the source of truth is the
// notice letter itself, not a pre-known provider list.
//
// Matching is deliberately conservative, because a wrong auto-approval is
// far worse than one that needs a human to resolve by hand: exact Game ID
// match (case-insensitive, trimmed) is the primary and preferred path. A
// notice game with no Game ID, or one whose Game ID doesn't match any case,
// falls back to an exact (punctuation/case-insensitive) title match against
// either the case's title or its Game Title field — but ONLY when that
// narrows to exactly one case. Anything that resolves to zero or 2+
// candidate cases is reported back as unmatched/ambiguous instead of being
// guessed at, so the user can resolve it themselves.
// Multi-game case (Phase 2): flattens every case into one candidate entry
// per game — a legacy flat case contributes one entry with `game: null`
// (its own fields ARE the game), a multi-game case contributes one entry
// per item in `games[]` — so a notice game can match a specific game inside
// a multi-game Provider case, not just a whole (necessarily single-game)
// case as before.
function candidateEntries(cases) {
  const out = [];
  for (const c of cases) {
    if (Array.isArray(c.games)) {
      for (const g of c.games) out.push({ case: c, game: g });
    } else {
      out.push({ case: c, game: null });
    }
  }
  return out;
}

async function applyApprovalNoticeGames(cases, noticeGames, updateFn) {
  const updatedCases = [];
  const alreadyApproved = [];
  const skippedRejected = [];
  const unmatched = [];
  const ambiguous = [];
  const entries = candidateEntries(cases);

  for (const g of noticeGames || []) {
    const gameId = g.gameId ? String(g.gameId).trim() : '';
    let candidates = [];
    if (gameId) {
      candidates = entries.filter((e) => {
        const cid = e.game ? e.game.gameId : e.case.gameId;
        return cid && String(cid).trim().toUpperCase() === gameId.toUpperCase();
      });
    }
    if (!candidates.length && g.gameTitle) {
      const normTitle = normalizeTitleForMatch(g.gameTitle);
      candidates = entries.filter((e) => {
        const caseTitle = e.game ? null : e.case.title;
        const gameTitle = e.game ? e.game.gameTitle : e.case.gameTitle;
        return (caseTitle && normalizeTitleForMatch(caseTitle) === normTitle) || normalizeTitleForMatch(gameTitle) === normTitle;
      });
      if (candidates.length > 1 && g.provider) {
        const narrowed = candidates.filter((e) => normalizeProviderKey(e.case.provider) === normalizeProviderKey(g.provider));
        if (narrowed.length) candidates = narrowed;
      }
    }

    if (candidates.length === 0) {
      unmatched.push({ gameTitle: g.gameTitle, gameId: g.gameId, provider: g.provider });
      continue;
    }
    if (candidates.length > 1) {
      ambiguous.push({
        gameTitle: g.gameTitle, gameId: g.gameId, provider: g.provider,
        matchedCaseNumbers: candidates.map((e) => e.case.caseNumber),
      });
      continue;
    }

    const { case: c, game } = candidates[0];
    const currentStage = game ? game.pagcorStage : c.pagcorStage;
    const currentGameId = game ? game.gameId : c.gameId;
    const currentTitle = game ? game.gameTitle : c.title;
    if (currentStage === 'Approved') {
      alreadyApproved.push({ caseNumber: c.caseNumber, title: currentTitle, gameId: currentGameId });
      continue;
    }
    if (currentStage === 'Rejected') {
      skippedRejected.push({ caseNumber: c.caseNumber, title: currentTitle, gameId: currentGameId });
      continue;
    }
    const oldStage = currentStage || 'Pending Documents';
    if (game) {
      const newGames = c.games.map((gg) => (gg.id === game.id
        ? { ...gg, pagcorStage: 'Approved', pagcorStageChangedAt: new Date().toISOString() }
        : gg));
      await updateFn(c.id, { games: newGames });
    } else {
      await updateFn(c.id, { pagcorStage: 'Approved', status: 'Closed' });
    }
    updatedCases.push({ caseNumber: c.caseNumber, title: currentTitle, gameId: currentGameId, provider: c.provider, oldStage, newStage: 'Approved' });
  }

  return { updatedCases, alreadyApproved, skippedRejected, unmatched, ambiguous };
}

module.exports = {
  normalizeProviderKey,
  applyApprovalNoticeGames,
};
