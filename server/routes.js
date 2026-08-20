'use strict';
const crypto = require('crypto');
const { Router, sendJson } = require('./router');
const store = require('./store');
const auth = require('./auth');
const storage = require('./storage');
const ai = require('./ai');
const pagcor = require('./pagcor');
const pagcorCheck = require('./pagcor-check');
const caseImport = require('./import');
const { canonicalProviderName } = require('./providers');
const telegram = require('./telegram');
const { mimeFor } = require('./mime');
const zipLite = require('./zip-lite');

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
// Settings > Notification/Submission Settings let an Admin configure,
// instead of leaving them as hardcoded constants scattered across
// routes.js/pagcor.js. Falls back to those original hardcoded values
// (30-day follow-up, all notification triggers on) the first time this is
// ever read, so a fresh install behaves exactly like before this existed.
// (This used to also default a `requiredDocumentChecklist` template for the
// PAGCOR Checklist feature — removed along with that feature; see
// server/pagcor.js's header comment.)
//
// providerTelegramChatIds (added 2026-08-12): a Provider-name -> Telegram
// group chat-ID map, edited in Settings > Telegram Notifications, used by
// notifyCaseStageChange() below to post a status update straight into that
// Provider's own group whenever a case's PAGCOR Stage changes — she was
// doing this by hand in Telegram every time. Only PAGCOR Stage itself
// (which comes from PAGCOR, and genuinely can't be auto-detected — someone
// still has to call/check with PAGCOR and update it here) stays manual;
// everything downstream of "the stage just changed" is now automatic. See
// server/telegram.js for the actual send + one-time bot setup notes.
async function getSystemSettings() {
  let settings = await store.find('settings', 'system');
  if (!settings) {
    settings = await store.insert('settings', {
      id: 'system',
      followUpDays: 30,
      notifications: {
        notifyOnApprovalDecision: true,
        notifyOnTaskAssignment: true,
        notifyOnCaseStageChange: true,
        notifyTelegramOnCaseStageChange: true,
        // Added 2026-08-18, at Tiffany's request — whether the due-today
        // follow-up reminder is sent via Telegram, straight to the
        // follow-up task's Assignee (using the Telegram Chat ID on their
        // own User record — see checkAndSendFollowUpReminders). An earlier
        // Resend-based email version of this (notifyOnFollowUpDueEmail /
        // settings.reminderEmail) was tried first, hit Resend's sandbox
        // "can only send to your own signup email" limit, and was removed
        // entirely (not just disabled) once Telegram replaced it — Telegram
        // has no domain-verification requirement and is naturally per-user.
        notifyOnFollowUpDueTelegram: true,
      },
      providerTelegramChatIds: {},
      checklistItems: pagcor.PAGCOR_CHECKLIST_ITEMS,
    });
  }
  return settings;
}

// checklistItems (added 2026-08-12, second round — Settings > Required
// Document Settings): the PAGCOR Checklist's items used to be the fixed
// PAGCOR_CHECKLIST_ITEMS constant in server/pagcor.js; now that list lives
// here instead, editable from Settings, so Tiffany can add/rename/remove
// tracked document types herself without needing a code change. A
// pre-existing settings row (any real install from before this field
// existed) won't have `checklistItems` set at all — falls back to the
// original hardcoded 3-item default in that case, same items as always,
// rather than silently becoming an empty checklist for existing users.
// Deliberately checks `Array.isArray`, not truthiness/length: an
// intentionally-emptied list (someone removed every item in Settings) is a
// real `[]`, which must stay empty, not silently repopulate with defaults.
function getChecklistItems(settings) {
  return Array.isArray(settings.checklistItems) ? settings.checklistItems : pagcor.PAGCOR_CHECKLIST_ITEMS;
}

