'use strict';
const { Router, sendJson } = require('./router');
const store = require('./store');
const auth = require('./auth');
const storage = require('./storage');
const ai = require('./ai');
const assistant = require('./assistant');
const pagcor = require('./pagcor');
const pagcorCheck = require('./pagcor-check');
const caseImport = require('./import');
const { mimeFor } = require('./mime');

const router = new Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}

async function requireAuth(req, res) {
  const token = auth.getTokenFromReq(req);
  const session = await auth.getSession(token);
  if (!session) {
    sendJson(res, 401, { error: 'Not authenticated' });
    return null;
  }
  const user = await store.find('users', session.userId);
  if (!user || user.status !== 'active') {
    sendJson(res, 401, { error: 'Account not active' });
    return null;
  }
  return user;
}

async function requirePerm(req, res, moduleName, action) {
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (!(await auth.can(user, moduleName, action))) {
    sendJson(res, 403, { error: `You do not have "${action}" permission on ${moduleName}` });
    return null;
  }
  return user;
}

async function notifyUser(userId, type, message, relatedId = null, relatedType = null) {
  await store.insert('notifications', { userId, type, message, relatedId, relatedType, isRead: false });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
router.post('/api/auth/login', async (req, res, params, body) => {
  const { username, password } = body || {};
  const user = (await store.all('users')).find((u) => u.username === (username || '').trim());
  if (!user || user.status !== 'active') {
    return sendJson(res, 401, { error: 'Invalid username or password' });
  }
  if (auth.isLocked(user)) {
    const minutesLeft = Math.max(1, Math.ceil((user.lockedUntil - Date.now()) / 60000));
    return sendJson(res, 429, { error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` });
  }
  if (!auth.verifyPassword(password || '', user.passwordHash)) {
    await auth.recordFailedLogin(user);
    return sendJson(res, 401, { error: 'Invalid username or password' });
  }
  await auth.resetFailedLogins(user);
  const token = await auth.createSession(user.id);
  const role = await store.find('roles', user.roleId);
  sendJson(res, 200, { token, user: publicUser(user), role });
});

router.post('/api/auth/logout', async (req, res) => {
  const token = auth.getTokenFromReq(req);
  await auth.destroySession(token);
  sendJson(res, 200, { ok: true });
});

router.get('/api/auth/me', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const role = await store.find('roles', user.roleId);
  sendJson(res, 200, { user: publicUser(user), role });
});

// ---------------------------------------------------------------------------
// Lookups (for dropdowns across modules)
// ---------------------------------------------------------------------------
router.get('/api/lookups', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const [users, departments, roles, cases, contracts] = await Promise.all([
    store.all('users'), store.all('departments'), store.all('roles'),
    store.all('cases'), store.all('contracts'),
  ]);
  sendJson(res, 200, {
    users: users.map((u) => ({ id: u.id, fullName: u.fullName, username: u.username })),
    departments,
    roles: roles.map((r) => ({ id: r.id, name: r.name })),
    cases: cases.map((c) => ({ id: c.id, title: c.title, caseNumber: c.caseNumber })),
    contracts: contracts.map((c) => ({ id: c.id, title: c.title, contractNumber: c.contractNumber })),
  });
});

// ---------------------------------------------------------------------------
// AI smart-fill (optional — see server/ai.js; works only once
// GEMINI_API_KEY is configured, everything else in the app is
// unaffected either way)
// ---------------------------------------------------------------------------
router.post('/api/ai/extract/:module', async (req, res, params, body) => {
  const moduleName = params.module;
  if (!ai.MODULE_SCHEMAS[moduleName]) {
    return sendJson(res, 400, { error: `Unknown AI module "${moduleName}"` });
  }
  // Same permission this module's own "create" form action already
  // requires — AI smart-fill is just a shortcut for filling that same form.
  const user = await requirePerm(req, res, moduleName, 'create');
  if (!user) return;
  try {
    const fields = await ai.extractFields({
      module: moduleName,
      text: body.text,
      fileName: body.fileName,
      fileContentBase64: body.fileContentBase64,
    });
    sendJson(res, 200, { fields });
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
});

// ---------------------------------------------------------------------------
// AI Assistant (optional — see server/assistant.js; requires
// GEMINI_API_KEY same as AI smart-fill above). Read-only lookups
// (search_*) execute immediately; anything that would create a record
// comes back as a `pendingAction` that the user must separately confirm
// via /api/assistant/confirm before it's actually written.
// ---------------------------------------------------------------------------
router.post('/api/assistant/message', async (req, res, params, body) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  try {
    const { reply, pendingActions } = await assistant.runTurn({
      history: Array.isArray(body.history) ? body.history : [],
      text: body.text || '',
      user,
    });
    sendJson(res, 200, { reply, pendingActions });
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
});

router.post('/api/assistant/confirm', async (req, res, params, body) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const { type, input } = body || {};
  if (!type || !input) return sendJson(res, 400, { error: 'Missing action type/input' });
  try {
    const result = await assistant.executeAction({ type, input }, user);
    sendJson(res, 201, { result });
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
router.get('/api/dashboard/summary', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const today = new Date();
  const in14 = new Date(today.getTime() + 14 * 86400000);

  const [tasks, cases, contracts, notifications, approvals] = await Promise.all([
    store.all('tasks'), store.all('cases'), store.all('contracts'),
    store.all('notifications'), store.all('approvals'),
  ]);

  const myTasks = tasks.filter((t) => t.assigneeId === user.id && t.status !== 'Completed');
  const allPendingTasks = tasks.filter((t) => t.status !== 'Completed');

  const upcomingDeadlines = [];
  cases.forEach((c) => {
    if (c.deadline && c.status !== 'Closed' && new Date(c.deadline) <= in14) {
      upcomingDeadlines.push({ type: 'Case', id: c.id, title: c.title, date: c.deadline });
    }
    // LOA (Letter of Approval) renewal tracking reuses this same "upcoming
    // deadlines" widget rather than introducing new infrastructure — once a
    // PAGCOR submission case has an loaExpiryDate set, it surfaces here
    // exactly like any other deadline.
    if (c.loaExpiryDate && new Date(c.loaExpiryDate) <= in14) {
      upcomingDeadlines.push({
        type: 'LOA Expiry', id: c.id,
        title: `${c.title}${c.gameTitle ? ` (${c.gameTitle})` : ''}`,
        date: c.loaExpiryDate,
      });
    }
  });
  contracts.forEach((c) => {
    if (c.expiryDate && new Date(c.expiryDate) <= in14) {
      upcomingDeadlines.push({ type: 'Contract', id: c.id, title: c.title, date: c.expiryDate });
    }
  });
  upcomingDeadlines.sort((a, b) => new Date(a.date) - new Date(b.date));

  const myNotifications = notifications
    .filter((n) => n.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10);

  const pendingApprovals = approvals.filter((a) => a.status === 'Pending' && a.reviewerId === user.id);

  // PAGCOR submission pipeline, grouped by Stage, for the Dashboard's Kanban
  // overview (see public/js/app.js's renderDashboard). Only cases with a
  // Provider set are PAGCOR game-submission cases (see crudRoutes onCreate
  // above for the same "Provider present -> PAGCOR case" convention). Each
  // column returns a small sample (most-recently-created first) plus a total
  // count, rather than every case, since a stage like "Under PAGCOR Review"
  // can hold hundreds of games — the client links out to the filtered Case
  // Management list for the rest instead of rendering them all here.
  const PAGCOR_BOARD_SAMPLE_SIZE = 5;
  const pagcorCases = cases.filter((c) => c.provider);
  const pagcorBoard = pagcor.PAGCOR_STAGE_OPTIONS.map((stage) => {
    const inStage = pagcorCases
      .filter((c) => c.pagcorStage === stage)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return {
      stage,
      count: inStage.length,
      sample: inStage.slice(0, PAGCOR_BOARD_SAMPLE_SIZE).map((c) => ({
        id: c.id,
        caseNumber: c.caseNumber,
        title: c.title,
        provider: c.provider,
        checklistDone: (c.pagcorChecklist || []).filter((i) => i.done).length,
        checklistTotal: (c.pagcorChecklist || []).length,
      })),
    };
  });

  sendJson(res, 200, {
    pagcorBoard,
    pendingTasksCount: myTasks.length,
    orgPendingTasksCount: allPendingTasks.length,
    upcomingDeadlines: upcomingDeadlines.slice(0, 10),
    recentNotifications: myNotifications,
    unreadNotificationsCount: notifications.filter((n) => n.userId === user.id && !n.isRead).length,
    pendingApprovals,
    pendingApprovalsCount: pendingApprovals.length,
    counts: {
      cases: cases.filter((c) => c.status !== 'Closed').length,
      contracts: contracts.filter((c) => c.status === 'Active').length,
    },
  });
});

// ---------------------------------------------------------------------------
// Generic list/get/create/update/delete factory
// ---------------------------------------------------------------------------
function crudRoutes({ base, moduleName, collection, onCreate, onUpdate }) {
  router.get(base, async (req, res) => {
    const user = await requirePerm(req, res, moduleName, 'view');
    if (!user) return;
    sendJson(res, 200, await store.all(collection));
  });

  router.get(`${base}/:id`, async (req, res, params) => {
    const user = await requirePerm(req, res, moduleName, 'view');
    if (!user) return;
    const row = await store.find(collection, params.id);
    if (!row) return sendJson(res, 404, { error: 'Not found' });
    sendJson(res, 200, row);
  });

  router.post(base, async (req, res, params, body) => {
    const user = await requirePerm(req, res, moduleName, 'create');
    if (!user) return;
    const payload = onCreate ? await onCreate(body, user) : body;
    const row = await store.insert(collection, payload);
    sendJson(res, 201, row);
  });

  router.put(`${base}/:id`, async (req, res, params, body) => {
    const user = await requirePerm(req, res, moduleName, 'edit');
    if (!user) return;
    const patch = onUpdate ? await onUpdate(body, user) : body;
    const row = await store.update(collection, params.id, patch);
    if (!row) return sendJson(res, 404, { error: 'Not found' });
    sendJson(res, 200, row);
  });

  router.delete(`${base}/:id`, async (req, res, params) => {
    const user = await requirePerm(req, res, moduleName, 'delete');
    if (!user) return;
    const ok = await store.remove(collection, params.id);
    if (!ok) return sendJson(res, 404, { error: 'Not found' });
    sendJson(res, 200, { ok: true });
  });
}

// Cases -----------------------------------------------------------------
crudRoutes({
  base: '/api/cases', moduleName: 'cases', collection: 'cases',
  onCreate: async (body) => {
    const patch = { ...body, caseNumber: body.caseNumber || await store.nextNumber('case', 'CASE') };
    // A case with a Provider set is a PAGCOR game-submission case — give it
    // the standard checklist/stage automatically so the user doesn't have to
    // set those up by hand every time. Cases without a Provider (Commercial,
    // IP, Litigation, etc.) are untouched.
    if (body.provider && !patch.pagcorChecklist) patch.pagcorChecklist = pagcor.defaultChecklist();
    if (body.provider && !patch.pagcorStage) patch.pagcorStage = 'Preparing Documents';
    return patch;
  },
});

// Bulk stage update — select multiple cases in Case Management (e.g. a
// batch of games that all just got their LOA) and set their PAGCOR Stage
// in one action, instead of opening each one individually. Same "cases:
// edit" permission as the per-case Edit button. Only touches pagcorStage —
// mirrors what editing a single case's Stage field alone does (it doesn't
// auto-recompute status/checklist either; those are only auto-set once, at
// creation time — see crudRoutes' onCreate above).
router.post('/api/cases/bulk-update-stage', async (req, res, params, body) => {
  const user = await requirePerm(req, res, 'cases', 'edit');
  if (!user) return;
  const ids = Array.isArray(body.ids) ? body.ids : [];
  const { pagcorStage } = body;
  if (!ids.length) return sendJson(res, 400, { error: '請至少選擇一筆案件。' });
  if (!pagcor.PAGCOR_STAGE_OPTIONS.includes(pagcorStage)) {
    return sendJson(res, 400, { error: `無效的 PAGCOR Stage: ${pagcorStage}` });
  }
  let updated = 0;
  const errors = [];
  for (const id of ids) {
    try {
      const row = await store.update('cases', id, { pagcorStage });
      if (row) updated++; else errors.push(`${id}: not found`);
    } catch (err) {
      errors.push(`${id}: ${err.message}`);
    }
  }
  sendJson(res, 200, { updated, errors });
});

// Upload a real PAGCOR "Notice of Approval" letter (often a scanned image
// with no text layer) and have Gemini read it directly, instead of waiting
// on PAGCOR's own public approved-games list (which can lag the real
// notice by weeks — see pagcor-check.js's applyApprovalNoticeGames doc
// comment). Reuses the same "cases: edit" permission and the same
// conservative match-or-report-back behavior as the other PAGCOR routes —
// a game the AI reads but can't match to exactly one case is reported back
// as unmatched/ambiguous rather than guessed at.
router.post('/api/cases/import-approval-notice', async (req, res, params, body) => {
  const user = await requirePerm(req, res, 'cases', 'edit');
  if (!user) return;
  try {
    const extracted = await ai.extractApprovalNotice({ fileName: body.fileName, fileContentBase64: body.fileContentBase64 });
    const cases = await store.all('cases');
    const result = await pagcorCheck.applyApprovalNoticeGames(cases, extracted.games, (id, patch) => store.update('cases', id, patch));
    sendJson(res, 200, { ...result, approvalDate: extracted.approvalDate || null, noticeReference: extracted.noticeReference || null });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
});

router.get('/api/cases/:id/notes', async (req, res, params) => {
  const user = await requirePerm(req, res, 'cases', 'view');
  if (!user) return;
  sendJson(res, 200, (await store.all('caseNotes')).filter((n) => n.caseId === params.id));
});

// Import Excel/CSV -> bulk-create Cases (see server/import.js). Two steps:
// preview (parse + show what would be created, without writing anything),
// then commit (the user has reviewed/edited the per-sheet Provider/Stage
// settings and actually wants the records created). Same "cases: create"
// permission as the normal "New Case" button — this is a bulk shortcut for
// the same action, not a separate capability.
function decodeBase64File(fileContentBase64) {
  if (!fileContentBase64) throw new Error('請上傳一個檔案。');
  const base64Data = fileContentBase64.includes(',') ? fileContentBase64.split(',').pop() : fileContentBase64;
  return Buffer.from(base64Data, 'base64');
}

router.post('/api/cases/import/preview', async (req, res, params, body) => {
  const user = await requirePerm(req, res, 'cases', 'create');
  if (!user) return;
  try {
    const buffer = decodeBase64File(body.fileContentBase64);
    const sheets = caseImport.preview(buffer, body.fileName);
    sendJson(res, 200, { sheets });
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
});

// Dedup key for import commit: Provider + Game Title, case-insensitively
// (falls back to the case Title if a row has no gameTitle — shouldn't
// happen for real import rows, but keeps this safe for hand-built ones).
// Only cases with a Provider are ever considered — non-PAGCOR cases never
// collide with import rows.
function importDedupKey(c) {
  return `${(c.provider || '').trim().toLowerCase()}|${(c.gameTitle || c.title || '').trim().toLowerCase()}`;
}

// Strips everything but letters/digits and lowercases, so "CATLA_S MONEY
// MACHINE" and "CATLA'S MONEY MACHINE" (an underscore-for-apostrophe typo —
// a real example from Tiffany's workbook) normalize to the same string.
function normalizeGameName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// True when two Game Titles are close enough (after normalizing) to be
// confident they're the same game rather than two different games that
// happen to share a Game ID (which does happen — see the comment on Stage
// 2.5 below). One name being essentially a substring of the other covers
// both punctuation-only typos and a shorter/longer variant of the same
// name (e.g. "Super Niubi Fortune" vs "SuperNiubiFortuneX-huge").
function titlesLikelySameGame(a, b) {
  const na = normalizeGameName(a);
  const nb = normalizeGameName(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

router.post('/api/cases/import/commit', async (req, res, params, body) => {
  const user = await requirePerm(req, res, 'cases', 'create');
  if (!user) return;
  const sheetSettings = Array.isArray(body.sheets) ? body.sheets : [];
  let buffer;
  try {
    buffer = decodeBase64File(body.fileContentBase64);
  } catch (err) {
    return sendJson(res, 400, { error: err.message });
  }
  const errors = [];

  // Stage 1: parse every included sheet into rows, tagged with the sheet
  // name they came from (for error messages).
  const allRows = [];
  for (const s of sheetSettings) {
    if (!s || s.include === false) continue;
    try {
      const rows = caseImport.buildCasesForSheet(buffer, body.fileName, s.name, { provider: s.provider, pagcorStage: s.pagcorStage });
      rows.forEach((row) => allRows.push({ row, sheetName: s.name }));
    } catch (err) {
      errors.push(`${s.name}: ${err.message}`);
    }
  }

  // Stage 2: a real workbook can list the same game in more than one sheet
  // — e.g. a Provider's own pending-list tab AND the master "APPROVED" tab,
  // once that game has actually been approved (the Provider tab just never
  // got updated). Tiffany confirmed: treat that as ONE case, using the
  // APPROVED-tab version (final LOA Approved stage), not two separate
  // records for the same game — so an isApprovedRow entry always wins a
  // same-key collision, whichever sheet order they were parsed in.
  const byKey = new Map();
  for (const entry of allRows) {
    const key = importDedupKey(entry.row);
    const existing = byKey.get(key);
    if (!existing || (entry.row.isApprovedRow && !existing.row.isApprovedRow)) byKey.set(key, entry);
  }
  const collapsedByCrossSheetDedup = allRows.length - byKey.size;

  // Stage 2.5: Stage 2's Provider+Title key only catches EXACT (case-
  // insensitive) title matches, so the same real game recorded under two
  // slightly different spellings — a typo, or a shorter/longer variant of
  // the name — still becomes two separate cases even though it's really
  // one game. A real example from Tiffany's workbook: "CATLA_S MONEY
  // MACHINE" (APPROVED tab, underscore-for-apostrophe typo) vs "CATLA'S
  // MONEY MACHINE" (FC's own tab) both under Game ID 22080. Since Game ID
  // is normally a much stronger identity signal than the title text, group
  // Stage 2's survivors by (Provider, Game ID) and collapse further when
  // their titles are close enough (see titlesLikelySameGame()) to be
  // confident it's the same game — preferring the APPROVED-tab version,
  // same as Stage 2. But a Game ID can ALSO collide by pure typo between
  // two genuinely different games (found in the same workbook: FC's "HOT
  // POT PARTY" and "OPEN VAULT" rows both list Game ID 22026, because
  // "OPEN VAULT"'s own Game Version string says 22086 — its Game ID cell
  // is simply mistyped). Blindly merging on Game ID alone would silently
  // drop one of two real submissions in that case, so titles that don't
  // look related are left as two separate cases and reported back in
  // `gameIdConflicts` instead, for a human to check the source sheet.
  const byProviderGameId = new Map();
  for (const entry of byKey.values()) {
    const gid = (entry.row.gameId || '').trim();
    if (!gid) continue;
    const pgKey = `${(entry.row.provider || '').trim().toLowerCase()}|${gid.toLowerCase()}`;
    if (!byProviderGameId.has(pgKey)) byProviderGameId.set(pgKey, []);
    byProviderGameId.get(pgKey).push(entry);
  }
  const gameIdConflicts = [];
  for (const entries of byProviderGameId.values()) {
    if (entries.length < 2) continue;
    const firstTitle = entries[0].row.gameTitle || entries[0].row.title;
    const allSimilar = entries.every((e) => titlesLikelySameGame(e.row.gameTitle || e.row.title, firstTitle));
    if (allSimilar) {
      const survivor = entries.find((e) => e.row.isApprovedRow) || entries[0];
      for (const e of entries) {
        if (e !== survivor) byKey.delete(importDedupKey(e.row));
      }
    } else {
      gameIdConflicts.push({
        provider: entries[0].row.provider,
        gameId: entries[0].row.gameId,
        titles: entries.map((e) => e.row.gameTitle || e.row.title),
      });
    }
  }
  const collapsedByGameIdDedup = allRows.length - byKey.size - collapsedByCrossSheetDedup;

  // Stage 3: skip anything that's already a Case from an earlier import run
  // (or was hand-created with the same Provider + Game Title) — this is
  // what protects against accidentally re-running the same import twice,
  // since this is an additive bulk-create, not an upsert. Also re-applies
  // Stage 2.5's same-Provider-and-Game-ID-with-similar-title check against
  // EXISTING cases, not just this commit's own rows — otherwise importing,
  // say, the APPROVED sheet today and a Provider's own sheet next week would
  // re-create the CATLA/Super-Niubi-style near-duplicates that a single
  // combined commit already merges (see Stage 2.5's comment above).
  const existingCases = (await store.all('cases')).filter((c) => c.provider);
  const existingKeys = new Set(existingCases.map(importDedupKey));
  const existingByProviderGameId = new Map();
  for (const c of existingCases) {
    const gid = (c.gameId || '').trim();
    if (!gid) continue;
    const pgKey = `${(c.provider || '').trim().toLowerCase()}|${gid.toLowerCase()}`;
    if (!existingByProviderGameId.has(pgKey)) existingByProviderGameId.set(pgKey, []);
    existingByProviderGameId.get(pgKey).push(c);
  }
  let created = 0;
  let skippedExisting = 0;
  for (const { row, sheetName } of byKey.values()) {
    const key = importDedupKey(row);
    if (existingKeys.has(key)) { skippedExisting++; continue; }
    const gid = (row.gameId || '').trim();
    const pgKey = gid ? `${(row.provider || '').trim().toLowerCase()}|${gid.toLowerCase()}` : null;
    if (pgKey && (existingByProviderGameId.get(pgKey) || []).some((c) => titlesLikelySameGame(c.gameTitle || c.title, row.gameTitle || row.title))) {
      skippedExisting++;
      continue;
    }
    try {
      const caseNumber = await store.nextNumber('case', 'CASE');
      const { isApprovedRow, ...caseFields } = row; // internal-only flag, not a Case field
      await store.insert('cases', { ...caseFields, ownerId: user.id, caseNumber });
      created++;
      existingKeys.add(key);
      if (pgKey) {
        if (!existingByProviderGameId.has(pgKey)) existingByProviderGameId.set(pgKey, []);
        existingByProviderGameId.get(pgKey).push(row);
      }
    } catch (err) {
      errors.push(`${sheetName} / ${row.title}: ${err.message}`);
    }
  }
  sendJson(res, 200, {
    created,
    skipped: collapsedByCrossSheetDedup + collapsedByGameIdDedup + skippedExisting,
    errors,
    gameIdConflicts,
  });
});

router.post('/api/cases/:id/notes', async (req, res, params, body) => {
  const user = await requirePerm(req, res, 'cases', 'edit');
  if (!user) return;
  const note = await store.insert('caseNotes', { caseId: params.id, note: body.note, createdBy: user.id });
  sendJson(res, 201, note);
});

// Contracts ---------------------------------------------------------------
crudRoutes({
  base: '/api/contracts', moduleName: 'contracts', collection: 'contracts',
  onCreate: async (body) => ({ ...body, contractNumber: body.contractNumber || await store.nextNumber('contract', 'CTR') }),
});

router.get('/api/contracts/:id/versions', async (req, res, params) => {
  const user = await requirePerm(req, res, 'contracts', 'view');
  if (!user) return;
  sendJson(res, 200, (await store.all('contractVersions')).filter((v) => v.contractId === params.id));
});

router.post('/api/contracts/:id/versions', async (req, res, params, body) => {
  const user = await requirePerm(req, res, 'contracts', 'edit');
  if (!user) return;
  const existing = (await store.all('contractVersions')).filter((v) => v.contractId === params.id);
  const filePath = await storage.saveBase64File(body.fileName, body.fileContentBase64);
  const version = await store.insert('contractVersions', {
    contractId: params.id,
    versionNo: existing.length + 1,
    uploadedBy: user.id,
    fileName: body.fileName || null,
    filePath,
    notes: body.notes || '',
  });
  sendJson(res, 201, version);
});

// Documents -----------------------------------------------------------------
crudRoutes({
  base: '/api/documents', moduleName: 'documents', collection: 'documents',
  onCreate: async (body, user) => {
    const filePath = await storage.saveBase64File(body.fileName, body.fileContentBase64);
    const { fileContentBase64, ...rest } = body;
    return { ...rest, filePath, uploadedBy: user.id };
  },
});

router.get('/api/documents/:id/download', async (req, res, params) => {
  const user = await requirePerm(req, res, 'documents', 'view');
  if (!user) return;
  const doc = await store.find('documents', params.id);
  if (!doc || !doc.filePath) return sendJson(res, 404, { error: 'File not available' });
  const buffer = await storage.readFile(doc.filePath);
  if (!buffer) return sendJson(res, 404, { error: 'File missing in storage' });
  res.writeHead(200, {
    'Content-Type': mimeFor(doc.fileName || doc.filePath),
    'Content-Disposition': `attachment; filename="${(doc.fileName || 'download').replace(/"/g, '')}"`,
  });
  res.end(buffer);
});

