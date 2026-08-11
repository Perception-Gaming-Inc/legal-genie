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
// System Settings — a single row (id: 'system') holding the few things
// Settings > Notification/Submission/Required Document Settings let an
// Admin configure, instead of leaving them as hardcoded constants scattered
// across routes.js/pagcor.js. Falls back to those original hardcoded values
// (30-day follow-up, the standard PAGCOR_CHECKLIST_ITEMS, all notification
// triggers on) the first time this is ever read, so a fresh install behaves
// exactly like before this existed.
async function getSystemSettings() {
  let settings = await store.find('settings', 'system');
  if (!settings) {
    settings = await store.insert('settings', {
      id: 'system',
      followUpDays: 30,
      requiredDocumentChecklist: pagcor.PAGCOR_CHECKLIST_ITEMS,
      notifications: {
        notifyOnApprovalDecision: true,
        notifyOnTaskAssignment: true,
        notifyOnCaseStageChange: true,
      },
    });
  }
  return settings;
}

// New cases (see crudRoutes onCreate for 'cases' below) get their PAGCOR
// checklist from whatever's currently configured in Required Document
// Settings — falling back to the standard PAGCOR_CHECKLIST_ITEMS the first
// time settings are read. Deliberately only affects cases created *after*
// a settings change; existing cases keep whatever checklist they already
// have, same as changing a template never rewrites past records.
async function getChecklistTemplate() {
  const settings = await getSystemSettings();
  const items = (settings.requiredDocumentChecklist && settings.requiredDocumentChecklist.length)
    ? settings.requiredDocumentChecklist
    : pagcor.PAGCOR_CHECKLIST_ITEMS;
  return items.map((item) => ({ ...item, done: false }));
}

function notificationsEnabled(settings, key) {
  // Missing settings.notifications (a fresh install before anyone's ever
  // touched Notification Settings) or a missing/undefined key both mean
  // "on" — matches getSystemSettings()'s own defaults, so a brand new
  // system behaves exactly like it did before these toggles existed.
  return !settings.notifications || settings.notifications[key] !== false;
}

// Notifies a case's Owner when its PAGCOR Stage actually changed this
// request (never on a save that leaves the Stage alone), gated by Settings
// > Notification Settings > "Notify on case status change". Skips notifying
// someone about their own change — nobody needs a notification for an
// action they just took themselves.
async function notifyCaseStageChange(row, existing, actingUser) {
  if (!row || !existing || !row.pagcorStage || existing.pagcorStage === row.pagcorStage) return;
  if (!row.ownerId || row.ownerId === actingUser.id) return;
  const settings = await getSystemSettings();
  if (!notificationsEnabled(settings, 'notifyOnCaseStageChange')) return;
  await notifyUser(row.ownerId, 'case_stage_change', `Case "${row.title}" status changed to "${row.pagcorStage}"`, row.id, 'case');
}