// Turns a checklist item's display label into a stable object key (used as
// case.checklist.<key>) — e.g. "Game Manual" -> "gameManual", "RTP
// Certification" -> "rtpCertification", matching the naming convention the
// original hardcoded PAGCOR_CHECKLIST_ITEMS already used. Only used for
// brand-new items (see PUT /api/settings below) — editing an existing
// item's label keeps its original key, so renaming "Parameter" to
// "Parameters" doesn't orphan every case's already-saved checkbox state.
function slugifyChecklistKey(label) {
  const words = String(label || '').trim().toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return 'item';
  return words.map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join('');
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
// action they just took themselves. Also fires the Telegram notification
// to the case's Provider group (see notifyProviderTelegram below) — that
// one is NOT skipped for the acting user, since the Provider on the other
// end has no idea who clicked the button in Legal Genie.
// Multi-game cases (added 2026-08-19, at Tiffany's request — "多個遊戲放在同一
// 個案子，但遊戲細節跟狀態要分開"): a case created/edited through the new
// per-game UI carries `row.games` (an array, each with its own `id`,
// `gameTitle`, `gameId`, `pagcorStage`, etc.) instead of the old flat
// `row.pagcorStage`/`row.gameTitle`. Cases still coming from the older
// single-game paths (Excel import, AI multi-game intake — neither rewritten
// yet, deliberately, to keep this change small) keep producing the old flat
// shape, so every function below has to handle BOTH: notify once per
// changed game when `games` is present, otherwise fall back to exactly the
// old single-stage behavior so those older paths keep working unchanged.
async function notifyCaseStageChange(row, existing, actingUser) {
  if (!row || !existing) return;
  const settings = await getSystemSettings();
  if (Array.isArray(row.games)) {
    const oldById = new Map((existing.games || []).map((g) => [g.id, g]));
    for (const game of row.games) {
      const prior = oldById.get(game.id);
      if (!game.pagcorStage || (prior && prior.pagcorStage === game.pagcorStage)) continue;
      if (row.ownerId && row.ownerId !== actingUser.id && notificationsEnabled(settings, 'notifyOnCaseStageChange')) {
        await notifyUser(row.ownerId, 'case_stage_change', `Case "${row.title}" — game "${game.gameTitle || game.gameId || '(untitled)'}" status changed to "${game.pagcorStage}"`, row.id, 'case');
      }
      await notifyProviderTelegram(row, settings, game);
    }
    return;
  }
  if (!row.pagcorStage || existing.pagcorStage === row.pagcorStage) return;
  if (row.ownerId && row.ownerId !== actingUser.id && notificationsEnabled(settings, 'notifyOnCaseStageChange')) {
    await notifyUser(row.ownerId, 'case_stage_change', `Case "${row.title}" status changed to "${row.pagcorStage}"`, row.id, 'case');
  }
  await notifyProviderTelegram(row, settings, null);
}

// Posts a PAGCOR Stage update straight into the case's Provider's Telegram
// group, added 2026-08-12 at Tiffany's request — she was typing this same
// update out by hand in Telegram every time a submission's status changed.
// Best-effort only and deliberately silent on any expected "not configured
// yet" condition (no provider on the case, feature toggled off, no chat ID
// entered yet for this Provider) — those are normal states for a case or a
// fresh install, not errors. An actual Telegram API failure (bad token,
// bot not in the group, group deleted, etc.) is logged server-side but
// still never thrown further — a Telegram outage must never block or fail
// the underlying case save this is reporting on. `game` is the specific
// game whose stage just changed (multi-game case), or null for an
// old-style flat single-game case.
async function notifyProviderTelegram(row, settings, game) {
  if (!row.provider) return;
  if (!notificationsEnabled(settings, 'notifyTelegramOnCaseStageChange')) return;
  const chatId = (settings.providerTelegramChatIds || {})[row.provider];
  if (!chatId) return;
  const gameLabel = game ? (game.gameTitle || game.gameId || row.title) : (row.gameTitle || row.title);
  const stage = game ? game.pagcorStage : row.pagcorStage;
  const text = `📋 PAGCOR Submission Update\nGame: ${gameLabel}${row.caseNumber ? `\nCase: ${row.caseNumber}` : ''}\nStatus: ${stage}`;
  try {
    await telegram.sendTelegramMessage(chatId, text);
  } catch (err) {
    console.error(`[telegram] failed to notify Provider "${row.provider}" (case ${row.id}):`, err.message);
  }
}

// Reads a task's assignee(s) as an array regardless of which shape the
// stored row actually has: brand-new/edited tasks (added 2026-08-18, at
// Tiffany's request — "一筆任務可以指派給多個負責人") carry the real list in
// `assigneeIds`, while older tasks (and the auto-created follow-up task from
// syncDeadlineFollowUpTask below) only ever had the single `assigneeId`.
// Centralizing this in one place means every consumer (Dashboard's
// myTasks, filterPersonalTasks, notifyTaskAssignees, the Telegram/email
// follow-up reminder below) treats both shapes identically instead of each
// re-deriving its own fallback.
function taskAssigneeIds(t) {
  if (Array.isArray(t.assigneeIds)) return t.assigneeIds.filter(Boolean);
  return t.assigneeId ? [t.assigneeId] : [];
}

// Normalizes whichever of assigneeId/assigneeIds a Task Management request
// body actually sent into BOTH keys: `assigneeIds` (the real list) and
// `assigneeId` (kept in sync as assigneeIds[0], the "primary" assignee) so
// every older piece of code that still only reads a single assigneeId
// keeps working unchanged. Only touches these two keys when the request
// body actually mentions either one — a PUT that's only changing e.g.
// `status` must not blank out the existing assignees.
function normalizeTaskAssignees(body) {
  if (body.assigneeIds === undefined && body.assigneeId === undefined) return body;
  const ids = Array.isArray(body.assigneeIds)
    ? body.assigneeIds.filter(Boolean)
    : (body.assigneeId ? [body.assigneeId] : []);
  return { ...body, assigneeIds: ids, assigneeId: ids[0] || null };
}

// Notifies each newly-added Assignee on a task (a fresh task, or an existing
// one that just gained them as an assignee) — gated by Settings >
// Notification Settings > "Notify on task assignment". `existing` is null
// for a brand-new task (see crudRoutes' afterCreate). Someone who was
// already an assignee before this save isn't re-notified, and nobody is
// notified about adding themselves.
async function notifyTaskAssignees(row, existing, actingUser) {
  if (!row) return;
  const newIds = taskAssigneeIds(row);
  if (!newIds.length) return;
  const oldIds = new Set(existing ? taskAssigneeIds(existing) : []);
  const settings = await getSystemSettings();
  if (!notificationsEnabled(settings, 'notifyOnTaskAssignment')) return;
  for (const uid of newIds) {
    if (oldIds.has(uid) || uid === actingUser.id) continue;
    await notifyUser(uid, 'task_assigned', `You were assigned to task "${row.title}"`, row.id, 'task');
  }
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
  const [users, departments, roles, cases, contracts, settings] = await Promise.all([
    store.all('users'), store.all('departments'), store.all('roles'),
    store.all('cases'), store.all('contracts'), getSystemSettings(),
  ]);
  sendJson(res, 200, {
    users: users.map((u) => ({ id: u.id, fullName: u.fullName, username: u.username })),
    departments,
    roles: roles.map((r) => ({ id: r.id, name: r.name })),
    cases: cases.map((c) => ({ id: c.id, title: c.title, caseNumber: c.caseNumber })),
    contracts: contracts.map((c) => ({ id: c.id, title: c.title, contractNumber: c.contractNumber })),
    // The frontend can't reach getChecklistItems() itself (plain browser
    // JS, no server import) — sent here once at boot instead, alongside
    // everything else State.lookups already holds, so the PAGCOR Checklist
    // UI (case rows, case detail, the modal) all read the current
    // Settings-configured list rather than a hardcoded copy. See
    // renderTelegramSettingsTab's sibling, renderChecklistSettingsTab, for
    // where this gets edited.
    checklistItems: getChecklistItems(settings),
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
// Dashboard
// ---------------------------------------------------------------------------
router.get('/api/dashboard/summary', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const today = new Date();
  const in14 = new Date(today.getTime() + 14 * 86400000);

  const [tasks, cases, notifications, approvals] = await Promise.all([
    store.all('tasks'), store.all('cases'),
    store.all('notifications'), store.all('approvals'),
  ]);

  const myTasks = tasks.filter((t) => taskAssigneeIds(t).includes(user.id) && t.status !== 'Completed');
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
  upcomingDeadlines.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Follow-up window comes from Settings > Submission Settings (defaults to
  // 30 days, same as it's always been — see getSystemSettings above).
  const settings = await getSystemSettings();
  const followUpDays = Number.isFinite(settings.followUpDays) && settings.followUpDays > 0 ? settings.followUpDays : 30;

  // Flattens PAGCOR cases into one entry per game — a multi-game case
  // (Phase 2 model) contributes one entry per game in `games[]`, using that
  // game's own pagcorStage/pagcorStageChangedAt; an older flat single-game
  // case (or one still coming from a path that hasn't been rewritten)
  // contributes exactly one entry, same as before Phase 2. Every
  // stage-grouped Dashboard view below (the PAGCOR Kanban board, the
  // follow-up reminder list) is built from this same flat list so a
  // multi-game case's individual games show up wherever a single-game
  // case's own stage always did, instead of being invisible because the
  // case itself has no single top-level pagcorStage.
  function pagcorGameEntries(list) {
    const out = [];
    for (const c of list) {
      if (!c.provider) continue;
      if (Array.isArray(c.games)) {
        for (const g of c.games) {
          out.push({
            caseId: c.id, caseNumber: c.caseNumber, caseTitle: c.title, provider: c.provider,
            gameTitle: g.gameTitle, pagcorStage: g.pagcorStage,
            stageSince: g.pagcorStageChangedAt || c.createdAt,
            createdAt: c.createdAt,
          });
        }
      } else {
        out.push({
          caseId: c.id, caseNumber: c.caseNumber, caseTitle: c.title, provider: c.provider,
          gameTitle: c.gameTitle, pagcorStage: c.pagcorStage,
          stageSince: c.pagcorStageChangedAt || c.createdAt,
          createdAt: c.createdAt,
        });
      }
    }
    return out;
  }
  const pagcorEntries = pagcorGameEntries(cases);

  // Follow-up reminder — flags games that have been sitting in "For Review"
  // or "On Process" for followUpDays+ with nobody having followed up (i.e.
  // the Stage itself hasn't changed). This came directly from legal's
  // feedback that games silently stall at PAGCOR for weeks with no
  // visibility until someone happens to check. Falls back to createdAt for
  // older cases that predate the pagcorStageChangedAt field (see
  // crudRoutes' onCreate/onUpdate for cases in this file).
  const FOLLOW_UP_STAGES = ['For Review', 'On Process'];
  const followUpCutoff = new Date(today.getTime() - followUpDays * 86400000);
  const followUps = pagcorEntries
    .filter((e) => FOLLOW_UP_STAGES.includes(e.pagcorStage))
    .filter((e) => e.stageSince && new Date(e.stageSince) <= followUpCutoff)
    .sort((a, b) => new Date(a.stageSince) - new Date(b.stageSince))
    .map((e) => ({
      id: e.caseId,
      caseNumber: e.caseNumber,
      title: e.caseTitle,
      gameTitle: e.gameTitle,
      provider: e.provider,
      pagcorStage: e.pagcorStage,
      stageSince: e.stageSince,
      daysSince: Math.floor((today - new Date(e.stageSince)) / 86400000),
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
  // count, rather than every case, since a stage like "On Process"
  // can hold hundreds of games — the client links out to the filtered Case
  // Management list for the rest instead of rendering them all here.
  const PAGCOR_BOARD_SAMPLE_SIZE = 5;
  const pagcorBoard = pagcor.PAGCOR_STAGE_OPTIONS.map((stage) => {
    const inStage = pagcorEntries
      .filter((e) => e.pagcorStage === stage)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return {
      stage,
      count: inStage.length,
      sample: inStage.slice(0, PAGCOR_BOARD_SAMPLE_SIZE).map((e) => ({
        id: e.caseId,
        caseNumber: e.caseNumber,
        // Multi-game case: label with both the case title and this specific
        // game's title, so two different games under the same Provider case
        // don't render as indistinguishable cards on the board.
        title: e.gameTitle && e.gameTitle !== e.caseTitle ? `${e.caseTitle} — ${e.gameTitle}` : e.caseTitle,
        provider: e.provider,
      })),
    };
  });

  sendJson(res, 200, {
    pagcorBoard,
    pendingTasksCount: myTasks.length,
    orgPendingTasksCount: allPendingTasks.length,
    followUpDays,
    todaysTasks,
    recentlyUpdatedCases,
    upcomingDeadlines: upcomingDeadlines.slice(0, 10),
    recentNotifications: myNotifications,
    unreadNotificationsCount: notifications.filter((n) => n.userId === user.id && !n.isRead).length,
    followUps: followUps.slice(0, 10),
    followUpsCount: followUps.length,
    pendingApprovals,
    pendingApprovalsCount: pendingApprovals.length,
    counts: {
      cases: cases.filter((c) => c.status !== 'Closed').length,
    },
  });
});

// ---------------------------------------------------------------------------
// Generic list/get/create/update/delete factory
// ---------------------------------------------------------------------------
function crudRoutes({ base, moduleName, collection, onCreate, onUpdate, afterCreate, afterUpdate, afterDelete, filterList }) {
  // filterList(rows, user) -> rows the given user is allowed to see. Used both
  // for the list endpoint and (as a single-row check) for get/update/delete,
  // so a row hidden from the list can't be read/edited/deleted by guessing its id.
  async function visibleRow(row, user) {
    if (!row) return null;
    if (!filterList) return row;
    const visible = await filterList([row], user);
    return visible.length ? visible[0] : null;
  }

  router.get(base, async (req, res) => {
    const user = await requirePerm(req, res, moduleName, 'view');
    if (!user) return;
    const rows = await store.all(collection);
    sendJson(res, 200, filterList ? await filterList(rows, user) : rows);
  });

  router.get(`${base}/:id`, async (req, res, params) => {
    const user = await requirePerm(req, res, moduleName, 'view');
    if (!user) return;
    const row = await visibleRow(await store.find(collection, params.id), user);
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
    const existing = await visibleRow(await store.find(collection, params.id), user);
    if (!existing) return sendJson(res, 404, { error: 'Not found' });
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
    const existing = await visibleRow(await store.find(collection, params.id), user);
    if (!existing) return sendJson(res, 404, { error: 'Not found' });
    const ok = await store.remove(collection, params.id);
    if (!ok) return sendJson(res, 404, { error: 'Not found' });
    if (afterDelete) {
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
      assigneeIds: caseRow.ownerId ? [caseRow.ownerId] : [],
      type: 'team',
      status: 'To-Do',
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
  onCreate: async (body, user) => {
    const patch = { ...body, caseNumber: body.caseNumber || await store.nextNumber('case', 'CASE') };
    // Owner field removed from the multi-game case form 2026-08-20 (see
    // caseBaseFormFields() in app.js) — default to whoever is creating the
    // case so it's never left blank, instead of requiring it to be picked
    // by hand every time. Still overridable by any other caller that does
    // pass ownerId explicitly (e.g. Excel import's routes.js commit handler
    // below, which already sets it to the importing user).
    if (!patch.ownerId && user) patch.ownerId = user.id;
    // Normalize Provider spelling (e.g. "OP" -> "Omniplay") so the same
    // real-world provider never fragments into multiple entries across the
    // Case Management filter, Telegram routing, or the Dashboard — see
    // server/providers.js for the alias list.
    if (patch.provider) patch.provider = canonicalProviderName(patch.provider);
    // Multi-game case (added 2026-08-19 — see notifyCaseStageChange's header
    // comment): `body.games` is an array of { id, gameTitle, gameId,
    // gameVersion, gameType, withJackpot, pagcorStage, checklist, ... }, one
    // entry per game under this one case. Each game gets the same
    // auto-defaulting a single-game PAGCOR case always got — its own
    // starting stage, its own blank checklist, its own stamped
    // pagcorStageChangedAt — just applied per array entry instead of once on
    // the case itself. A case with no `games` (Commercial/IP/Litigation
    // cases, and anything still coming from the older single-game paths —
    // Excel import, AI multi-game intake) falls through to the original
    // flat-field behavior below, unchanged.
    if (Array.isArray(body.games)) {
      const settings = await getSystemSettings();
      const blankChecklist = () => Object.fromEntries(getChecklistItems(settings).map((i) => [i.key, false]));
      const now = new Date().toISOString();
      patch.games = body.games.map((g) => ({
        id: g.id || crypto.randomUUID(),
        ...g,
        pagcorStage: g.pagcorStage || 'Pending Documents',
        pagcorStageChangedAt: g.pagcorStageChangedAt || now,
        checklist: g.checklist || blankChecklist(),
      }));
      return patch;
    }
    // A case with a Provider set is a PAGCOR game-submission case — give it
    // the standard stage automatically so the user doesn't have to set it up
    // by hand every time. Cases without a Provider (Commercial, IP,
    // Litigation, etc.) are untouched.
    if (body.provider && !patch.pagcorStage) patch.pagcorStage = 'Pending Documents';
    // Same idea for the PAGCOR Checklist — a fresh PAGCOR case starts with
    // every currently-configured item unchecked (see Settings > Required
    // Document Settings / getChecklistItems above), unless the Excel import
    // path (server/import.js) already supplied real values read from the
    // sheet.
    if (body.provider && !patch.checklist) {
      const settings = await getSystemSettings();
      patch.checklist = Object.fromEntries(getChecklistItems(settings).map((i) => [i.key, false]));
    }
    // Stamp when the case entered its current PAGCOR Stage, so the Dashboard
    // can flag games that have been sitting in "For Review" /
    // "On Process" for the configured follow-up window without
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
  // pre-update row, handed in by crudRoutes' PUT handler. Multi-game case:
  // does the same per-game, stamping only the games whose stage actually
  // changed vs `existing.games`, leaving every other game's timestamp alone.
  onUpdate: async (body, user, id, existing) => {
    const patch = { ...body };
    if (patch.provider) patch.provider = canonicalProviderName(patch.provider);
    if (Array.isArray(patch.games)) {
      const oldById = new Map((existing && existing.games || []).map((g) => [g.id, g]));
      const now = new Date().toISOString();
      patch.games = patch.games.map((g) => {
        const prior = oldById.get(g.id);
        if (g.pagcorStage && (!prior || prior.pagcorStage !== g.pagcorStage)) {
          return { ...g, pagcorStageChangedAt: now };
        }
        return g;
      });
      return patch;
    }
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
// Multi-game case: `body.gameIds` (optional) narrows this to specific games
// within a selected case — e.g. only the 2 games (of 5) in a case that just
// got approved — instead of every game in that case. Any selected case
// without a matching entry in `gameIds` (or a legacy flat case, or
// `gameIds` omitted entirely) falls back to applying the new Stage to every
// game in that case, same as bulk stage update always did for a whole case.
router.post('/api/cases/bulk-update-stage', async (req, res, params, body) => {
  const user = await requirePerm(req, res, 'cases', 'edit');
  if (!user) return;
  const ids = Array.isArray(body.ids) ? body.ids : [];
  const { pagcorStage } = body;
  // caseId -> array of gameIds to target within that case (optional —
  // absent/empty means "every game in this case", see header comment).
  const gameIdsByCase = body.gameIds && typeof body.gameIds === 'object' ? body.gameIds : {};
  if (!ids.length) return sendJson(res, 400, { error: 'Please select at least one case.' });
  if (!pagcor.PAGCOR_STAGE_OPTIONS.includes(pagcorStage)) {
    return sendJson(res, 400, { error: `Invalid PAGCOR Stage: ${pagcorStage}` });
  }
  let updated = 0;
  const errors = [];
  for (const id of ids) {
    try {
      const existing = await store.find('cases', id);
      if (!existing) { errors.push(`${id}: not found`); continue; }
      const now = new Date().toISOString();
      let patch;
      if (Array.isArray(existing.games)) {
        // A key present in gameIds for this case (even an empty array — every
        // game unchecked in the bulk modal) means "target exactly this set",
        // as opposed to the key being absent entirely, which means "every
        // game" (see header comment). An explicit empty list has nothing to
        // update, so skip this case without writing or counting it.
        if (Array.isArray(gameIdsByCase[id]) && gameIdsByCase[id].length === 0) continue;
        const targetIds = Array.isArray(gameIdsByCase[id]) ? new Set(gameIdsByCase[id]) : null;
        patch = {
          games: existing.games.map((g) => {
            if (targetIds && !targetIds.has(g.id)) return g;
            if (g.pagcorStage === pagcorStage) return g;
            return { ...g, pagcorStage, pagcorStageChangedAt: now };
          }),
        };
      } else {
        patch = { pagcorStage };
        if (existing.pagcorStage !== pagcorStage) patch.pagcorStageChangedAt = now;
      }
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
    // updateFn used to call store.update() directly, bypassing the same
    // pagcorStageChangedAt stamping + notifyCaseStageChange (owner
    // notification + Telegram post to the Provider's group) that
    // bulk-update-stage and a normal case Edit both go through — meaning
    // approving a game via a real scanned PAGCOR notice letter (arguably
    // the most important moment to notify anyone) silently notified no
    // one. `cases` here is the same pre-fetched snapshot
    // applyApprovalNoticeGames matches against, so looking a case up in it
    // gives the correct "before" state for the change without an extra
    // store.find() round trip.
    const updateFn = async (id, patch) => {
      const existing = cases.find((c) => c.id === id) || null;
      const fullPatch = { ...patch };
      if (existing && existing.pagcorStage !== patch.pagcorStage) fullPatch.pagcorStageChangedAt = new Date().toISOString();
      const row = await store.update('cases', id, fullPatch);
      if (row) await notifyCaseStageChange(row, existing, user);
      return row;
    };
    const result = await pagcorCheck.applyApprovalNoticeGames(cases, extracted.games, updateFn);
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
    // Pass the currently-configured checklist items through so the preview
    // (and, more importantly, the commit below) auto-detect spreadsheet
    // columns matching whatever items are configured in Settings > Required
    // Document Settings right now, not just the original hardcoded 3 — see
    // DEFAULT_CHECKLIST_ITEMS / detectColumns in server/import.js.
    const checklistItems = getChecklistItems(await getSystemSettings());
    const sheets = caseImport.preview(buffer, body.fileName, checklistItems);
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
  const checklistItems = getChecklistItems(await getSystemSettings());

  // Stage 1: parse every included sheet into rows, tagged with the sheet
  // name they came from (for error messages).
  const allRows = [];
  for (const s of sheetSettings) {
    if (!s || s.include === false) continue;
    try {
      const rows = caseImport.buildCasesForSheet(buffer, body.fileName, s.name, { provider: s.provider, pagcorStage: s.pagcorStage }, checklistItems);
      rows.forEach((row) => allRows.push({ row, sheetName: s.name }));
    } catch (err) {
      errors.push(`${s.name}: ${err.message}`);
    }
  }

  // Stage 1.5: a "reskin annotation" sheet (see the reskinOf alias comment
  // in server/import.js — e.g. Tiffany's "Reskin games" tab) lists games
  // that TURN OUT to already be present as real submission rows on another
  // sheet in the same workbook — Tiffany confirmed her "Reskin games" rows
  // (Manny Moreways_22107, Muscle Manny_22108, Halo Halo) are the exact same
  // games as rows 11/12/17 of her "fa chai" tab, just with an extra note on
  // which already-approved game each is a reskin of. Importing both sheets
  // as-is would create a duplicate case for each. Instead: for every row
  // flagged with reskinOf, pull the numeric ID embedded in its own title
  // (e.g. "Manny Moreways_22107" -> "22107") and look for another row in
  // THIS SAME COMMIT (any sheet/provider) whose real Game ID matches it. A
  // match means it's the same game — merge the reskinOf note onto that row
  // and drop the reskin row entirely so it never becomes its own case. Not
  // every reskin row's title actually carries an ID suffix (Tiffany's own
  // "Halo Halo" row doesn't, unlike "Manny Moreways_22107"), so a row with
  // no extractable ID (or whose extracted ID matches nothing) falls back to
  // a normalized-title match via titlesLikelySameGame() (same helper Stage
  // 2.5 below uses). Only once BOTH signals fail is a reskin row left alone
  // to become its own case, same as before — so data is never silently
  // dropped just because neither match was found.
  function extractTrailingNumericId(s) {
    const m = /(\d+)\s*$/.exec(String(s || '').trim());
    return m ? m[1] : null;
  }
  for (const reskinEntry of allRows.filter((e) => e.row.reskinOf)) {
    const matchId = extractTrailingNumericId(reskinEntry.row.gameTitle);
    const target = (matchId && allRows.find((e) => e !== reskinEntry && !e.row.reskinOf
      && (e.row.gameId || '').trim().toLowerCase() === matchId.toLowerCase()))
      || allRows.find((e) => e !== reskinEntry && !e.row.reskinOf
        && titlesLikelySameGame(e.row.gameTitle, reskinEntry.row.gameTitle));
    if (target) {
      target.row.reskinOf = reskinEntry.row.reskinOf;
      allRows.splice(allRows.indexOf(reskinEntry), 1);
    }
  }

  // Stage 2: a real workbook can list the same game in more than one sheet
  // — e.g. a Provider's own pending-list tab AND the master "APPROVED" tab,
  // once that game has actually been approved (the Provider tab just never
  // got updated). Tiffany confirmed: treat that as ONE case, using the
  // APPROVED-tab version (final Approved stage), not two separate
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

  // Stage 3: group surviving rows into multi-game Cases, one per Provider —
  // Provider lives at the case level, each game inside tracks its own
  // PAGCOR stage/checklist independently (see the multi-game Case model,
  // Phase 1).
  // Changed 2026-08-20 at Tiffany's request: a NEW import batch (a
  // different day's file, or a re-upload) must always create a fresh
  // Provider case — it no longer looks for or appends into a Provider case
  // left over from an earlier import, even for the exact same Provider.
  // Different upload batches represent different points in time and Tiffany
  // wants them to stay separate records she can tell apart (see the
  // (${creationDateLabel}) suffix added to the case title below, which is
  // always this case's real creation date — not a separately-computed
  // "when this import ran" stamp; see that comment for why). The ONLY
  // way games join an already-existing case now is the manual "Edit Case"
  // Add/Remove Game flow inside the app itself (showCaseFormModal in
  // app.js) — a deliberate, in-app edit of one specific case, not an
  // import. (An import CAN still span multiple sheets for the same
  // Provider in one go — e.g. a Provider's own tab plus rows for it that
  // also appear on the shared "APPROVED" tab — those still collapse into
  // one case, since `groups` above already gathers every row for a
  // Provider from this single commit before this loop even starts; it's
  // only re-imports on a LATER, separate commit that now get their own new
  // case instead of merging.) Pre-Phase-2 (legacy flat, single-game) cases
  // are left completely untouched — never migrated, never appended to —
  // only ever checked so a game already recorded on one of them isn't
  // re-imported as a duplicate elsewhere.
  const existingCases = await store.all('cases');
  const legacyFlatCases = existingCases.filter((c) => c.provider && !Array.isArray(c.games));
  const existingKeys = new Set(legacyFlatCases.map(importDedupKey));
  const existingByProviderGameId = new Map();
  for (const c of legacyFlatCases) {
    const gid = (c.gameId || '').trim();
    if (!gid) continue;
    const pgKey = `${(c.provider || '').trim().toLowerCase()}|${gid.toLowerCase()}`;
    if (!existingByProviderGameId.has(pgKey)) existingByProviderGameId.set(pgKey, []);
    existingByProviderGameId.get(pgKey).push(c);
  }
  function rowMatchesExistingGame(row, games) {
    return (games || []).some((g) => {
      if (row.gameId && g.gameId && row.gameId.trim().toLowerCase() === g.gameId.trim().toLowerCase()
          && titlesLikelySameGame(g.gameTitle, row.gameTitle)) return true;
      return (g.gameTitle || '').trim().toLowerCase() === (row.gameTitle || row.title || '').trim().toLowerCase();
    });
  }

  function rowToGame(row) {
    return {
      id: crypto.randomUUID(),
      gameTitle: row.gameTitle,
      gameId: row.gameId,
      gameVersion: row.gameVersion,
      gameType: row.gameType,
      withJackpot: row.withJackpot,
      // Set only for rows from a "reskin"-style sheet (see the reskinOf
      // alias comment in server/import.js) — the already-PAGCOR-approved
      // game this one is a re-themed version of. Surfaced on the game card
      // in app.js so it's clear at a glance this isn't a brand-new
      // submission. null for every ordinary imported row.
      reskinOf: row.reskinOf || null,
      jackpotTestingDate: null,
      jackpotReportSubmitted: null,
      testingScreenshotsSubmitted: null,
      pagcorStage: row.pagcorStage,
      pagcorStageChangedAt: row.pagcorStageChangedAt,
      checklist: row.checklist,
      rejectionReason: null,
      submissionAttempt: null,
      loaExpiryDate: null,
    };
  }

  // Case-level status when it's entirely composed of imported games: open
  // until every game inside is done (mirrors the natural reading of "is
  // this case still active").
  function caseStatusFromGames(games) {
    if (!games.length) return 'Open';
    const statuses = games.map((g) => caseImport.statusForStage(g.pagcorStage));
    if (statuses.every((s) => s === 'Closed')) return 'Closed';
    if (statuses.some((s) => s === 'In Progress')) return 'In Progress';
    return 'Open';
  }

  let skippedExisting = 0;
  const groups = new Map(); // providerKey -> { providerDisplay, rows: [] }
  for (const { row, sheetName } of byKey.values()) {
    const key = importDedupKey(row);
    if (existingKeys.has(key)) { skippedExisting++; continue; }
    const gid = (row.gameId || '').trim();
    const pgKey = gid ? `${(row.provider || '').trim().toLowerCase()}|${gid.toLowerCase()}` : null;
    if (pgKey && (existingByProviderGameId.get(pgKey) || []).some((c) => titlesLikelySameGame(c.gameTitle || c.title, row.gameTitle || row.title))) {
      skippedExisting++;
      continue;
    }
    const providerKey = (row.provider || '').trim().toLowerCase();
    if (!groups.has(providerKey)) groups.set(providerKey, { providerDisplay: row.provider, rows: [] });
    groups.get(providerKey).rows.push({ row, sheetName });
  }

  let casesCreated = 0;
  // Always 0 now — kept in the response shape (app.js's import summary
  // reads result.casesUpdated) since every Provider group takes the
  // "create a new case" path below; see the Stage 3 comment above for why.
  let casesUpdated = 0;
  let gamesAdded = 0;
  for (const [, group] of groups) {
    const newGames = [];
    for (const { row } of group.rows) {
      if (rowMatchesExistingGame(row, newGames)) {
        skippedExisting++;
        continue;
      }
      newGames.push(rowToGame(row));
    }
    if (!newGames.length) continue;
    try {
      const caseNumber = await store.nextNumber('case', 'CASE');
      // Date suffix appended to every case title created by this commit —
      // see the Stage 3 comment above for why (one case per import batch,
      // so the same Provider can now have several — the title's date is
      // what tells them apart in Case Management's list view). Changed
      // 2026-08-20 (same day, after Tiffany clarified) to explicitly pass
      // this exact timestamp as the record's own `createdAt` too, instead
      // of letting store.insert() stamp its own `new Date()` a moment
      // later — so the date printed in the title is always, by
      // construction, this case's real creation date, not a
      // similar-but-technically-separate "when the import ran" timestamp
      // that just happens to usually match.
      const createdAt = new Date().toISOString();
      const creationDateLabel = new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      await store.insert('cases', {
        title: `${group.providerDisplay} — Game Submissions (${creationDateLabel})`,
        type: 'Regulatory',
        priority: 'Medium',
        status: caseStatusFromGames(newGames),
        provider: group.providerDisplay,
        description: 'Imported from Excel.',
        ownerId: user.id,
        caseNumber,
        games: newGames,
        createdAt,
      });
      casesCreated++;
      gamesAdded += newGames.length;
    } catch (err) {
      errors.push(`${group.providerDisplay}: ${err.message}`);
    }
  }

  sendJson(res, 200, {
    created: gamesAdded,
    casesCreated,
    casesUpdated,
    gamesAdded,
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

// Note: the Contract Management module/UI was removed at Tiffany's request
// (2026-08-11) — there is no longer a dedicated /api/contracts CRUD or
// versions API. Existing `contracts`/`contractVersions` records are kept
// in the database untouched; they're still readable via /api/lookups
// (contractName() in app.js) so Tasks/Documents can keep their existing
// "Related Contract" field working, they're just no longer manageable
// through their own screen.

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

// The "AI Summarize" per-document button (used to live here as
// POST /api/documents/:id/summarize) was removed 2026-08-18 at Tiffany's
// request — Document Center should just manage files, no AI on that page.
// Document Center's AI Smart-Fill on upload (extractFields(), used by
// POST /api/ai/extract/documents above) was deliberately kept — only this
// summarize button was removed. server/ai.js's summarizeDocument() is still
// defined there but no longer called from anywhere; left in place rather
// than deleted in case this is wanted back later — it's inert either way.

// AI cross-document parameter consistency check — for a given case, reads
// every Document Center file linked to it (via each document's
// relatedCaseId, set on upload — see public/js/app.js's Document Center
// fields()) and asks Gemini to flag any key parameter (Game ID, Game
// Manual version, Min/Max Bet, RTP%, etc.) that's stated differently across
// them. Lives here rather than under /api/cases because it reads document
// bytes straight from Supabase Storage (same as the now-removed
// /summarize route used to). Read-only, and (like server/ai.js's
// summarizeDocument) never judges correctness/compliance — only
// whether values agree across documents. Requires 'cases' view permission
// since it's initiated from the case detail page, not the Document Center.
// Matches a document to a specific game within a multi-game case. Prefers
// `relatedGameId` — the game's own stable id, stamped on every document
// uploaded through the case detail page's per-game upload flow (see
// showCaseDocumentUploadModal in app.js) — so a document uploaded for Game A
// is never treated as Game B's just because two games happen to share a
// title, and stays correctly linked even if a game is later renamed. Older
// documents (uploaded before this field existed, or filed some other way)
// fall back to matching gameTitle case-insensitively/trimmed, the same way
// Document Center's own folder navigation already groups files by game. A
// game with no title and no id on any document never matches anything
// (nothing to safely compare against).
function normMatchKey(s) {
  return String(s || '').trim().toLowerCase();
}
function docsForGame(relatedDocs, game) {
  if (!game) return [];
  const byId = game.id ? relatedDocs.filter((d) => d.relatedGameId === game.id) : [];
  if (byId.length) return byId;
  const gt = normMatchKey(game.gameTitle);
  if (!gt) return [];
  return relatedDocs.filter((d) => !d.relatedGameId && normMatchKey(d.gameTitle) === gt);
}

router.post('/api/cases/:id/check-consistency', async (req, res, params, body) => {
  const user = await requirePerm(req, res, 'cases', 'view');
  if (!user) return;
  const kase = await store.find('cases', params.id);
  if (!kase) return sendJson(res, 404, { error: 'Case not found' });

  const allDocs = await store.all('documents');
  const caseDocs = allDocs.filter((d) => d.relatedCaseId === params.id && d.filePath);

  // Multi-game case: documents from different games must never be compared
  // to each other, so this always runs scoped to exactly one game — the
  // caller (a per-game "AI Parameter Consistency Check" button, see
  // renderCaseDetail in app.js) must say which one.
  let targetGame = null;
  let relatedDocs = caseDocs;
  if (Array.isArray(kase.games)) {
    const gameId = body && body.gameId;
    if (!gameId) {
      return sendJson(res, 400, { error: 'This case has multiple games — please run the AI Parameter Consistency Check from a specific game.' });
    }
    targetGame = kase.games.find((g) => g.id === gameId);
    if (!targetGame) return sendJson(res, 404, { error: 'Game not found on this case.' });
    relatedDocs = docsForGame(caseDocs, targetGame);
  }

  if (relatedDocs.length < 2) {
    return sendJson(res, 400, {
      error: targetGame
        ? `Game "${targetGame.gameTitle || '(untitled)'}" needs at least 2 documents in Document Center (matching this game's title, with a file attached) before an AI parameter consistency check can run.`
        : 'This case needs at least 2 documents in Document Center with "Related Case" set to it (and a file attached) before an AI parameter consistency check can run.',
    });
  }

  try {
    const documents = [];
    const comparedDocIds = [];
    for (const doc of relatedDocs) {
      const buffer = await storage.readFile(doc.filePath);
      if (!buffer) continue; // file record exists but bytes missing in storage — skip rather than fail the whole check
      const bareMimeType = mimeFor(doc.fileName || doc.filePath).split(';')[0].trim();
      documents.push({
        fileName: doc.title || doc.fileName,
        fileContentBase64: `data:${bareMimeType};base64,${buffer.toString('base64')}`,
      });
      comparedDocIds.push(doc.id);
    }
    if (documents.length < 2) {
      return sendJson(res, 404, { error: 'The related documents\' file content could not be found in storage, so they cannot be compared.' });
    }
    const result = await ai.checkDocumentConsistency({
      caseTitle: kase.title,
      gameTitle: targetGame ? targetGame.gameTitle : kase.gameTitle,
      gameId: targetGame ? targetGame.gameId : kase.gameId,
      documents,
    });

    // Persist so the Case Detail "Download All Documents" gate (see
    // GET /api/cases/:id/download-all below) can require a passed AI check
    // without re-running Gemini on every page load. documentIds records
    // exactly which documents were compared, so a later upload/replace/
    // removal can be detected as making this result stale — see
    // isConsistencyCheckStale below. Multi-game case: this lives on the
    // specific game inside `games[]` that was checked, not on the case
    // itself — each game's "ready to download" state is independent.
    const lastConsistencyCheck = {
      overallStatus: result.overallStatus || null,
      checkedAt: new Date().toISOString(),
      documentIds: comparedDocIds,
    };
    if (targetGame) {
      const newGames = kase.games.map((g) => (g.id === targetGame.id ? { ...g, lastConsistencyCheck } : g));
      await store.update('cases', params.id, { games: newGames });
    } else {
      await store.update('cases', params.id, { lastConsistencyCheck });
    }

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

// A stored lastConsistencyCheck is only trustworthy for the exact set of
// documents it compared — if a document was uploaded, replaced, or removed
// from the case since (see showCaseDocumentUploadModal / Document Center),
// the previously "ready" verdict no longer reflects what's actually on file.
// Compares the stored documentIds against the case's current
// relatedCaseId-linked, file-bearing documents (order-independent) to decide
// whether a fresh AI check is required before the download-all gate opens.
function isCheckStale(check, currentDocs) {
  if (!check || !Array.isArray(check.documentIds)) return true;
  const currentIds = currentDocs.map((d) => d.id).sort();
  const lastIds = [...check.documentIds].sort();
  if (currentIds.length !== lastIds.length) return true;
  return currentIds.some((id, i) => id !== lastIds[i]);
}
function isConsistencyCheckStale(kase, currentDocs) {
  return isCheckStale(kase.lastConsistencyCheck, currentDocs);
}

// Case-level "is this case ready to download" gate. Multi-game case: ready
// only once EVERY game that actually has 2+ filed documents has its own
// passed, non-stale check — a game with fewer than 2 docs is left out of
// the gate entirely (nothing to have checked yet), same as the case-level
// gate always let a case with <2 total docs through this specific check
// (download still separately requires at least 1 filed doc — see the route).
function caseDownloadGateStatus(kase, relatedDocs) {
  if (Array.isArray(kase.games) && kase.games.length) {
    for (const g of kase.games) {
      const gameDocs = docsForGame(relatedDocs, g);
      if (gameDocs.length < 2) continue;
      const label = g.gameTitle || '(untitled game)';
      if (!g.lastConsistencyCheck || g.lastConsistencyCheck.overallStatus !== 'ready') {
        return { ok: false, error: `Please run the AI Parameter Consistency Check for game "${label}" and confirm no anomalies before downloading.` };
      }
      if (isCheckStale(g.lastConsistencyCheck, gameDocs)) {
        return { ok: false, error: `Documents for game "${label}" have changed since its last AI Parameter Consistency Check. Please re-run it before downloading.` };
      }
    }
    return { ok: true };
  }
  if (!kase.lastConsistencyCheck || kase.lastConsistencyCheck.overallStatus !== 'ready') {
    return { ok: false, error: 'Please run the AI Parameter Consistency Check and confirm it comes back with no anomalies before downloading.' };
  }
  if (isConsistencyCheckStale(kase, relatedDocs)) {
    return { ok: false, error: 'Documents have changed since the last AI Parameter Consistency Check. Please re-run the check and confirm no anomalies before downloading.' };
  }
  return { ok: true };
}

// Strip characters that are illegal (or awkward) in a filename on Windows/
// macOS/most zip tools, since these become entry names inside the .zip and,
// for the folder name, part of the downloaded file's own filename.
function safeFileSegment(name) {
  return String(name || '').replace(/[\\/:*?"<>|]/g, '-').trim() || 'file';
}

// One-click "Download All Documents" for a Case — bundles every document
// linked to this case (relatedCaseId) into a single .zip, but only once the
// AI Parameter Consistency Check (POST /api/cases/:id/check-consistency
// above) last came back "ready" — every required document type present,
// every tracked parameter present, nothing mismatched — for the CURRENT set
// of documents (not stale — see isConsistencyCheckStale). This used to also
// require a separate manually-maintained PAGCOR Checklist to be fully
// checked off; that checklist was removed at Tiffany's request once the AI
// check's own documentCompleteness section started covering "which required
// documents are missing" automatically, making the manual checklist
// redundant. Uses zip-lite.js's dependency-free ZIP writer, same reasoning
// as xlsx-lite.js: this sandbox has no npm registry access, so a package
// like archiver/jszip can't be installed.
router.get('/api/cases/:id/download-all', async (req, res, params) => {
  const user = await requirePerm(req, res, 'cases', 'view');
  if (!user) return;
  const kase = await store.find('cases', params.id);
  if (!kase) return sendJson(res, 404, { error: 'Case not found' });

  const allDocs = await store.all('documents');
  const relatedDocs = allDocs.filter((d) => d.relatedCaseId === params.id && d.filePath);
  if (relatedDocs.length === 0) {
    return sendJson(res, 400, { error: 'This case has no uploaded documents yet.' });
  }

  const gate = caseDownloadGateStatus(kase, relatedDocs);
  if (!gate.ok) return sendJson(res, 400, { error: gate.error });

  try {
    const folderName = safeFileSegment(`${kase.caseNumber || kase.id} - ${kase.title || kase.gameTitle || 'Case'}`);
    const usedNames = new Set();
    const files = [];
    for (const doc of relatedDocs) {
      const buffer = await storage.readFile(doc.filePath);
      if (!buffer) continue; // file record exists but bytes missing in storage — skip rather than fail the whole download
      const baseName = safeFileSegment(doc.fileName || doc.title || `document-${doc.id}`);
      let name = baseName;
      let n = 2;
      while (usedNames.has(name)) {
        const dot = baseName.lastIndexOf('.');
        name = dot > 0 ? `${baseName.slice(0, dot)} (${n})${baseName.slice(dot)}` : `${baseName} (${n})`;
        n += 1;
      }
      usedNames.add(name);
      files.push({ name: `${folderName}/${name}`, data: buffer });
    }
    if (!files.length) {
      return sendJson(res, 404, { error: 'This case\'s document files could not be found in storage.' });
    }
    const zipBuffer = zipLite.buildZip(files);
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${folderName.replace(/"/g, '')}.zip"`,
    });
    res.end(zipBuffer);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
});

// Knowledge Base ------------------------------------------------------------
// A repository of reference material (PAGCOR Guidelines/Circulars, company
// SOPs, application forms, etc.) plus a company-approved FAQ list — see the
// "Knowledge Base" module in Tiffany's Game Submission Management System
// Proposal doc. This is deliberately just the storage/organization piece
// (upload, categorize, version, Draft/Pending Review/Active/Archived
// status) — no AI Q&A search over it yet. The proposal's stated purpose is
// so a future AI (e.g. the Telegram Partner Assistant, if that's ever
// built) has an approved source to cite instead of guessing; this alone is
// also directly useful today as a searchable, organized reference the legal
// team can browse.
//
// kbDocuments supports two kinds of entry, both sharing one collection: an
// actual uploaded file (fileName/filePath, same storage.saveBase64File
// pattern as /api/documents below), or a pointer to an external official
// source (sourceUrl) — most of the real PAGCOR reference material Tiffany
// gave us to seed this with (see server/seed.js) is the latter: links to
// PAGCOR's own regulatory pages rather than files we'd host ourselves.
crudRoutes({
  base: '/api/kb-documents', moduleName: 'knowledgeBase', collection: 'kbDocuments',
  onCreate: async (body, user) => {
    const { fileContentBase64, ...rest } = body;
    const filePath = fileContentBase64 ? await storage.saveBase64File(body.fileName, fileContentBase64) : null;
    return { ...rest, filePath, uploadedBy: user.id };
  },
  onUpdate: async (body) => {
    const { fileContentBase64, ...rest } = body;
    if (!fileContentBase64) return rest;
    return { ...rest, filePath: await storage.saveBase64File(body.fileName, fileContentBase64) };
  },
});

router.get('/api/kb-documents/:id/download', async (req, res, params) => {
  const user = await requirePerm(req, res, 'knowledgeBase', 'view');
  if (!user) return;
  const doc = await store.find('kbDocuments', params.id);
  if (!doc || !doc.filePath) return sendJson(res, 404, { error: 'File not available' });
  const buffer = await storage.readFile(doc.filePath);
  if (!buffer) return sendJson(res, 404, { error: 'File missing in storage' });
  res.writeHead(200, {
    'Content-Type': mimeFor(doc.fileName || doc.filePath),
    'Content-Disposition': `attachment; filename="${(doc.fileName || 'download').replace(/"/g, '')}"`,
  });
  res.end(buffer);
});

// Company-approved FAQ entries — separate from kbDocuments since these are
// short Q&A text written directly in the system, not a source document.
crudRoutes({
  base: '/api/kb-faqs', moduleName: 'knowledgeBase', collection: 'kbFaqs',
  onCreate: async (body, user) => ({ ...body, createdBy: user.id }),
});

// Tasks -----------------------------------------------------------------
// "Personal" tasks are only visible to their creator/assignee (or an Admin) —
// "Team" tasks stay visible to anyone with Tasks-module view permission.
async function filterPersonalTasks(rows, user) {
  const role = await store.find('roles', user.roleId);
  if (role && role.name === 'Admin') return rows;
  return rows.filter((t) => t.type !== 'personal' || t.createdBy === user.id || taskAssigneeIds(t).includes(user.id));
}

crudRoutes({
  base: '/api/tasks', moduleName: 'tasks', collection: 'tasks',
  onCreate: async (body, user) => ({ ...normalizeTaskAssignees(body), createdBy: user.id }),
  onUpdate: async (body) => normalizeTaskAssignees(body),
  afterCreate: async (row, user) => notifyTaskAssignees(row, null, user),
  afterUpdate: async (row, user, id, existing) => notifyTaskAssignees(row, existing, user),
  filterList: filterPersonalTasks,
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
  const current = await getSystemSettings(); // also ensures the row exists before patching it
  const patch = {};
  if (body.followUpDays !== undefined) {
    const days = Number(body.followUpDays);
    if (!Number.isFinite(days) || days <= 0) return sendJson(res, 400, { error: 'Follow-up window must be a positive number of days.' });
    patch.followUpDays = days;
  }
  // Merged on top of the CURRENT row's notifications, not rebuilt from
  // scratch — each Settings tab (Notification Settings / Telegram
  // Notifications) only ever submits the 2-3 keys it actually renders, so
  // rebuilding from just `body.notifications` would silently reset every
  // OTHER tab's toggle back to its `!== false` default (true) on every
  // save. This was a real bug: saving the plain Notification Settings tab
  // (which never mentions notifyTelegramOnCaseStageChange) was silently
  // re-enabling Telegram notifications even after someone had explicitly
  // turned them off in the Telegram Notifications tab.
  if (body.notifications !== undefined) {
    const existingNotifications = current.notifications || {};
    patch.notifications = { ...existingNotifications };
    for (const key of ['notifyOnApprovalDecision', 'notifyOnTaskAssignment', 'notifyOnCaseStageChange', 'notifyTelegramOnCaseStageChange', 'notifyOnFollowUpDueTelegram']) {
      if (body.notifications[key] !== undefined) patch.notifications[key] = body.notifications[key] !== false;
    }
  }
  // providerTelegramChatIds: a plain { "FC": "-1001234567890", ... } map,
  // edited as a free-form list in Settings > Telegram Notifications (see
  // renderTelegramSettingsTab in app.js) since Provider is just a free-text
  // field on cases, not a fixed lookup table elsewhere in this app.
  // Trimmed and blank-filtered here so an empty row left in the UI (or a
  // provider name/chat ID that's all whitespace) never gets saved as a
  // bogus mapping that would silently swallow that Provider's real
  // notifications later.
  if (body.providerTelegramChatIds !== undefined) {
    if (typeof body.providerTelegramChatIds !== 'object' || body.providerTelegramChatIds === null || Array.isArray(body.providerTelegramChatIds)) {
      return sendJson(res, 400, { error: 'providerTelegramChatIds must be an object.' });
    }
    const clean = {};
    for (const [provider, chatId] of Object.entries(body.providerTelegramChatIds)) {
      const p = String(provider || '').trim();
      const c = String(chatId || '').trim();
      if (p && c) clean[p] = c;
    }
    patch.providerTelegramChatIds = clean;
  }
  // checklistItems: an ordered [{key, label}, ...] list, edited in
  // Settings > Required Document Settings (see
  // renderChecklistSettingsTab in app.js). `key` is preserved as sent for
  // an existing item (so renaming a label doesn't orphan every case's
  // already-saved checkbox state under the old key) and auto-generated
  // from the label for a brand-new item that doesn't have one yet. Blank
  // labels are dropped silently (an empty row left in the UI). Keys are
  // de-duplicated — two items that slugify to the same key (e.g. two rows
  // both labeled "RTP Certification") would otherwise silently share one
  // checkbox.
  if (body.checklistItems !== undefined) {
    if (!Array.isArray(body.checklistItems)) return sendJson(res, 400, { error: 'checklistItems must be an array.' });
    const usedKeys = new Set();
    const clean = [];
    for (const raw of body.checklistItems) {
      const label = String((raw && raw.label) || '').trim();
      if (!label) continue;
      let key = String((raw && raw.key) || '').trim() || slugifyChecklistKey(label);
      let finalKey = key;
      let n = 2;
      while (usedKeys.has(finalKey)) { finalKey = `${key}${n}`; n++; }
      usedKeys.add(finalKey);
      clean.push({ key: finalKey, label });
    }
    patch.checklistItems = clean;
  }
  const updated = await store.update('settings', 'system', patch);
  sendJson(res, 200, updated);
});

// ---------------------------------------------------------------------------
// Telegram group Q&A bot (added 2026-08-19, at Tiffany's request)
// ---------------------------------------------------------------------------
// Reverse-lookup of providerTelegramChatIds (Provider name -> chat ID,
// edited in Settings > Telegram Notifications): given an incoming Telegram
// chat ID, which Provider (if any) does it belong to. Returns null for any
// chat not in that map — a stranger's DM to the bot, or a group nobody's
// configured yet — so the webhook handler below can silently ignore it
// rather than guessing.
function findProviderForChatId(settings, chatId) {
  const entries = Object.entries(settings.providerTelegramChatIds || {});
  const match = entries.find(([, id]) => String(id) === String(chatId));
  return match ? match[0] : null;
}

// One-time admin action: tells Telegram where to deliver incoming messages
// (the webhook route just below) for this bot. Requires 'settings' edit
// permission — same gate as everything else on the Settings pages — since
// running this points the bot at whatever server made the call, which
// matters if this is ever run from the wrong environment by mistake. Only
// works when called against a real public HTTPS deployment (the deployed
// Vercel site) — Telegram rejects a localhost URL outright, so running this
// against a local `node server.js` will fail with a clear error rather than
// silently registering something broken.
router.post('/api/telegram/register-webhook', async (req, res) => {
  const user = await requirePerm(req, res, 'settings', 'edit');
  if (!user) return;
  const url = process.env.PUBLIC_APP_URL;
  if (!url) {
    return sendJson(res, 400, {
      error: 'Set PUBLIC_APP_URL (e.g. https://galaticlegal-genie.vercel.app) as an environment variable on this deployment first, then try again.',
    });
  }
  try {
    const result = await telegram.setWebhook(`${url.replace(/\/$/, '')}/api/telegram/webhook`, process.env.TELEGRAM_WEBHOOK_SECRET);
    sendJson(res, 200, result);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
});

// Telegram calls this for every message posted anywhere the bot is present
// (once register-webhook above has been run) — a Provider's group, or a
// private DM to the bot. No login/session exists here (Telegram is calling
// directly, not a browser with a Legal Genie session), so this route is
// deliberately NOT behind requirePerm; instead, when TELEGRAM_WEBHOOK_SECRET
// is configured, the X-Telegram-Bot-Api-Secret-Token header (which only
// Telegram itself sends, once registered via setWebhook above) is checked
// so a stranger who finds this URL can't feed it fake messages.
//
// Always responds 200 quickly regardless of outcome — Telegram retries a
// webhook that doesn't get a fast 2xx, and a retry storm over an unrelated
// DM or an ignorable group is exactly the noise this guards against.
// Real work only happens for a message: (a) in a chat that's a known
// Provider's group (see findProviderForChatId — a stranger's DM or an
// unconfigured group is silently ignored), and (b) that server/ai.js's
// answerGroupQuestion() decides is actually a question about that
// Provider's cases (see that function's own conservative-by-design
// shouldRespond gate) — everything else in the group (ordinary
// conversation) is read and silently skipped, never replied to.
router.post('/api/telegram/webhook', async (req, res, params, body) => {
  if (process.env.TELEGRAM_WEBHOOK_SECRET) {
    const headerSecret = req.headers['x-telegram-bot-api-secret-token'];
    if (headerSecret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }
  }
  const msg = body && body.message;
  // Deliberately AWAITED, not fire-and-forget, even though it delays the
  // 200 response back to Telegram — on Vercel, this whole request handler
  // is a serverless function that gets frozen/torn down once a response is
  // sent, so any "background" work kicked off after sendJson() below would
  // have no guarantee of ever actually finishing. Gemini + Telegram calls
  // normally complete well within a few seconds, comfortably inside
  // Telegram's own webhook timeout.
  if (msg && msg.text && msg.chat) {
    try {
      const settings = await getSystemSettings();
      const provider = findProviderForChatId(settings, msg.chat.id);
      if (provider) {
        const allCases = await store.all('cases');
        const providerCases = allCases.filter((c) => String(c.provider || '').trim().toLowerCase() === provider.trim().toLowerCase());
        const result = await ai.answerGroupQuestion({ providerName: provider, question: msg.text, cases: providerCases });
        if (result && result.shouldRespond && result.answer) {
          await telegram.sendTelegramMessage(String(msg.chat.id), result.answer, { replyToMessageId: msg.message_id });
        }
      } // else: not a known Provider group/DM — nothing to do
    } catch (err) {
      console.error('[telegram webhook] failed to process incoming message:', err.message);
    }
  }
  sendJson(res, 200, { ok: true });
});

// ---------------------------------------------------------------------------
// Telegram reminder for due-today follow-ups (added 2026-08-18)
// ---------------------------------------------------------------------------
// Called on a timer from server.js (setInterval — this process has to stay
// running for that to fire, which is why it's designed for the Render
// deployment rather than a one-shot local `node server.js` session; see the
// Go-Live Guide). Finds every auto-created "follow up N days later" task
// (see syncDeadlineFollowUpTask above) whose due date is today, that isn't
// already Completed, and that hasn't already been notified — sends one
// Telegram message per recipient and stamps `followUpReminderSentAt` so
// re-running this on the next tick (or the next day, if the task is still
// open) doesn't send a duplicate. Deliberately keyed off calendar date only
// (not a precise time-of-day), since this only runs hourly at best and "the
// due date" has no meaningful hour attached to it anyway.
//
// Best-effort per message, same as notifyProviderTelegram above: one failed
// send (bad chat ID, Telegram outage, TELEGRAM_BOT_TOKEN not configured
// yet) is logged and skipped, never allowed to block the rest of the batch
// or throw out of the caller's setInterval tick.
//
// This originally sent via Resend email (server/email.js) instead, but hit
// Resend's sandbox restriction (can only email the Resend account's own
// signup address until a real domain is verified). Tiffany asked for
// Telegram instead — reusing the same bot already set up for
// notifyProviderTelegram above — since it's naturally per-user (each task's
// Assignee sets their own Chat ID on their User record — see Settings >
// Users) and has no domain-verification requirement. The email path was
// kept briefly as an optional fallback channel, then removed entirely
// 2026-08-18 (still the same day) at Tiffany's request once Telegram alone
// covered the need — see git history for that version if email ever needs
// to come back.
//
// Combines same-run reminders into one message rather than firing one
// message per due task: all of a Telegram recipient's due tasks for this
// run go out as a single message to their chat ID. This only merges tasks
// that become due in the SAME check (today, not yet sent) — it does not
// batch across days or wait to accumulate more.
async function checkAndSendFollowUpReminders() {
  const settings = await getSystemSettings();
  if (!notificationsEnabled(settings, 'notifyOnFollowUpDueTelegram')) return;

  const today = new Date().toISOString().slice(0, 10);
  const [tasks, users] = await Promise.all([store.all('tasks'), store.all('users')]);
  const due = tasks.filter((t) => t.isDeadlineFollowUp && t.status !== 'Completed'
    && t.dueDate === today && !t.followUpReminderSentAt);
  if (!due.length) return;

  const taskLine = (t) => `• ${t.title}${t.description ? ` — ${t.description}` : ''}`;
  // A single due task reads as a normal reminder; 2+ read as a bulleted
  // digest, so a quiet day still gets the same friendly one-line message it
  // always did instead of an oddly-formatted "1 follow-up" digest.
  const combinedBody = (list) => (list.length === 1
    ? (list[0].description || list[0].title)
    : list.map(taskLine).join('\n'));
  const footer = '\n\nOpen Legal Genie to view/update: Task Management.';

  const sentTaskIds = new Set();
  const groups = new Map(); // telegramChatId -> tasks[] due for that chat this run
  for (const t of due) {
    // A task can now have more than one Assignee (added 2026-08-18) — each
    // assignee who has their own Telegram Chat ID configured gets this
    // task included in their own combined message.
    for (const uid of taskAssigneeIds(t)) {
      const assignee = users.find((u) => u.id === uid);
      if (!assignee || !assignee.telegramChatId) continue;
      const list = groups.get(assignee.telegramChatId) || [];
      list.push(t);
      groups.set(assignee.telegramChatId, list);
    }
  }
  for (const [chatId, group] of groups) {
    const heading = group.length === 1
      ? `⏰ Legal Genie reminder: ${group[0].title}`
      : `⏰ Legal Genie: ${group.length} follow-ups due today`;
    try {
      await telegram.sendTelegramMessage(chatId, `${heading}\n\n${combinedBody(group)}${footer}`);
      group.forEach((t) => sentTaskIds.add(t.id));
    } catch (err) {
      console.error(`[telegram] failed to send follow-up reminder to chat ${chatId}:`, err.message);
    }
  }

  for (const id of sentTaskIds) {
    await store.update('tasks', id, { followUpReminderSentAt: new Date().toISOString() });
  }
}
router.runDueFollowUpReminders = checkAndSendFollowUpReminders;

module.exports = router;