// "AI 幫我抓重點" — reads the document's already-stored file straight from
// Supabase Storage (same bytes /download serves) and asks Gemini for a
// short summary + key facts. Pure read-only convenience: this never writes
// anything, and never judges the document as correct/complete/compliant —
// see server/ai.js's summarizeDocument for why that's a deliberate scope
// boundary rather than an oversight.
router.post('/api/documents/:id/summarize', async (req, res, params) => {
  const user = await requirePerm(req, res, 'documents', 'view');
  if (!user) return;
  const doc = await store.find('documents', params.id);
  if (!doc) return sendJson(res, 404, { error: 'Document not found' });
  if (!doc.filePath) return sendJson(res, 400, { error: '這筆文件沒有附加檔案，無法產生 AI 摘要。' });
  const buffer = await storage.readFile(doc.filePath);
  if (!buffer) return sendJson(res, 404, { error: 'File missing in storage' });
  try {
    // mimeFor() can return "text/plain; charset=utf-8" (fine as an HTTP
    // Content-Type header, which is all it's normally used for — see the
    // /download route above) but a data: URL's own syntax only allows a
    // bare "type/subtype" before the first ";base64," marker, and
    // server/ai.js's parseDataUrl() only strips the ";base64," suffix, not
    // a "; charset=..." parameter in the middle — so the full value would
    // fail to parse there. Strip any parameters off before building the
    // data: URL; the actual bytes are unaffected either way.
    const bareMimeType = mimeFor(doc.fileName || doc.filePath).split(';')[0].trim();
    const result = await ai.summarizeDocument({
      fileName: doc.fileName,
      fileContentBase64: `data:${bareMimeType};base64,${buffer.toString('base64')}`,
    });
    sendJson(res, 200, result);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
});

// Tasks -----------------------------------------------------------------
crudRoutes({
  base: '/api/tasks', moduleName: 'tasks', collection: 'tasks',
  onCreate: async (body, user) => ({ ...body, createdBy: user.id }),
});

// Approvals -------------------------------------------------------------
crudRoutes({
  base: '/api/approvals', moduleName: 'approvals', collection: 'approvals',
  onCreate: async (body, user) => ({ ...body, requestedBy: user.id, status: 'Pending', comments: [] }),
});

router.post('/api/approvals/:id/decide', async (req, res, params, body) => {
  const user = await requirePerm(req, res, 'approvals', 'approve');
  if (!user) return;
  const approval = await store.find('approvals', params.id);
  if (!approval) return sendJson(res, 404, { error: 'Not found' });
  const decision = body.decision === 'approve' ? 'Approved' : 'Rejected';
  const comments = [...(approval.comments || [])];
  if (body.comment) comments.push({ by: user.id, text: body.comment, at: new Date().toISOString() });
  const updated = await store.update('approvals', params.id, { status: decision, comments, decidedAt: new Date().toISOString() });
  await notifyUser(approval.requestedBy, 'approval_decision', `Your request "${approval.title}" was ${decision.toLowerCase()}`, approval.id, 'approval');
  sendJson(res, 200, updated);
});

// Notifications ---------------------------------------------------------
router.get('/api/notifications', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const list = (await store.all('notifications'))
    .filter((n) => n.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  sendJson(res, 200, list);
});

router.post('/api/notifications/:id/read', async (req, res, params) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const n = await store.find('notifications', params.id);
  if (!n || n.userId !== user.id) return sendJson(res, 404, { error: 'Not found' });
  const updated = await store.update('notifications', params.id, { isRead: true });
  sendJson(res, 200, updated);
});