// Notifies a task's Assignee when they're newly assigned (a fresh task, or
// an existing one whose Assignee just changed to them) — gated by Settings
// > Notification Settings > "Notify on task assignment". `existing` is null
// for a brand-new task (see crudRoutes' afterCreate).
async function notifyTaskAssignee(row, existing, actingUser) {
  if (!row || !row.assigneeId) return;
  const changed = !existing || existing.assigneeId !== row.assigneeId;
  if (!changed || row.assigneeId === actingUser.id) return;
  const settings = await getSystemSettings();
  if (!notificationsEnabled(settings, 'notifyOnTaskAssignment')) return;
  await notifyUser(row.assigneeId, 'task_assigned', `You were assigned to task "${row.title}"`, row.id, 'task');
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

// "When a new case comes in, import all its documents at once and have AI
// organize them into a Case" — the Case Management intake wizard's AI step.
// Takes several files at once (the whole bundle a
// Provider sends for one game) and returns proposed Case fields, same
// permission as the "New Case" button itself. Read-only — this never
// creates anything; the frontend shows the proposal in the normal case
// form for the user to review/edit, and only POST /api/cases (below)
// actually saves it. See server/ai.js's extractCaseFromDocuments.
router.post('/api/cases/extract-from-documents', async (req, res, params, body) => {
  const user = await requirePerm(req, res, 'cases', 'create');
  if (!user) return;
  try {
    // {common, games} — `games` is always an array (usually length 1, but
    // a single submission bundle can legitimately cover several games at
    // once — see server/ai.js's extractCaseFromDocuments for why this
    // isn't just one flat proposed Case).
    const result = await ai.extractCaseFromDocuments({ documents: Array.isArray(body.documents) ? body.documents : [] });
    sendJson(res, 200, result);
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

  // "Today's To-Dos" — my own not-yet-completed tasks due today or earlier
  // (an overdue task is still very much something to do today, not
  // something to hide from this widget until its exact due date arrives).
  const todayStr = today.toISOString().slice(0, 10);
  const todaysTasks = myTasks
    .filter((t) => t.dueDate && t.dueDate <= todayStr)
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

  // "Recently Updated Cases" — a quick "what moved lately" list, most
  // recently touched first. Falls back to createdAt for cases that have
  // never been edited since creation (store.update() is what stamps
  // updatedAt — see store.js).
  const recentlyUpdatedCases = [...cases]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 5)
    .map((c) => ({
      id: c.id, caseNumber: c.caseNumber, title: c.title, gameTitle: c.gameTitle,
      pagcorStage: c.pagcorStage, updatedAt: c.updatedAt || c.createdAt,
    }));

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

  // Follow-up window comes from Settings > Submission Settings (defaults to
  // 30 days, same as it's always been — see getSystemSettings above).
  const settings = await getSystemSettings();
  const followUpDays = Number.isFinite(settings.followUpDays) && settings.followUpDays > 0 ? settings.followUpDays : 30;

  // Follow-up reminder — flags games that have been sitting in "Submitted to
  // PAGCOR" or "Under PAGCOR Review" for followUpDays+ with nobody having
  // followed up (i.e. the Stage itself hasn't changed). This came directly
  // from legal's feedback that games silently stall at PAGCOR for weeks with
  // no visibility until someone happens to check. Falls back to createdAt
  // for older cases that predate the pagcorStageChangedAt field (see
  // crudRoutes' onCreate/onUpdate for cases in this file).
  const FOLLOW_UP_STAGES = ['Submitted to PAGCOR', 'Under PAGCOR Review'];
  const followUpCutoff = new Date(today.getTime() - followUpDays * 86400000);
  const followUps = cases
    .filter((c) => FOLLOW_UP_STAGES.includes(c.pagcorStage))
    .map((c) => ({ ...c, _stageSince: c.pagcorStageChangedAt || c.createdAt }))
    .filter((c) => c._stageSince && new Date(c._stageSince) <= followUpCutoff)
    .sort((a, b) => new Date(a._stageSince) - new Date(b._stageSince))
    .map((c) => ({
      id: c.id,
      caseNumber: c.caseNumber,
      title: c.title,
      gameTitle: c.gameTitle,
      provider: c.provider,
      pagcorStage: c.pagcorStage,
      stageSince: c._stageSince,
      daysSince: Math.floor((today - new Date(c._stageSince)) / 86400000),
    }));

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

  // "Pending Documents" — PAGCOR cases whose required-document checklist
  // (Settings > Required Document Settings) isn't fully checked off yet,
  // still open (not LOA Approved/Rejected). Reuses the same
  // checklistDone/checklistTotal shape the pagcorBoard sample rows already
  // compute above, so the Dashboard widget and the PAGCOR board agree on
  // what "incomplete" means.
  const pendingDocuments = pagcorCases
    .filter((c) => !['LOA Approved', 'Rejected'].includes(c.pagcorStage))
    .map((c) => ({
      id: c.id,
      caseNumber: c.caseNumber,
      title: c.title,
      gameTitle: c.gameTitle,
      provider: c.provider,
      pagcorStage: c.pagcorStage,
      checklistDone: (c.pagcorChecklist || []).filter((i) => i.done).length,
      checklistTotal: (c.pagcorChecklist || []).length,
    }))
    .filter((c) => c.checklistTotal > 0 && c.checklistDone < c.checklistTotal)
    .sort((a, b) => (a.checklistTotal - a.checklistDone) < (b.checklistTotal - b.checklistDone) ? 1 : -1);

  sendJson(res, 200, {
    pagcorBoard,
    pendingTasksCount: myTasks.length,
    orgPendingTasksCount: allPendingTasks.length,
    followUpDays,
    todaysTasks,
    recentlyUpdatedCases,
    pendingDocuments: pendingDocuments.slice(0, 10),
    pendingDocumentsCount: pendingDocuments.length,
    upcomingDeadlines: upcomingDeadlines.slice(0, 10),
    recentNotifications: myNotifications,
    unreadNotificationsCount: notifications.filter((n) => n.userId === user.id && !n.isRead).length,
    followUps: followUps.slice(0, 10),
    followUpsCount: followUps.length,
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
function crudRoutes({ base, moduleName, collection, onCreate, onUpdate, afterCreate, afterUpdate, afterDelete }) {
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
    // Fire-and-report side effects (e.g. auto-creating a follow-up task)
    // after the row itself is safely written — a failure here shouldn't
    // block the actual create from succeeding/returning to the client.
    if (afterCreate) {
      try { await afterCreate(row, user); } catch (err) { console.error(`afterCreate(${base}) failed:`, err); }
    }
    sendJson(res, 201, row);
  });

  router.put(`${base}/:id`, async (req, res, params, body) => {
    const user = await requirePerm(req, res, moduleName, 'edit');
    if (!user) return;
    // Fetched once up front (only when actually needed) and handed to both
    // hooks as `existing` — the pre-update row — so e.g. a case's afterUpdate
    // can tell whether pagcorStage actually changed this request without
    // re-querying (store.update() already overwrites the row by the time
    // afterUpdate runs, so "before" state would otherwise be lost).
    const existing = (onUpdate || afterUpdate) ? await store.find(collection, params.id) : null;
    const patch = onUpdate ? await onUpdate(body, user, params.id, existing) : body;
    const row = await store.update(collection, params.id, patch);
    if (!row) return sendJson(res, 404, { error: 'Not found' });
    if (afterUpdate) {
      try { await afterUpdate(row, user, params.id, existing); } catch (err) { console.error(`afterUpdate(${base}) failed:`, err); }
    }
    sendJson(res, 200, row);
  });

  router.delete(`${base}/:id`, async (req, res, params) => {
    const user = await requirePerm(req, res, moduleName, 'delete');
    if (!user) return;
    const existing = afterDelete ? await store.find(collection, params.id) : null;
    const ok = await store.remove(collection, params.id);
    if (!ok) return sendJson(res, 404, { error: 'Not found' });
    if (afterDelete && existing) {
      try { await afterDelete(existing, user); } catch (err) { console.error(`afterDelete(${base}) failed:`, err); }
    }
    sendJson(res, 200, { ok: true });
  });
}

// Auto-managed "follow up 30 days later" reminder task for a case's Submit Date.
// Keeps exactly one such task per case in sync with that case's current
// `deadline` field, so the Calendar page and Task Management always reflect
// the latest date without Tiffany having to create/update it by hand:
//   - no deadline (or case deleted) -> the auto task (if any) is removed
//   - deadline set/changed          -> the task's dueDate is (re)computed as
//                                       deadline + 30 days
//   - task already marked Completed -> left alone even if the deadline later
//                                       changes, so a done follow-up doesn't
//                                       silently reopen
// Identified via `isDeadlineFollowUp: true` (not a real Task Management
// field the user ever sets) plus `sourceDeadline` (the deadline value it was
// last computed from), both invisible in the normal Task form/list — this
// is purely bookkeeping so re-syncing is idempotent instead of duplicating.
async function syncDeadlineFollowUpTask(caseRow) {
  if (!caseRow || !caseRow.id) return;
  const tasks = await store.all('tasks');
  const existing = tasks.find((t) => t.relatedCaseId === caseRow.id && t.isDeadlineFollowUp);

  if (!caseRow.deadline) {
    // Only clean up a still-pending reminder. A Completed one is a real
    // record that someone already did the follow-up — clearing the
    // deadline afterwards (e.g. the case got closed) shouldn't erase that
    // history from Task Management.
    if (existing && existing.status !== 'Completed') await store.remove('tasks', existing.id);
    return;
  }

  const followUp = new Date(caseRow.deadline);
  if (isNaN(followUp)) return; // malformed date — don't crash the case save over it
  const settings = await getSystemSettings();
  const followUpDays = Number.isFinite(settings.followUpDays) && settings.followUpDays > 0 ? settings.followUpDays : 30;
  followUp.setDate(followUp.getDate() + followUpDays);
  const followUpDate = followUp.toISOString().slice(0, 10);
  const title = `Follow up: ${caseRow.title}`;

  if (!existing) {
    await store.insert('tasks', {
      title,
      description: `Case "${caseRow.title}" has a Submit Date of ${caseRow.deadline}. This reminder was created automatically ${followUpDays} days later to follow up on progress.`,
      assigneeId: caseRow.ownerId || null,
      type: 'team',
      status: 'Not Started',
      dueDate: followUpDate,
      relatedCaseId: caseRow.id,
      isDeadlineFollowUp: true,
      sourceDeadline: caseRow.deadline,
    });
  } else if (existing.status !== 'Completed' && existing.sourceDeadline !== caseRow.deadline) {
    await store.update('tasks', existing.id, { title, dueDate: followUpDate, sourceDeadline: caseRow.deadline });
  }
}

// Cases -----------------------------------------------------------------
crudRoutes({
  base: '/api/cases', moduleName: 'cases', collection: 'cases',
  onCreate: async (body) => {
    const patch = { ...body, caseNumber: body.caseNumber || await store.nextNumber('case', 'CASE') };
    // A case with a Provider set is a PAGCOR game-submission case — give it
    // the standard checklist/stage automatically so the user doesn't have to
    // set those up by hand every time. Cases without a Provider (Commercial,
    // IP, Litigation, etc.) are untouched. The checklist template itself
    // comes from Settings > Required Document Settings (see
    // getChecklistTemplate above) — falls back to the standard
    // PAGCOR_CHECKLIST_ITEMS the first time settings are read.
    if (body.provider && !patch.pagcorChecklist) patch.pagcorChecklist = await getChecklistTemplate();
    if (body.provider && !patch.pagcorStage) patch.pagcorStage = 'Preparing Documents';
    // Stamp when the case entered its current PAGCOR Stage, so the Dashboard
    // can flag games that have been sitting in "Submitted to PAGCOR" /
    // "Under PAGCOR Review" for the configured follow-up window without
    // anyone following up (see onUpdate below and
    // /api/dashboard/summary's followUps). Only set if not already provided
    // (e.g. by the Excel import path in import.js).
    if (patch.pagcorStage && !patch.pagcorStageChangedAt) patch.pagcorStageChangedAt = new Date().toISOString();
    return patch;
  },
  // Editing a case's Stage field directly (not via the batch action below)
  // should reset the same "time in stage" clock used for the follow-up
  // reminder — otherwise a game that was actually just moved forward would
  // still look overdue until its next unrelated edit. `existing` is the
  // pre-update row, handed in by crudRoutes' PUT handler.
  onUpdate: async (body, user, id, existing) => {
    const patch = { ...body };
    if (patch.pagcorStage && existing && existing.pagcorStage !== patch.pagcorStage) {
      patch.pagcorStageChangedAt = new Date().toISOString();
    }
    return patch;
  },
  // Keep each case's "follow up N days later" Task Management reminder in
  // sync with its Submit Date field (see syncDeadlineFollowUpTask above),
  // and — when the PAGCOR Stage actually changed this update — notify the
  // case's Owner, gated by Settings > Notification Settings.
  afterCreate: async (row) => syncDeadlineFollowUpTask(row),
  afterUpdate: async (row, user, id, existing) => {
    await syncDeadlineFollowUpTask(row);
    await notifyCaseStageChange(row, existing, user);
  },
  afterDelete: async (row) => syncDeadlineFollowUpTask({ ...row, deadline: null }),
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
  if (!ids.length) return sendJson(res, 400, { error: 'Please select at least one case.' });
  if (!pagcor.PAGCOR_STAGE_OPTIONS.includes(pagcorStage)) {
    return sendJson(res, 400, { error: `Invalid PAGCOR Stage: ${pagcorStage}` });
  }
  let updated = 0;
  const errors = [];
  for (const id of ids) {
    try {
      const existing = await store.find('cases', id);
      const patch = { pagcorStage };
      if (existing && existing.pagcorStage !== pagcorStage) patch.pagcorStageChangedAt = new Date().toISOString();
      const row = await store.update('cases', id, patch);
      if (row) { updated++; await notifyCaseStageChange(row, existing, user); }
      else errors.push(`${id}: not found`);
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
  if (!fileContentBase64) throw new Error('Please upload a file.');
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

// Version history for a document — every file it USED to have before being
// replaced (see POST .../replace-file below). The document row itself
// always holds the current file (same as before this existed); this list is
// purely the "older versions" trail, newest-replaced first. Mirrors the
// existing /api/contracts/:id/versions pattern above.
router.get('/api/documents/:id/versions', async (req, res, params) => {
  const user = await requirePerm(req, res, 'documents', 'view');
  if (!user) return;
  const versions = (await store.all('documentVersions')).filter((v) => v.documentId === params.id);
  versions.sort((a, b) => b.versionNo - a.versionNo);
  sendJson(res, 200, versions);
});

router.get('/api/documents/:id/versions/:versionId/download', async (req, res, params) => {
  const user = await requirePerm(req, res, 'documents', 'view');
  if (!user) return;
  const version = await store.find('documentVersions', params.versionId);
  if (!version || version.documentId !== params.id) return sendJson(res, 404, { error: 'Version not found' });
  const buffer = await storage.readFile(version.filePath);
  if (!buffer) return sendJson(res, 404, { error: 'File missing in storage' });
  res.writeHead(200, {
    'Content-Type': mimeFor(version.fileName || version.filePath),
    'Content-Disposition': `attachment; filename="${(version.fileName || 'download').replace(/"/g, '')}"`,
  });
  res.end(buffer);
});

// Replace a document's file with a new upload. The file being replaced
// isn't discarded — it's archived as a numbered entry in documentVersions
// first (so nothing is ever silently lost), then the document row itself is
// updated to point at the new file, same as any other edit. A document with
// no file yet (a metadata-only record) can also use this as its first
// upload — nothing to archive in that case.
router.post('/api/documents/:id/replace-file', async (req, res, params, body) => {
  const user = await requirePerm(req, res, 'documents', 'edit');
  if (!user) return;
  const doc = await store.find('documents', params.id);
  if (!doc) return sendJson(res, 404, { error: 'Document not found' });
  if (!body || !body.fileContentBase64) return sendJson(res, 400, { error: 'Please choose a file to upload.' });
  if (doc.filePath) {
    const existingVersions = (await store.all('documentVersions')).filter((v) => v.documentId === doc.id);
    await store.insert('documentVersions', {
      documentId: doc.id,
      versionNo: existingVersions.length + 1,
      fileName: doc.fileName || null,
      filePath: doc.filePath,
      uploadedBy: doc.uploadedBy || null,
      replacedBy: user.id,
    });
  }
  const filePath = await storage.saveBase64File(body.fileName, body.fileContentBase64);
  const updated = await store.update('documents', params.id, {
    fileName: body.fileName || doc.fileName, filePath, uploadedBy: user.id,
  });
  sendJson(res, 200, updated);
});

// "AI summary" — reads the document's already-stored file straight from
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
  if (!doc.filePath) return sendJson(res, 400, { error: 'This document has no attached file, so an AI summary cannot be generated.' });
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

// AI cross-document parameter consistency check — for a given case, reads
// every Document Center file linked to it (via each document's
// relatedCaseId, set on upload — see public/js/app.js's Document Center
// fields()) and asks Gemini to flag any key parameter (Game ID, Game
// Manual version, Min/Max Bet, RTP%, etc.) that's stated differently across
// them. Lives here rather than under /api/cases because it reads document
// bytes from Supabase Storage, same as /summarize above. Read-only, and
// (like summarizeDocument) never judges correctness/compliance — only
// whether values agree across documents. Requires 'cases' view permission
// since it's initiated from the case detail page, not the Document Center.
router.post('/api/cases/:id/check-consistency', async (req, res, params) => {
  const user = await requirePerm(req, res, 'cases', 'view');
  if (!user) return;
  const kase = await store.find('cases', params.id);
  if (!kase) return sendJson(res, 404, { error: 'Case not found' });

  const allDocs = await store.all('documents');
  const relatedDocs = allDocs.filter((d) => d.relatedCaseId === params.id && d.filePath);
  if (relatedDocs.length < 2) {
    return sendJson(res, 400, {
      error: 'This case needs at least 2 documents in Document Center with "Related Case" set to it (and a file attached) before an AI parameter consistency check can run.',
    });
  }

  try {
    const documents = [];
    for (const doc of relatedDocs) {
      const buffer = await storage.readFile(doc.filePath);
      if (!buffer) continue; // file record exists but bytes missing in storage — skip rather than fail the whole check
      const bareMimeType = mimeFor(doc.fileName || doc.filePath).split(';')[0].trim();
      documents.push({
        fileName: doc.title || doc.fileName,
        fileContentBase64: `data:${bareMimeType};base64,${buffer.toString('base64')}`,
      });
    }
    if (documents.length < 2) {
      return sendJson(res, 404, { error: 'The related documents\' file content could not be found in storage, so they cannot be compared.' });
    }
    const result = await ai.checkDocumentConsistency({
      caseTitle: kase.title,
      gameTitle: kase.gameTitle,
      gameId: kase.gameId,
      documents,
    });
    sendJson(res, 200, { ...result, documentsCompared: documents.length });
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
});

// Same consistency check as the Case-detail version above, but scoped to
// whatever documents Document Center's own Provider+Game folder view has
// on screen (documentIds, passed straight from the client) instead of
// requiring every document to already have a Related Case set. Not every
// game folder has a Case behind it yet — this lets Tiffany compare
// "everything filed under this game" directly from Document Center without
// first having to create a Case and re-link each file to it.
router.post('/api/documents/check-consistency', async (req, res, params, body) => {
  const user = await requirePerm(req, res, 'documents', 'view');
  if (!user) return;
  const ids = Array.isArray(body.documentIds) ? body.documentIds : [];
  if (ids.length < 2) {
    return sendJson(res, 400, { error: 'At least 2 documents with an attached file are needed before an AI parameter consistency check can run.' });
  }
  try {
    const docRecords = [];
    for (const id of ids) {
      const doc = await store.find('documents', id);
      if (doc && doc.filePath) docRecords.push(doc);
    }
    if (docRecords.length < 2) {
      return sendJson(res, 400, { error: 'At least 2 documents with an attached file are needed before an AI parameter consistency check can run.' });
    }
    const documents = [];
    for (const doc of docRecords) {
      const buffer = await storage.readFile(doc.filePath);
      if (!buffer) continue; // file record exists but bytes missing in storage — skip rather than fail the whole check
      const bareMimeType = mimeFor(doc.fileName || doc.filePath).split(';')[0].trim();
      documents.push({
        fileName: doc.title || doc.fileName,
        fileContentBase64: `data:${bareMimeType};base64,${buffer.toString('base64')}`,
      });
    }
    if (documents.length < 2) {
      return sendJson(res, 404, { error: 'The documents\' file content could not be found in storage, so they cannot be compared.' });
    }
    const result = await ai.checkDocumentConsistency({
      gameTitle: body.gameTitle,
      gameId: body.gameId,
      documents,
    });
    sendJson(res, 200, { ...result, documentsCompared: documents.length });
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
});

// Tasks -----------------------------------------------------------------
crudRoutes({
  base: '/api/tasks', moduleName: 'tasks', collection: 'tasks',
  onCreate: async (body, user) => ({ ...body, createdBy: user.id }),
  afterCreate: async (row, user) => notifyTaskAssignee(row, null, user),
  afterUpdate: async (row, user, id, existing) => notifyTaskAssignee(row, existing, user),
});

// Calendar Events ---------------------------------------------------------
// Freeform items on the Calendar that are neither a Case's Submit Date nor
// a Task Management to-do — e.g. a meeting, a personal reminder, an office
// closure. Deliberately NOT run through crudRoutes()/MODULES: there's no
// "calendar" row in the roles table (same reasoning as canView('calendar')
// on the frontend — see app.js), so this only requires being logged in to
// view/create. Visible to everyone, same as every other calendar item, but
// only the creator (or an Admin) may edit/delete one, enforced below.
router.get('/api/calendar-events', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  sendJson(res, 200, await store.all('calendarEvents'));
});

router.post('/api/calendar-events', async (req, res, params, body) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  if (!body || !String(body.title || '').trim() || !body.date) {
    return sendJson(res, 400, { error: 'Title and Date are required.' });
  }
  const row = await store.insert('calendarEvents', {
    title: body.title.trim(), date: body.date, note: body.note || '', createdBy: user.id,
  });
  sendJson(res, 201, row);
});

async function requireCalendarEventOwner(req, res, id) {
  const user = await requireAuth(req, res);
  if (!user) return null;
  const existing = await store.find('calendarEvents', id);
  if (!existing) { sendJson(res, 404, { error: 'Not found' }); return null; }
  const role = await store.find('roles', user.roleId);
  if (existing.createdBy !== user.id && !(role && role.name === 'Admin')) {
    sendJson(res, 403, { error: 'Only the creator (or an Admin) can modify this event.' });
    return null;
  }
  return existing;
}

router.put('/api/calendar-events/:id', async (req, res, params, body) => {
  const existing = await requireCalendarEventOwner(req, res, params.id);
  if (!existing) return;
  if (!String(body.title || '').trim() || !body.date) {
    return sendJson(res, 400, { error: 'Title and Date are required.' });
  }
  const row = await store.update('calendarEvents', params.id, {
    title: body.title.trim(), date: body.date, note: body.note || '',
  });
  sendJson(res, 200, row);
});

router.delete('/api/calendar-events/:id', async (req, res, params) => {
  const existing = await requireCalendarEventOwner(req, res, params.id);
  if (!existing) return;
  await store.remove('calendarEvents', params.id);
  sendJson(res, 200, { ok: true });
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
  const settings = await getSystemSettings();
  if (notificationsEnabled(settings, 'notifyOnApprovalDecision') && approval.requestedBy !== user.id) {
    await notifyUser(approval.requestedBy, 'approval_decision', `Your request "${approval.title}" was ${decision.toLowerCase()}`, approval.id, 'approval');
  }
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

// Settings: System Settings (Notification / Submission / Required Document
// Settings tabs) — a single row, see getSystemSettings above. Not run
// through crudRoutes() since there's no list/create/delete here, just one
// row to read and edit.
router.get('/api/settings', async (req, res) => {
  const user = await requirePerm(req, res, 'settings', 'view');
  if (!user) return;
  sendJson(res, 200, await getSystemSettings());
});

router.put('/api/settings', async (req, res, params, body) => {
  const user = await requirePerm(req, res, 'settings', 'edit');
  if (!user) return;
  await getSystemSettings(); // ensure the row exists before patching it
  const patch = {};
  if (body.followUpDays !== undefined) {
    const days = Number(body.followUpDays);
    if (!Number.isFinite(days) || days <= 0) return sendJson(res, 400, { error: 'Follow-up window must be a positive number of days.' });
    patch.followUpDays = days;
  }
  if (body.requiredDocumentChecklist !== undefined) {
    if (!Array.isArray(body.requiredDocumentChecklist) || body.requiredDocumentChecklist.some((i) => !i || !String(i.label || '').trim())) {
      return sendJson(res, 400, { error: 'Each required document needs a label.' });
    }
    patch.requiredDocumentChecklist = body.requiredDocumentChecklist.map((i, idx) => ({
      key: i.key || `doc${idx}`, label: String(i.label).trim(),
    }));
  }
  if (body.notifications !== undefined) {
    patch.notifications = {
      notifyOnApprovalDecision: body.notifications.notifyOnApprovalDecision !== false,
      notifyOnTaskAssignment: body.notifications.notifyOnTaskAssignment !== false,
      notifyOnCaseStageChange: body.notifications.notifyOnCaseStageChange !== false,
    };
  }
  const updated = await store.update('settings', 'system', patch);
  sendJson(res, 200, updated);
});

module.exports = router;