router.post('/api/notifications/read-all', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const unread = (await store.all('notifications')).filter((n) => n.userId === user.id && !n.isRead);
  await Promise.all(unread.map((n) => store.update('notifications', n.id, { isRead: true })));
  sendJson(res, 200, { ok: true });
});

// Settings: Users ---------------------------------------------------------
router.get('/api/users', async (req, res) => {
  const user = await requirePerm(req, res, 'settings', 'view');
  if (!user) return;
  sendJson(res, 200, (await store.all('users')).map(publicUser));
});

router.post('/api/users', async (req, res, params, body) => {
  const user = await requirePerm(req, res, 'settings', 'create');
  if (!user) return;
  if ((await store.all('users')).some((u) => u.username === body.username)) {
    return sendJson(res, 409, { error: 'Username already exists' });
  }
  const created = await store.insert('users', {
    username: body.username, fullName: body.fullName, email: body.email,
    departmentId: body.departmentId, roleId: body.roleId, status: body.status || 'active',
    passwordHash: auth.hashPassword(body.password || 'changeme123'),
  });
  sendJson(res, 201, publicUser(created));
});

router.put('/api/users/:id', async (req, res, params, body) => {
  const user = await requirePerm(req, res, 'settings', 'edit');
  if (!user) return;
  const patch = { ...body };
  if (patch.password) {
    patch.passwordHash = auth.hashPassword(patch.password);
  }
  delete patch.password;
  const updated = await store.update('users', params.id, patch);
  if (!updated) return sendJson(res, 404, { error: 'Not found' });
  sendJson(res, 200, publicUser(updated));
});

router.delete('/api/users/:id', async (req, res, params) => {
  const user = await requirePerm(req, res, 'settings', 'delete');
  if (!user) return;
  if (params.id === user.id) return sendJson(res, 400, { error: 'Cannot delete your own account' });
  const ok = await store.remove('users', params.id);
  if (!ok) return sendJson(res, 404, { error: 'Not found' });
  sendJson(res, 200, { ok: true });
});

// Settings: Roles ---------------------------------------------------------
crudRoutes({ base: '/api/roles', moduleName: 'settings', collection: 'roles' });

// Settings: Departments ------------------------------------------------
crudRoutes({ base: '/api/departments', moduleName: 'settings', collection: 'departments' });

module.exports = router;
