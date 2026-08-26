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
// zip-lite.js (dependency-free ZIP writer) was only used by the "Download
// All Documents" route, removed 2026-08-26 — see the note near where that
// route used to sit, just above "Knowledge Base" below. The module itself
// is left on disk in case a future zip-export feature wants it again.

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
      // See the PUT /api/settings handler's telegramAdminChatId comment for
      // what this does — defaults empty (feature off) until Tiffany sets it.
      telegramAdminChatId: '',
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
  // 2026-08-24 (audit fix, at Tiffany's request): this endpoint used to
  // return every case's title/caseNumber to ANY authenticated user
  // regardless of their role's `cases: view` permission — a documents-only
  // clerk could enumerate every case in the system through this one lookup
  // call even though the actual /api/cases list is properly permission-
  // gated. Contracts are deliberately left unfiltered: the Contracts module
  // itself was retired (see the comment above the /api/documents routes)
  // and its data is only ever surfaced read-only here so Tasks/Documents'
  // existing "Related Contract" pickers keep working — there is no
  // `contracts` permission module left to check it against.
  const canViewCases = await auth.can(user, 'cases', 'view');
  // Also honors providerScope (see filterCasesByProviderScope below) —
  // otherwise a provider-scoped role could still enumerate every case's
  // title/number through this lookup even though /api/cases itself is
  // correctly scoped.
  const visibleCases = canViewCases ? await filterCasesByProviderScope(cases, user) : [];
  sendJson(res, 200, {
    users: users.map((u) => ({ id: u.id, fullName: u.fullName, username: u.username })),
    departments,
    roles: roles.map((r) => ({ id: r.id, name: r.name })),
    cases: visibleCases.map((c) => ({
      id: c.id, title: c.title, caseNumber: c.caseNumber,
      // Games list included (2026-08-24) so Document Center's "Related
      // Game" picker can be populated for a multi-game case without a
      // second round-trip — see fields() in renderDocuments (app.js).
      games: Array.isArray(c.games) ? c.games.map((g) => ({ id: g.id, gameTitle: g.gameTitle })) : undefined,
    })),
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

// (The AI Case-Intake Wizard's /api/cases/extract-from-documents route —
// "upload all documents for a game submission at once and have AI organize
// them into a proposed Case" — was removed entirely 2026-08-26 at Tiffany's
// request, since real case creation is done via the Excel import instead.
// See server/ai.js for the matching removal of extractCaseFromDocuments.)

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
router.get('/api/dashboard/summary', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const today = new Date();
  const in14 = new Date(today.getTime() + 14 * 86400000);

  const [tasks, cases, notifications] = await Promise.all([
    store.all('tasks'), store.all('cases'), store.all('notifications'),
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

  // "Cases Under Review" — 2026-08-26, at Tiffany's request: the Dashboard's
  // middle stat card/list was originally driven by the internal Approval
  // Center queue (approvals with status:'Pending', scoped to the logged-in
  // reviewer), which turned out to be confusing — it's a different concept
  // from "how many submitted games are actually sitting at PAGCOR in the
  // For Review stage right now" (which is what "審核中" meant here), and it
  // stayed at 0 whenever nobody had an Approval Center request open even
  // though there were plenty of cases genuinely under PAGCOR review. This
  // now counts PAGCOR game entries (see pagcorGameEntries above — one entry
  // per game, same flattening the Follow-ups widget and PAGCOR board use)
  // whose Stage is 'For Review', org-wide, so it always reflects the real
  // review queue regardless of who's logged in. (The Approval Center
  // feature itself was removed entirely shortly after — see the comment
  // near the old /api/approvals routes further down this file.)
  // The dashboard used to also show a list built from this (one row per
  // game, linking to its case); removed 2026-08-26 at Tiffany's request as
  // redundant with Case Management's own PAGCOR Stage filter, so only the
  // count is needed here now.
  const casesUnderReviewCount = pagcorEntries.filter((e) => e.pagcorStage === 'For Review').length;

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
    casesUnderReviewCount,
    counts: {
      cases: cases.filter((c) => c.status !== 'Closed').length,
    },
  });
});

// ---------------------------------------------------------------------------
// Generic list/get/create/update/delete factory
// ---------------------------------------------------------------------------
function crudRoutes({ base, moduleName, collection, onCreate, onUpdate, afterCreate, afterUpdate, afterDelete, filterList, skipCreate, skipDelete }) {
  // skipCreate/skipDelete: omit the POST/DELETE routes entirely for a
  // collection where the UI never offers "create new" / "delete" (e.g.
  // Roles — 2026-08-26, at Tiffany's request: the roles list is a fixed
  // seeded set edited only via PUT for Provider Scope, so a reachable
  // create/delete endpoint sitting behind no button was orphaned surface
  // area rather than a real feature). Other collections sharing this same
  // factory (e.g. Departments) that DO have create/delete buttons are
  // unaffected — they just don't pass these flags.
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

  if (!skipCreate) {
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
  }

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

  if (!skipDelete) {
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
// PAGCOR is only open Monday-Thursday (confirmed by Tiffany 2026-08-20) — a
// plain calendar "+30 days" follow-up could land on a Friday/Saturday/
// Sunday PAGCOR isn't even open on, days before they'd realistically have
// made any progress on a submission. Steps forward one calendar day at a
// time, only counting Mon/Tue/Wed/Thu as one of the `days` PAGCOR business
// days to advance — Fri/Sat/Sun are skipped over entirely, not counted.
function addPagcorBusinessDays(date, days) {
  const result = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay(); // 0=Sun, 1=Mon, ..., 4=Thu, 5=Fri, 6=Sat
    if (dow >= 1 && dow <= 4) remaining--;
  }
  return result;
}

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

  const deadlineDate = new Date(caseRow.deadline);
  if (isNaN(deadlineDate)) return; // malformed date — don't crash the case save over it
  const settings = await getSystemSettings();
  const followUpDays = Number.isFinite(settings.followUpDays) && settings.followUpDays > 0 ? settings.followUpDays : 30;
  // Counts PAGCOR business days (Mon-Thu), not calendar days — see
  // addPagcorBusinessDays()'s comment above for why.
  const followUp = addPagcorBusinessDays(deadlineDate, followUpDays);
  const followUpDate = followUp.toISOString().slice(0, 10);
  const title = `Follow up: ${caseRow.title}`;

  if (!existing) {
    await store.insert('tasks', {
      title,
      description: `Case "${caseRow.title}" has a Submit Date of ${caseRow.deadline}. This reminder was created automatically ${followUpDays} PAGCOR business days later (Mon-Thu only) to follow up on progress.`,
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

// When every game in a case (or the case itself, for a legacy flat
// single-game case) has reached PAGCOR Stage "Approved", the case no
// longer needs its "follow up N days later" reminder from
// syncDeadlineFollowUpTask above — added 2026-08-26 at Tiffany's request.
// For a multi-game case this only fires once ALL of its games are
// Approved, not just one, so the reminder isn't lost while other games in
// the same case are still under review.
async function removeFollowUpIfFullyApproved(caseRow) {
  if (!caseRow || !caseRow.id) return;
  const fullyApproved = (Array.isArray(caseRow.games) && caseRow.games.length)
    ? caseRow.games.every((g) => g.pagcorStage === 'Approved')
    : caseRow.pagcorStage === 'Approved';
  if (!fullyApproved) return;
  const tasks = await store.all('tasks');
  const existing = tasks.find((t) => t.relatedCaseId === caseRow.id && t.isDeadlineFollowUp);
  // Same care as syncDeadlineFollowUpTask: never remove a task someone
  // already marked Completed — that's real history of a follow-up that
  // happened, not bookkeeping to be silently cleaned up.
  if (existing && existing.status !== 'Completed') await store.remove('tasks', existing.id);
}

// Audit log for compliance-critical case/game fields (2026-08-24, at
// Tiffany's request) — nothing previously recorded WHO changed a game's
// Game ID / Version / Min-Max Bet / RTP / PAGCOR Stage or WHEN, so an
// accidental post-import edit to a submitted value had no way to be traced
// or reversed. This directly matters because checkDocumentConsistency (see
// server/ai.js) compares each document's stated value against these exact
// fields as "the provider's own submitted value" — if one gets silently
// edited after import, that comparison is now checking against the wrong
// baseline with no way to tell. Deliberately lightweight: one row per
// changed field (not a generic diff blob) so "show me every time RTP
// changed on this game" is a simple filter, not a scan-and-parse.
const AUDITED_CASE_FIELDS = ['gameId', 'gameVersion', 'minBet', 'maxBet', 'rtp', 'pagcorStage'];
async function logAudit(entityType, entityId, field, oldValue, newValue, user, extra) {
  if (oldValue === newValue) return;
  if ((oldValue ?? null) === (newValue ?? null)) return; // undefined vs null: not a real change
  await store.insert('auditLog', {
    entityType, entityId, field,
    oldValue: oldValue ?? null, newValue: newValue ?? null,
    userId: user ? user.id : null, userName: user ? (user.fullName || user.username) : 'system',
    ...extra,
  });
}
// Diffs one case's AUDITED_CASE_FIELDS before/after an update — handles both
// a legacy flat (single-game) case and a multi-game case's `games[]`, in
// which case each row is tagged with gameId/gameTitle so the audit trail
// reads per-game rather than as one undifferentiated case-level list.
async function logCaseAudit(row, user, existing) {
  if (!existing) return;
  if (Array.isArray(row.games)) {
    const oldById = new Map((existing.games || []).map((g) => [g.id, g]));
    for (const g of row.games) {
      const prior = oldById.get(g.id);
      if (!prior) continue; // newly-added game — nothing to diff against
      for (const field of AUDITED_CASE_FIELDS) {
        await logAudit('game', g.id, field, prior[field], g[field], user, { caseId: row.id, gameTitle: g.gameTitle || null });
      }
    }
  } else {
    for (const field of AUDITED_CASE_FIELDS) {
      await logAudit('case', row.id, field, existing[field], row[field], user, { caseId: row.id, gameTitle: row.gameTitle || null });
    }
  }
}

// System-wide activity log (2026-08-25, at Tiffany's request) — a sibling to
// logAudit/logCaseAudit above for the many actions that aren't a field diff
// on a tracked case/game field: creating/deleting a record, replacing a
// document's file, deciding an approval, importing a case from Excel, etc.
// Deliberately best-effort — every call site wraps this in try/catch and
// never lets a logging failure block the actual CRUD operation (same
// pattern already used by the import-source-document linking above).
async function logAction(entityType, entityId, action, label, user, extra) {
  await store.insert('auditLog', {
    entityType, entityId, action, label,
    userId: user ? user.id : null, userName: user ? (user.fullName || user.username) : 'system',
    ...extra,
  });
}

// Provider-scoped row-level visibility (2026-08-24, at Tiffany's request —
// today, any role with `cases: view` sees every case system-wide with no
// way to restrict a paralegal to only the Provider(s) they actually handle).
// A role's `providerScope` (array of Provider names, matched via
// canonicalProviderName so "OP"/"Omniplay" etc. count as the same one) is
// opt-in: absent or empty means unrestricted (every existing role keeps
// seeing everything it always could — this is additive, not a default
// lockdown). Admin always bypasses it, same as every other permission
// check in this file. Applied via crudRoutes' `filterList`, which already
// runs identically for the list endpoint AND for get/update/delete of a
// single row (see crudRoutes' visibleRow) — so a case outside a user's
// scope isn't just hidden from the list, it 404s if they try to open,
// edit, or delete it directly by ID too.
async function filterCasesByProviderScope(rows, user) {
  const role = await store.find('roles', user.roleId);
  if (!role || role.name === 'Admin') return rows;
  const scope = Array.isArray(role.providerScope) ? role.providerScope.filter(Boolean) : [];
  if (!scope.length) return rows; // unrestricted — the default for every role until explicitly scoped
  const allowed = new Set(scope.map((p) => canonicalProviderName(p).toLowerCase()));
  return rows.filter((c) => c.provider && allowed.has(canonicalProviderName(c.provider).toLowerCase()));
}

// Cases -----------------------------------------------------------------
crudRoutes({
  base: '/api/cases', moduleName: 'cases', collection: 'cases',
  filterList: filterCasesByProviderScope,
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
  afterCreate: async (row, user) => {
    await syncDeadlineFollowUpTask(row);
    await removeFollowUpIfFullyApproved(row);
    try { await logAction('case', row.id, 'created', `${row.caseNumber} - ${row.provider || row.title || ''}`, user, { caseId: row.id }); }
    catch (err) { console.error('Failed to log case create:', err.message); }
  },
  afterUpdate: async (row, user, id, existing) => {
    await syncDeadlineFollowUpTask(row);
    await removeFollowUpIfFullyApproved(row);
    await notifyCaseStageChange(row, existing, user);
    await logCaseAudit(row, user, existing);
  },
  afterDelete: async (row, user) => {
    await syncDeadlineFollowUpTask({ ...row, deadline: null });
    try { await logAction('case', row.id, 'deleted', `${row.caseNumber} - ${row.provider || row.title || ''}`, user, { caseId: row.id }); }
    catch (err) { console.error('Failed to log case delete:', err.message); }
  },
});

// Bulk-update-stage (below) also changes pagcorStage outside the normal
// crudRoutes PUT path, so it needs its own audit call — see the route body.

// Audit log read endpoint — same "cases: view" permission as the case
// itself, since this is case detail history, not a separate module. Scoped
// to one case at a time (caseId, stamped on every row by logAudit above)
// rather than a global feed; a global cross-case audit view isn't needed
// yet and would need its own permission story (who gets to see everyone
// else's edits) if it ever is.
router.get('/api/cases/:id/audit-log', async (req, res, params) => {
  const user = await requirePerm(req, res, 'cases', 'view');
  if (!user) return;
  const all = await store.all('auditLog');
  const rows = all.filter((r) => r.caseId === params.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  sendJson(res, 200, rows);
});

// Global cross-case audit feed (2026-08-25, at Tiffany's request — "把 audit
// log 獨立出來，不要放在每個頁面裡") backing the standalone Audit Log page (see
// renderAuditLog in public/js/app.js), which replaced the earlier per-case
// "History" button that used to sit on every Case Detail page. Same
// 'cases':'view' permission as the per-case endpoint above — no separate
// permission story needed since this is just every row that endpoint could
// already show, one case at a time, joined into a single list. Joins in
// each row's case number/title so the page doesn't need to fetch every case
// separately just to label its own rows; a row whose case was since deleted
// keeps its entry (nothing here is deleted along with a case) but comes
// back with caseNumber/caseTitle null.
router.get('/api/audit-log', async (req, res) => {
  // Admin-only (2026-08-25, at Tiffany's request) — this feed now spans
  // every module (documents, tasks, users, roles, settings, etc.), which is
  // more sensitive than any single permission module covers. 'settings:
  // view' alone isn't enough since Legal Manager also holds that. Checking
  // the role name directly here is the same pattern already used elsewhere
  // in this file for Admin-only carve-outs (see `role.name === 'Admin'` at
  // the top of GET /api/cases and GET /api/tasks).
  const user = await requireAuth(req, res);
  if (!user) return;
  const role = await store.find('roles', user.roleId);
  if (!role || role.name !== 'Admin') {
    sendJson(res, 403, { error: 'Only Admins can view the system-wide activity log' });
    return;
  }
  const [all, cases] = await Promise.all([store.all('auditLog'), store.all('cases')]);
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const rows = all
    .map((r) => {
      const kase = r.caseId ? caseById.get(r.caseId) : null;
      return { ...r, caseNumber: kase ? kase.caseNumber : null, caseTitle: kase ? kase.title : null };
    })
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  sendJson(res, 200, rows);
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
      if (row) {
        updated++;
        await notifyCaseStageChange(row, existing, user);
        await logCaseAudit(row, user, existing); // this route bypasses crudRoutes' own afterUpdate, so it needs its own audit call
        await removeFollowUpIfFullyApproved(row); // ditto — see its own comment above
      }
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
//
// Scoped to ONE case (:id), 2026-08-26 at Tiffany's request — this used to
// be a standalone global route (matching the letter against every case in
// the system) reached via its own separate "Upload Approval Notice"
// wizard, but that wizard had no button left calling it (dead UI) and
// matching against the whole system when the user is already looking at
// one specific case's "Upload Documents" flow was more than she wanted:
// "只搜這個案件,配不到就列為 unmatched" — only search this case, list
// anything else as unmatched rather than guessing it belongs elsewhere.
// See public/js/app.js's showCaseDocumentUploadModal for the new caller —
// its "Identify Approved Games (AI)" step, shown when a file's Report Type
// is set to "Letter of Approval (LOA)".
router.post('/api/cases/:id/import-approval-notice', async (req, res, params, body) => {
  const user = await requirePerm(req, res, 'cases', 'edit');
  if (!user) return;
  const existing = await store.find('cases', params.id);
  if (!existing) return sendJson(res, 404, { error: 'Not found' });
  try {
    const extracted = await ai.extractApprovalNotice({ fileName: body.fileName, fileContentBase64: body.fileContentBase64 });
    // updateFn goes through the same pagcorStageChangedAt stamping +
    // notifyCaseStageChange (owner notification + Telegram post to the
    // Provider's group) that bulk-update-stage and a normal case Edit both
    // go through — approving a game via a real scanned PAGCOR notice
    // letter is arguably the most important moment to notify someone, so
    // this shouldn't silently bypass that the way a raw store.update()
    // call would. `cases` here is just the one case being edited — reread
    // fresh each time in case an earlier game in the same batch already
    // changed it (a multi-game case can have more than one game matched
    // out of the same letter).
    let current = existing;
    const cases = [current];
    const updateFn = async (id, patch) => {
      const before = current;
      const fullPatch = { ...patch };
      if (before && before.pagcorStage !== patch.pagcorStage) fullPatch.pagcorStageChangedAt = new Date().toISOString();
      const row = await store.update('cases', id, fullPatch);
      if (row) {
        current = row;
        cases[0] = row;
        await notifyCaseStageChange(row, before, user);
        await logCaseAudit(row, user, before); // bypasses crudRoutes' own afterUpdate too — see comment above
        await removeFollowUpIfFullyApproved(row); // ditto — see its own comment above
      }
      return row;
    };
    const result = await pagcorCheck.applyApprovalNoticeGames(cases, extracted.games, updateFn);
    sendJson(res, 200, { ...result, approvalDate: extracted.approvalDate || null, noticeReference: extracted.noticeReference || null });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
});

// Note: a "Case Notes" GET/POST /api/cases/:id/notes pair used to live here,
// backed by a `caseNotes` collection. Removed 2026-08-26, at Tiffany's
// request — the UI never grew a Notes panel that called either route, so
// they were reachable but dead. Any `caseNotes` rows already in the
// database (there likely aren't any, since nothing ever wrote one) are left
// untouched; the `caseNotes` collection name is still listed in
// store.js/store.sqlite-backup.js's COLLECTIONS for that reason.

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

// Indexes every EXISTING case's games (both the modern multi-game shape and
// legacy flat single-game cases) by Provider+Title and Provider+GameId, so
// import/commit below can tell whether an incoming row is a genuine new
// game or a re-import of one that's already on file (added 2026-08-25, at
// Tiffany's request, after CASE-0039 ended up with two identical "Import
// Source" documents because the same Excel got imported twice with nothing
// to catch it). Before this, the commit handler's own dedup check (see
// existingKeys/existingByProviderGameId further down, pre-2026-08-25) only
// ever looked at legacyFlatCases — a re-import that collided with an
// existing MULTI-game case's games sailed straight through and created a
// second case + a second copy of every document. This indexes both shapes
// so that gap is closed, while still respecting Tiffany's earlier
// 2026-08-20 decision that a genuinely NEW import batch gets its own new
// case (see the Stage 3 comment below) — this index is only used to flag
// true duplicates, never to silently merge an otherwise-new batch into an
// old case.
function buildExistingGameIndex(existingCases) {
  const byTitleKey = new Map(); // "provider|gameTitle" -> [{caseId, isLegacyFlat, gameRowId, gameTitle}]
  const byProviderGameId = new Map(); // "provider|gameId" -> same shape
  const addEntry = (map, key, entry) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  };
  for (const c of existingCases) {
    if (!c.provider) continue;
    const providerKey = c.provider.trim().toLowerCase();
    if (Array.isArray(c.games)) {
      for (const g of c.games) {
        const entry = { caseId: c.id, isLegacyFlat: false, gameRowId: g.id, gameTitle: g.gameTitle };
        if (g.gameTitle) addEntry(byTitleKey, `${providerKey}|${g.gameTitle.trim().toLowerCase()}`, entry);
        const gid = (g.gameId || '').trim();
        if (gid) addEntry(byProviderGameId, `${providerKey}|${gid.toLowerCase()}`, entry);
      }
    } else {
      const entry = { caseId: c.id, isLegacyFlat: true, gameRowId: null, gameTitle: c.gameTitle || c.title };
      const title = (c.gameTitle || c.title || '').trim();
      if (title) addEntry(byTitleKey, `${providerKey}|${title.toLowerCase()}`, entry);
      const gid = (c.gameId || '').trim();
      if (gid) addEntry(byProviderGameId, `${providerKey}|${gid.toLowerCase()}`, entry);
    }
  }
  return { byTitleKey, byProviderGameId };
}

// Finds the best existing-game match for one incoming row, or null. Game ID
// match (when both sides have one) is preferred as the stronger signal,
// same preference order the rest of this file already uses; falls back to
// an exact Provider+Title match.
function findExistingGameMatch(row, index) {
  const providerKey = (row.provider || '').trim().toLowerCase();
  const gid = (row.gameId || '').trim();
  if (gid) {
    const byId = index.byProviderGameId.get(`${providerKey}|${gid.toLowerCase()}`);
    if (byId && byId.length) return byId[0];
  }
  const title = (row.gameTitle || row.title || '').trim();
  if (title) {
    const byTitle = index.byTitleKey.get(`${providerKey}|${title.toLowerCase()}`);
    if (byTitle && byTitle.length) return byTitle[0];
  }
  return null;
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
//
// Length/ratio floor added 2026-08-24 (audit fix, at Tiffany's request) — a
// bare substring check has no lower bound, so two SHORT, unrelated titles
// that happen to share a common word/fragment (e.g. "ACE" inside "ACE OF
// SPADES ULTRA") would previously read as "likely the same game" even
// though the shorter one is a small fraction of the longer one. Requiring
// the shorter normalized title to be both at least 4 characters AND at
// least half the length of the longer one keeps the real-world cases this
// was built for (a handful of characters' typo/punctuation difference, or
// a short name embedded in a longer stylized one) while rejecting a short
// generic title just happening to appear inside an unrelated longer name.
function titlesLikelySameGame(a, b) {
  const na = normalizeGameName(a);
  const nb = normalizeGameName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (shorter.length < 4) return false;
  if (shorter.length / longer.length < 0.5) return false;
  return longer.includes(shorter);
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
  // The original workbook is saved to storage further down, once it's
  // confirmed this commit is actually proceeding (not stopping early for a
  // duplicate-decision round-trip — see "needsDuplicateDecision" below) —
  // moved 2026-08-25 so a decision round-trip never leaves an orphaned
  // never-linked copy of the file sitting in storage. Was previously saved
  // unconditionally right here.
  const errors = [];
  const checklistItems = getChecklistItems(await getSystemSettings());
  // Audit trail for every automatic row-merge decision this commit makes
  // (2026-08-24, at Tiffany's request) — previously only OUTRIGHT conflicts
  // were ever reported back (see gameIdConflicts below); a merge that
  // silently collapsed two rows because titlesLikelySameGame() judged them
  // "close enough" had no record at all, so there was no way to audit
  // whether a collapse was actually correct after the fact. Returned in the
  // commit response as `mergeDecisions` alongside the existing counts.
  const mergeDecisions = [];

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
    const byId = matchId && allRows.find((e) => e !== reskinEntry && !e.row.reskinOf
      && (e.row.gameId || '').trim().toLowerCase() === matchId.toLowerCase());
    const target = byId || allRows.find((e) => e !== reskinEntry && !e.row.reskinOf
      && titlesLikelySameGame(e.row.gameTitle, reskinEntry.row.gameTitle));
    if (target) {
      mergeDecisions.push({
        stage: 'reskin', reason: byId ? 'matched trailing numeric ID' : 'title similarity',
        dropped: reskinEntry.row.gameTitle || reskinEntry.row.title, keptAs: target.row.gameTitle || target.row.title,
      });
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
        if (e !== survivor) {
          byKey.delete(importDedupKey(e.row));
          mergeDecisions.push({
            stage: 'gameIdTitleDedup', reason: 'same Provider + Game ID, titles judged similar enough',
            dropped: e.row.gameTitle || e.row.title, keptAs: survivor.row.gameTitle || survivor.row.title,
          });
        }
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
  const existingIndex = buildExistingGameIndex(existingCases);

  // Duplicate decision round-trip (2026-08-25, at Tiffany's request —
  // "跳出提示，然後可以選要取代還是怎樣"). If any surviving row matches a game
  // that already exists in ANY case (multi-game or legacy flat — see
  // buildExistingGameIndex above) and the caller hasn't said what to do
  // about it yet, stop here and report the duplicates instead of silently
  // creating or skipping anything. The frontend shows this list to Tiffany
  // as a prompt and re-calls this same endpoint with `body.duplicateAction`
  // set once she decides — 'skip' (leave the existing game/documents
  // untouched, don't import the duplicate rows) or 'replace' (update the
  // existing game's submitted values and swap in a fresh Import Source
  // document — see the replace loop below; only supported for multi-game
  // case matches, a legacy-flat match always behaves as 'skip' regardless,
  // since those cases are deliberately never touched by import — see the
  // Stage 3 comment above).
  if (!body.duplicateAction) {
    const seen = new Set();
    const duplicates = [];
    for (const { row } of byKey.values()) {
      const match = findExistingGameMatch(row, existingIndex);
      if (!match) continue;
      const dupKey = `${match.caseId}|${match.gameRowId || ''}`;
      if (seen.has(dupKey)) continue;
      seen.add(dupKey);
      const existingCase = existingCases.find((c) => c.id === match.caseId);
      duplicates.push({
        provider: row.provider,
        gameTitle: row.gameTitle || row.title,
        gameId: row.gameId || null,
        existingCaseId: match.caseId,
        existingCaseNumber: existingCase ? existingCase.caseNumber : null,
        isLegacyFlat: match.isLegacyFlat,
      });
    }
    if (duplicates.length) {
      return sendJson(res, 200, { needsDuplicateDecision: true, duplicates });
    }
  }
  const duplicateAction = body.duplicateAction || 'skip';

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
      // Excel-submitted values (2026-08-20, at Tiffany's request) — the same
      // "MINIMUM BET" / "MAXIMUM BET" / "Total RTP (%)" columns from the
      // provider's own Annex A submission sheet, kept alongside gameId/
      // gameVersion so the AI Parameter Consistency Check (server/ai.js) has
      // real expected values to compare each game's documents against,
      // rather than only checking whether documents agree with each other.
      minBet: row.minBet ?? null,
      maxBet: row.maxBet ?? null,
      rtp: row.rtp ?? null,
      // Jackpot RTP (2026-08-25, at Tiffany's request) — the separate
      // percentage of each bet that feeds the jackpot pool, kept alongside
      // the base game `rtp` above so the combined-RTP compliance rule in
      // server/ai.js's checkDocumentConsistency (base + jackpot must stay
      // under 97%) has a real submitted figure to work with. null for
      // non-jackpot games / sheets with no jackpot-RTP column.
      jackpotRtp: row.jackpotRtp ?? null,
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

  // Save the source workbook now that this commit is confirmed to actually
  // be proceeding (see the note above `errors` for why this moved off the
  // top of the handler — a duplicate-decision round-trip returns above
  // before ever reaching this line, so it never leaves an orphaned,
  // never-linked copy of the file sitting in storage).
  let importSourceFilePath = null;
  try {
    importSourceFilePath = await storage.saveBase64File(body.fileName || 'import.xlsx', body.fileContentBase64);
  } catch (err) {
    // Non-fatal — losing the source-file backup shouldn't block the import
    // itself from completing.
    console.error('Failed to save import source file:', err.message);
  }

  // "Replace" pass (2026-08-25, at Tiffany's request) — for every row that
  // matches an existing MULTI-game case's game (legacy-flat matches are
  // never replaced, see the comment above), update that game's own
  // submitted-value fields in place and swap in a fresh Import Source
  // document, rather than leaving the stale one sitting alongside a new
  // duplicate copy. Deliberately preserves the game's own `id` and its
  // existing PAGCOR workflow state (stage, checklist, jackpot testing/
  // rejection/LOA progress) — a re-import should refresh what the provider
  // submitted, not silently reset how far Legal has already gotten
  // reviewing it.
  let gamesReplaced = 0;
  if (duplicateAction === 'replace') {
    for (const { row } of byKey.values()) {
      const match = findExistingGameMatch(row, existingIndex);
      if (!match || match.isLegacyFlat) continue;
      const targetCase = existingCases.find((c) => c.id === match.caseId);
      if (!targetCase || !Array.isArray(targetCase.games)) continue;
      const targetGame = targetCase.games.find((g) => g.id === match.gameRowId);
      if (!targetGame) continue;
      const refreshed = rowToGame(row);
      const updatedGame = {
        ...targetGame,
        gameVersion: refreshed.gameVersion,
        minBet: refreshed.minBet,
        maxBet: refreshed.maxBet,
        rtp: refreshed.rtp,
        jackpotRtp: refreshed.jackpotRtp,
        gameType: refreshed.gameType,
        withJackpot: refreshed.withJackpot,
        reskinOf: refreshed.reskinOf,
      };
      try {
        const newGamesArr = targetCase.games.map((g) => (g.id === targetGame.id ? updatedGame : g));
        await store.update('cases', targetCase.id, { games: newGamesArr });
        // Delete any existing Import Source doc(s) for this game first, so a
        // repeated re-import never piles up duplicate copies the way
        // CASE-0039 did (the bug this whole feature exists to fix).
        try {
          const allDocs = await store.all('documents');
          const staleImportDocs = allDocs.filter((d) => d.relatedGameId === targetGame.id && String(d.title || '').startsWith('Import Source —'));
          for (const d of staleImportDocs) await store.remove('documents', d.id);
        } catch (err) {
          console.error('Failed to clean up old Import Source document(s):', err.message);
        }
        if (importSourceFilePath) {
          await store.insert('documents', {
            title: `Import Source — ${body.fileName || 'import.xlsx'}`,
            fileName: body.fileName || 'import.xlsx',
            filePath: importSourceFilePath,
            category: 'Certificates',
            provider: targetCase.provider,
            gameTitle: updatedGame.gameTitle || null,
            gameId: updatedGame.gameId || null,
            relatedGameId: targetGame.id,
            relatedCaseId: targetCase.id,
            uploadedBy: user.id,
          });
        }
        try { await logAction('game', targetGame.id, 'updated', `${targetCase.caseNumber} - ${updatedGame.gameTitle || 'Game'} (re-imported)`, user, { caseId: targetCase.id, gameTitle: updatedGame.gameTitle || null }); }
        catch (err) { console.error('Failed to log game replace:', err.message); }
        gamesReplaced++;
      } catch (err) {
        errors.push(`${updatedGame.gameTitle || 'Game'}: ${err.message}`);
      }
    }
  }

  let skippedExisting = 0;
  const groups = new Map(); // providerKey -> { providerDisplay, rows: [] }
  for (const { row, sheetName } of byKey.values()) {
    const match = findExistingGameMatch(row, existingIndex);
    if (match) { skippedExisting++; continue; } // 'replace' matches were already handled above; 'skip' (default) leaves them alone here
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
      const newCase = await store.insert('cases', {
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
      // Link the saved source workbook (see importSourceFilePath above) onto
      // this case as a Document Center entry, so anyone reviewing the case
      // later can open the exact original file its Game ID/Version/etc.
      // values were read from — not just the parsed-out fields. One
      // document record per game in this case (2026-08-25, at Tiffany's
      // request — "一開始匯入的excel檔也各存一份在各個資料夾"), all pointing at
      // the same saved file (no extra bytes written — same filePath reused
      // for every record, same pattern the multi-game document-upload
      // checklist already uses for one file that covers several games), so
      // the workbook shows up filed under each game's own Document Center
      // folder instead of sitting alone under "Uncategorized Game" with no
      // gameTitle. Previously this was a single case-level record with no
      // gameTitle/relatedGameId — see the 2026-08-24 investigation of an
      // R88 case where that made the import source hard to find per-game.
      if (importSourceFilePath) {
        for (const g of newGames) {
          try {
            await store.insert('documents', {
              title: `Import Source — ${body.fileName || 'import.xlsx'}`,
              fileName: body.fileName || 'import.xlsx',
              filePath: importSourceFilePath,
              // Certificates, not Other (2026-08-20, at Tiffany's request) —
              // this workbook is the provider's own official submission form
              // (e.g. Vertexplay's "Annex A — New Games Request for
              // Approval"), the same kind of supplier-provided compliance
              // document as a game manual or RNG certificate, not an
              // internal/miscellaneous file.
              category: 'Certificates',
              provider: group.providerDisplay,
              gameTitle: g.gameTitle || null,
              gameId: g.gameId || null,
              relatedGameId: g.id,
              relatedCaseId: newCase.id,
              uploadedBy: user.id,
            });
          } catch (err) {
            console.error('Failed to link import source document:', err.message);
          }
        }
      }
      try { await logAction('case', newCase.id, 'imported', `${newCase.caseNumber} - ${newCase.title}`, user, { caseId: newCase.id }); }
      catch (err) { console.error('Failed to log case import:', err.message); }
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
    gamesReplaced,
    skipped: collapsedByCrossSheetDedup + collapsedByGameIdDedup + skippedExisting,
    errors,
    gameIdConflicts,
    mergeDecisions,
  });
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
  afterCreate: async (row, user) => {
    try { await logAction('document', row.id, 'created', row.title || row.fileName || 'Document', user, { caseId: row.relatedCaseId || null, gameTitle: row.gameTitle || null }); }
    catch (err) { console.error('Failed to log document create:', err.message); }
  },
  afterUpdate: async (row, user) => {
    try { await logAction('document', row.id, 'updated', row.title || row.fileName || 'Document', user, { caseId: row.relatedCaseId || null, gameTitle: row.gameTitle || null }); }
    catch (err) { console.error('Failed to log document update:', err.message); }
  },
  afterDelete: async (row, user) => {
    try { await logAction('document', row.id, 'deleted', row.title || row.fileName || 'Document', user, { caseId: row.relatedCaseId || null, gameTitle: row.gameTitle || null }); }
    catch (err) { console.error('Failed to log document delete:', err.message); }
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
  try { await logAction('document', doc.id, 'replaced', doc.title || doc.fileName || 'Document', user, { caseId: doc.relatedCaseId || null, gameTitle: doc.gameTitle || null }); }
  catch (err) { console.error('Failed to log document replace:', err.message); }
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

  // Cache hit (2026-08-24, at Tiffany's request after the Gemini free-tier
  // daily quota got exhausted by repeated re-checks) — if the exact same
  // document set was already checked and nothing has changed since (same
  // staleness rule the download-all gate already relies on), return that
  // stored result instead of burning another AI call on an answer that
  // would come back identical. Pass { force: true } in the request body to
  // skip this and force a fresh AI call regardless (e.g. after a code/rule
  // change that would produce a different result for the same documents).
  const cachedCheck = targetGame ? targetGame.lastConsistencyCheck : kase.lastConsistencyCheck;
  const forceRefresh = !!(body && body.force);
  if (!forceRefresh && cachedCheck && cachedCheck.fullResult && !isCheckStale(cachedCheck, relatedDocs)) {
    return sendJson(res, 200, { ...cachedCheck.fullResult, fromCache: true, checkedAt: cachedCheck.checkedAt });
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
    // The provider's own submitted values for this game (from the Excel
    // import — see server/import.js's minBet/maxBet/rtp column detection and
    // routes.js's rowToGame() above) — passed through so checkDocumentConsistency
    // can compare each document's stated value against what was actually
    // submitted, not just check that documents agree with each other. A
    // legacy flat (pre-multi-game) case falls back to its own top-level
    // fields, which predate this and will usually be null/undefined.
    const expectedSource = targetGame || kase;
    const expectedValues = {
      gameId: expectedSource.gameId ?? null,
      gameVersion: expectedSource.gameVersion ?? null,
      minBet: expectedSource.minBet ?? null,
      maxBet: expectedSource.maxBet ?? null,
      // Jackpot RTP (2026-08-25, at Tiffany's request) — feeds the
      // combined-RTP rule in ai.checkDocumentConsistency (base game RTP +
      // jackpot RTP must stay under 97%); only present for jackpot games
      // imported from a sheet with a Jackpot RTP column (see
      // server/import.js's detectJackpotRtpColumn).
      jackpotRtp: expectedSource.jackpotRtp ?? null,
    };
    const result = await ai.checkDocumentConsistency({
      caseTitle: kase.title,
      gameTitle: targetGame ? targetGame.gameTitle : kase.gameTitle,
      gameId: targetGame ? targetGame.gameId : kase.gameId,
      expectedValues,
      documents,
      withJackpot: expectedSource.withJackpot ?? null,
    });

    // Persist so the Case Detail "Download All Documents" gate (see
    // GET /api/cases/:id/download-all below) can require a passed AI check
    // without re-running Gemini on every page load. documentIds records
    // exactly which documents were compared, so a later upload/replace/
    // removal can be detected as making this result stale — see
    // isConsistencyCheckStale below. Multi-game case: this lives on the
    // specific game inside `games[]` that was checked, not on the case
    // itself — each game's "ready to download" state is independent.
    const fullResult = { ...result, documentsCompared: documents.length, documentTitles: documents.map((d) => d.fileName) };
    const lastConsistencyCheck = {
      overallStatus: result.overallStatus || null,
      checkedAt: new Date().toISOString(),
      documentIds: comparedDocIds,
      // Never cache an 'error' (AI-response-incomplete, see server/ai.js's
      // aiResponseIncomplete) result — caching it would make the "please
      // re-run" message permanent for this document set until something
      // else changes, defeating the point of asking for a re-run. Leaving
      // fullResult unset here means the cache-hit check above (`cachedCheck
      // && cachedCheck.fullResult`) simply falls through to a fresh AI call
      // next time, same as if this had never been checked.
      fullResult: result.overallStatus === 'error' ? null : fullResult,
    };
    if (targetGame) {
      const newGames = kase.games.map((g) => (g.id === targetGame.id ? { ...g, lastConsistencyCheck } : g));
      await store.update('cases', params.id, { games: newGames });
    } else {
      await store.update('cases', params.id, { lastConsistencyCheck });
    }

    // documentTitles — added 2026-08-20 at Tiffany's request ("可是他沒有
    // 寫他實際比對了哪些文件" — the result only ever showed a bare COUNT of
    // documents compared, never which ones). Same order Gemini itself was
    // given them in (see checkDocumentConsistency's "[Document N: ...]"
    // labels in server/ai.js), so "Document 1"/"Document 4" etc. in the
    // AI's own explanations lines up with this list 1:1 and Tiffany can
    // actually see what was fed in — useful given the Document Center still
    // has some stray mistagged/duplicate records left over from the old
    // multi-game-upload bug (see the reassignment work earlier this case)
    // that don't affect a correctly-scoped check but are worth being able
    // to visually confirm aren't sneaking in.
    sendJson(res, 200, fullResult);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
});

// Note: a second "AI Parameter Consistency Check" endpoint used to live
// here, POST /api/documents/check-consistency — scoped to whatever
// documents Document Center's own Provider+Game folder view had on screen
// (documentIds passed straight from the client), for checking a game folder
// that has no Case behind it yet. Removed 2026-08-26, at Tiffany's request:
// Document Center's own "AI Parameter Consistency Check" button
// (#btnCheckFolderConsistency) that used to call this was itself already
// removed earlier, so this route had been reachable with no UI left calling
// it. The Case-detail version above (POST /api/cases/:id/check-consistency)
// is unaffected and remains the one actually in use.

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
// Note: the case-level download gate (caseDownloadGateStatus/
// isConsistencyCheckStale/safeFileSegment) and the "Download All Documents"
// route itself (GET /api/cases/:id/download-all) used to live here. Removed
// 2026-08-26, at Tiffany's request — the "Download All Documents" .zip
// button that used to call this had already been removed from the case
// detail page (2026-08-20), leaving this route reachable with no UI left
// calling it. isCheckStale (used by the still-active
// POST /api/cases/:id/check-consistency's cache check above) is unaffected
// and kept.

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
  afterCreate: async (row, user) => {
    try { await logAction('kbDocument', row.id, 'created', row.title || row.fileName || 'KB Document', user, {}); }
    catch (err) { console.error('Failed to log kbDocument create:', err.message); }
  },
  afterUpdate: async (row, user) => {
    try { await logAction('kbDocument', row.id, 'updated', row.title || row.fileName || 'KB Document', user, {}); }
    catch (err) { console.error('Failed to log kbDocument update:', err.message); }
  },
  afterDelete: async (row, user) => {
    try { await logAction('kbDocument', row.id, 'deleted', row.title || row.fileName || 'KB Document', user, {}); }
    catch (err) { console.error('Failed to log kbDocument delete:', err.message); }
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
  afterCreate: async (row, user) => {
    try { await logAction('kbFaq', row.id, 'created', row.question || 'FAQ', user, {}); }
    catch (err) { console.error('Failed to log kbFaq create:', err.message); }
  },
  afterUpdate: async (row, user) => {
    try { await logAction('kbFaq', row.id, 'updated', row.question || 'FAQ', user, {}); }
    catch (err) { console.error('Failed to log kbFaq update:', err.message); }
  },
  afterDelete: async (row, user) => {
    try { await logAction('kbFaq', row.id, 'deleted', row.question || 'FAQ', user, {}); }
    catch (err) { console.error('Failed to log kbFaq delete:', err.message); }
  },
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
  afterCreate: async (row, user) => {
    await notifyTaskAssignees(row, null, user);
    try { await logAction('task', row.id, 'created', row.title || 'Task', user, {}); }
    catch (err) { console.error('Failed to log task create:', err.message); }
  },
  afterUpdate: async (row, user, id, existing) => {
    await notifyTaskAssignees(row, existing, user);
    try { await logAction('task', row.id, 'updated', row.title || 'Task', user, {}); }
    catch (err) { console.error('Failed to log task update:', err.message); }
  },
  afterDelete: async (row, user) => {
    try { await logAction('task', row.id, 'deleted', row.title || 'Task', user, {}); }
    catch (err) { console.error('Failed to log task delete:', err.message); }
  },
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
  try { await logAction('calendarEvent', row.id, 'created', row.title, user, {}); }
  catch (err) { console.error('Failed to log calendar event create:', err.message); }
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
  return { existing, user };
}

router.put('/api/calendar-events/:id', async (req, res, params, body) => {
  const owned = await requireCalendarEventOwner(req, res, params.id);
  if (!owned) return;
  if (!String(body.title || '').trim() || !body.date) {
    return sendJson(res, 400, { error: 'Title and Date are required.' });
  }
  const row = await store.update('calendarEvents', params.id, {
    title: body.title.trim(), date: body.date, note: body.note || '',
  });
  try { await logAction('calendarEvent', row.id, 'updated', row.title, owned.user, {}); }
  catch (err) { console.error('Failed to log calendar event update:', err.message); }
  sendJson(res, 200, row);
});

router.delete('/api/calendar-events/:id', async (req, res, params) => {
  const owned = await requireCalendarEventOwner(req, res, params.id);
  if (!owned) return;
  await store.remove('calendarEvents', params.id);
  try { await logAction('calendarEvent', owned.existing.id, 'deleted', owned.existing.title, owned.user, {}); }
  catch (err) { console.error('Failed to log calendar event delete:', err.message); }
  sendJson(res, 200, { ok: true });
});

// (The "Approval Center" feature — a standalone internal sign-off workflow
// with its own /api/approvals CRUD routes and an /api/approvals/:id/decide
// endpoint — was removed entirely 2026-08-26 at Tiffany's request: it was
// unused and easy to confuse with actual PAGCOR case-review status. See
// the Dashboard's casesUnderReview computation above for what replaced its
// Dashboard widget, and server/auth.js / server/seed.js for the matching
// removal of its 'approvals' permission module.)

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
  try { await logAction('user', created.id, 'created', created.fullName || created.username, user, {}); }
  catch (err) { console.error('Failed to log user create:', err.message); }
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
  // Never log password/passwordHash — just who the record identifies.
  try { await logAction('user', updated.id, 'updated', updated.fullName || updated.username, user, {}); }
  catch (err) { console.error('Failed to log user update:', err.message); }
  sendJson(res, 200, publicUser(updated));
});

router.delete('/api/users/:id', async (req, res, params) => {
  const user = await requirePerm(req, res, 'settings', 'delete');
  if (!user) return;
  if (params.id === user.id) return sendJson(res, 400, { error: 'Cannot delete your own account' });
  const existing = await store.find('users', params.id);
  const ok = await store.remove('users', params.id);
  if (!ok) return sendJson(res, 404, { error: 'Not found' });
  try { await logAction('user', params.id, 'deleted', existing ? (existing.fullName || existing.username) : 'User', user, {}); }
  catch (err) { console.error('Failed to log user delete:', err.message); }
  sendJson(res, 200, { ok: true });
});

// Settings: Roles -----------------------------------------------------------
// Roles are a fixed seeded set — the Settings > Roles tab only ever reads
// the list and PUTs Provider Scope changes; there is no "New Role"/"Delete
// Role" button (the tab's own footer note tells the user to contact their
// system administrator for that). POST/DELETE were previously still wired
// up here with nothing in the UI ever calling them; removed 2026-08-26 at
// Tiffany's request rather than left reachable with no entry point.
crudRoutes({
  base: '/api/roles', moduleName: 'settings', collection: 'roles',
  skipCreate: true, skipDelete: true,
  afterUpdate: async (row, user) => {
    try { await logAction('role', row.id, 'updated', row.name || 'Role', user, {}); }
    catch (err) { console.error('Failed to log role update:', err.message); }
  },
});

// Settings: Departments ------------------------------------------------
crudRoutes({
  base: '/api/departments', moduleName: 'settings', collection: 'departments',
  afterCreate: async (row, user) => {
    try { await logAction('department', row.id, 'created', row.name || 'Department', user, {}); }
    catch (err) { console.error('Failed to log department create:', err.message); }
  },
  afterUpdate: async (row, user) => {
    try { await logAction('department', row.id, 'updated', row.name || 'Department', user, {}); }
    catch (err) { console.error('Failed to log department update:', err.message); }
  },
  afterDelete: async (row, user) => {
    try { await logAction('department', row.id, 'deleted', row.name || 'Department', user, {}); }
    catch (err) { console.error('Failed to log department delete:', err.message); }
  },
});

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
    for (const key of ['notifyOnTaskAssignment', 'notifyOnCaseStageChange', 'notifyTelegramOnCaseStageChange', 'notifyOnFollowUpDueTelegram']) {
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
  // telegramAdminChatId (added 2026-08-26, at Tiffany's request): ONE
  // Telegram chat treated as an internal/admin chat rather than a regular
  // Provider group — edited in Settings > Telegram Notifications (see
  // renderTelegramSettingsTab in app.js). Two effects, both gated on this
  // single value:
  //   1. The group Q&A bot (see the /api/telegram/webhook handler below)
  //      answers questions about ALL Providers' cases in this chat, instead
  //      of being locked to one Provider the way providerTelegramChatIds
  //      entries are — so Tiffany (or whoever's in this chat) can ask about
  //      any Provider's progress from one place.
  //   2. The 30-PAGCOR-business-day follow-up digest (see
  //      checkAndSendFollowUpReminders below) is sent here as a single
  //      combined message instead of individually to each follow-up task's
  //      Assignee's own personal Telegram chat.
  // Deliberately a single chat ID, not a list — this is meant to be one
  // internal "control room" chat, not a general permissions feature; a
  // regular Provider group should never be given this same access, since it
  // would let that Provider see every OTHER Provider's case data too.
  if (body.telegramAdminChatId !== undefined) {
    patch.telegramAdminChatId = String(body.telegramAdminChatId || '').trim();
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
  try { await logAction('settings', 'system', 'updated', 'System settings updated', user, {}); }
  catch (err) { console.error('Failed to log settings update:', err.message); }
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

// Read-only diagnostic (added 2026-08-26 while troubleshooting a Provider
// group whose Q&A bot never replied) — surfaces Telegram's own
// getWebhookInfo so Settings (or a quick authenticated fetch, as here) can
// see exactly what Telegram thinks the current webhook state is, without
// needing direct access to the bot token or Telegram's API. Same permission
// gate as register-webhook above; makes no changes of any kind.
router.get('/api/telegram/webhook-info', async (req, res, params, body, query) => {
  const user = await requirePerm(req, res, 'settings', 'edit');
  if (!user) return;
  try {
    const [webhookInfo, me] = await Promise.all([telegram.getWebhookInfo(), telegram.getMe()]);
    const out = { webhookInfo, me };
    // Optional ?chatId=... — also confirms whether this bot currently
    // recognizes that specific chat (see telegram.js's getChat comment).
    const chatId = query && query.chatId;
    if (chatId) {
      try {
        out.chat = await telegram.getChat(chatId);
      } catch (err) {
        out.chatError = err.message;
      }
    }
    sendJson(res, 200, out);
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
// unconfigured group is silently ignored), (b) that looks like it might
// actually be a question (see looksLikeQuestion() below), and (c) that
// server/ai.js's answerGroupQuestion() decides is actually a question about
// that Provider's cases (see that function's own conservative-by-design
// shouldRespond gate) — everything else in the group (ordinary
// conversation) is read and silently skipped, never replied to.
//
// (b) was added 2026-08-20 at Tiffany's request — every message in a
// Provider group used to fire a Gemini call (Gemini alone decided
// shouldRespond), so ordinary chit-chat between staff/providers was silently
// burning the whole app's shared 20-request/minute free-tier Gemini quota,
// starving unrelated AI features (Smart-Fill, Parameter Consistency Check)
// elsewhere in the app even when nobody was actually asking the bot
// anything. This cheap pre-filter runs with zero API calls, so a busy group
// chatting amongst themselves no longer costs anything — only messages that
// plausibly look like a question about a case reach Gemini at all.
function looksLikeQuestion(text) {
  const s = String(text || '').trim();
  if (s.length < 4) return false; // too short to be a real question ("ok", "😂", "+1"...)
  if (/[?？]/.test(s)) return true; // any half- or full-width question mark
  // Common Traditional/Simplified Chinese question particles and
  // case-tracking vocabulary — covers "怎麼樣了", "進度如何", "審核了嗎",
  // "現在到哪個階段", "什麼時候", "為什麼被拒" etc. without requiring "?".
  // (Still checked here even though isChineseText below now blocks a
  // reply for Chinese-language messages — kept so a MIXED-language message
  // with Chinese question wording but no "?" still correctly registers as
  // "looks like a question" for whichever other check runs on it later.)
  const QUESTION_HINTS = /(嗎|呢\b|怎麼|怎样|如何|進度|进度|狀態|状态|階段|阶段|審核|审核|核准|拒絕|拒绝|何時|何时|什麼時候|什么时候|為什麼|为什么|多久|status|progress|when|why|how)/i;
  return QUESTION_HINTS.test(s);
}

// Added 2026-08-26, at Tiffany's request — the group Q&A bot should not
// reply to Chinese-language messages at all (English only). Checked via a
// simple CJK Unicode range test rather than anything more elaborate: this
// only has to catch "is there Chinese text in here", not identify the
// language precisely. A message with ANY Chinese characters in it is
// treated as Chinese and skipped entirely — not just "no data to answer",
// genuinely never sent to Gemini at all, same as any other message this
// bot ignores (no reply, no Gemini quota spent).
function isChineseText(text) {
  return /[一-鿿㐀-䶿]/.test(String(text || ''));
}

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
      // Admin/internal chat (added 2026-08-26, at Tiffany's request — see
      // the PUT /api/settings handler's telegramAdminChatId comment): this
      // ONE designated chat gets cross-Provider access instead of being
      // locked to a single Provider's own cases. Checked before the normal
      // per-Provider lookup so a chat can't accidentally be both.
      const isAdminChat = !!(settings.telegramAdminChatId && String(settings.telegramAdminChatId) === String(msg.chat.id));
      const provider = isAdminChat ? null : findProviderForChatId(settings, msg.chat.id);
      if ((isAdminChat || provider) && looksLikeQuestion(msg.text) && !isChineseText(msg.text)) {
        const allCases = await store.all('cases');
        const relevantCases = isAdminChat
          ? allCases
          : allCases.filter((c) => String(c.provider || '').trim().toLowerCase() === provider.trim().toLowerCase());
        // Knowledge Base content (added 2026-08-25, at Tiffany's request) —
        // lets the bot also answer general PAGCOR/regulatory questions, not
        // just this Provider's own case status. Only 'Active' (i.e.
        // company-approved/published) entries are ever sent, from BOTH the
        // FAQ tab and the Documents tab (a Document's `notes` summary field,
        // not the underlying file) — Draft/Pending Review/Archived entries
        // are deliberately excluded so nothing unreviewed or outdated ever
        // gets quoted back to a Provider.
        const [allKbFaqs, allKbDocuments] = await Promise.all([store.all('kbFaqs'), store.all('kbDocuments')]);
        const activeKbFaqs = allKbFaqs.filter((f) => f.status === 'Active');
        const activeKbDocuments = allKbDocuments.filter((d) => d.status === 'Active');
        const result = await ai.answerGroupQuestion({
          providerName: isAdminChat ? null : provider, question: msg.text, cases: relevantCases,
          kbFaqs: activeKbFaqs, kbDocuments: activeKbDocuments, isAdmin: isAdminChat,
        });
        if (result && result.shouldRespond && result.answer) {
          await telegram.sendTelegramMessage(String(msg.chat.id), result.answer, { replyToMessageId: msg.message_id });
        }
      } // else: not a known Provider group/DM, not the admin chat, or a Chinese-language message — nothing to do
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
  const [tasks, users, cases] = await Promise.all([store.all('tasks'), store.all('users'), store.all('cases')]);
  const due = tasks.filter((t) => t.isDeadlineFollowUp && t.status !== 'Completed'
    && t.dueDate === today && !t.followUpReminderSentAt);
  if (!due.length) return;

  const footer = '\n\nOpen Legal Genie to view/update: Task Management.';
  const sentTaskIds = new Set();

  // telegramAdminChatId (added 2026-08-26, at Tiffany's request — see the
  // PUT /api/settings handler's comment): when set, every due follow-up
  // across ALL Assignees is combined into a single digest sent to this one
  // chat instead of each Assignee getting their own personal Telegram
  // message. This REPLACES the old per-Assignee behavior entirely (not
  // "also sends") — Tiffany asked to centralize these in one place she
  // monitors rather than have them scattered across individual chats.
  if (settings.telegramAdminChatId) {
    const caseById = new Map(cases.map((c) => [c.id, c]));
    const taskLine = (t) => {
      const relatedCase = t.relatedCaseId ? caseById.get(t.relatedCaseId) : null;
      const provider = relatedCase && relatedCase.provider ? ` [${relatedCase.provider}]` : '';
      const assigneeNames = taskAssigneeIds(t)
        .map((uid) => users.find((u) => u.id === uid))
        .filter(Boolean)
        .map((u) => u.fullName || u.username)
        .join(', ');
      return `• ${t.title}${provider}${assigneeNames ? ` (Assignee: ${assigneeNames})` : ''}`;
    };
    const heading = due.length === 1
      ? `⏰ Legal Genie reminder: ${due[0].title}`
      : `⏰ Legal Genie: ${due.length} follow-ups due today`;
    const body = due.length === 1
      ? taskLine(due[0])
      : due.map(taskLine).join('\n');
    try {
      await telegram.sendTelegramMessage(settings.telegramAdminChatId, `${heading}\n\n${body}${footer}`);
      due.forEach((t) => sentTaskIds.add(t.id));
    } catch (err) {
      console.error(`[telegram] failed to send follow-up digest to admin chat:`, err.message);
    }
  } else {
    const taskLine = (t) => `• ${t.title}${t.description ? ` — ${t.description}` : ''}`;
    // A single due task reads as a normal reminder; 2+ read as a bulleted
    // digest, so a quiet day still gets the same friendly one-line message
    // it always did instead of an oddly-formatted "1 follow-up" digest.
    const combinedBody = (list) => (list.length === 1
      ? (list[0].description || list[0].title)
      : list.map(taskLine).join('\n'));

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
  }

  for (const id of sentTaskIds) {
    await store.update('tasks', id, { followUpReminderSentAt: new Date().toISOString() });
  }
}
router.runDueFollowUpReminders = checkAndSendFollowUpReminders;

// ---------------------------------------------------------------------------
// Vercel Cron entry point for the due-today follow-up check above
// ---------------------------------------------------------------------------
// Added 2026-08-20 at Tiffany's request — checkAndSendFollowUpReminders was
// only ever wired up via server.js's setInterval, which (per that file's
// own comment) NEVER actually fires on Vercel: a serverless deployment
// spins up a fresh, short-lived instance per request, so a setInterval
// timer never survives long enough to tick. That's why the production site
// (on Vercel) was silently never sending the Telegram follow-up reminders
// at all, even though the exact same code works fine on the Render
// deployment. This route gives Vercel's own Cron Jobs feature (see
// vercel.json's "crons") something to call on a schedule instead — Vercel
// invokes a cron'd route the same way any HTTP request hits this server,
// which *does* work in a serverless model (unlike a timer that has to
// survive between requests).
//
// Protected by CRON_SECRET (optional but strongly recommended): when set as
// an environment variable on the Vercel project, Vercel automatically sends
// `Authorization: Bearer <CRON_SECRET>` on every cron-triggered request, so
// checking it here stops a stranger who finds this URL from triggering
// reminder sends on demand. If CRON_SECRET isn't set, this runs unprotected
// (fine for local/manual testing, not recommended for production).
router.get('/api/cron/follow-up-reminders', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers['authorization'] || '';
    if (auth !== `Bearer ${secret}`) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }
  }
  try {
    await checkAndSendFollowUpReminders();
    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
});

// Exported for the automated test suite only (test/routes.test.js) — attached
// as a property on the router rather than changing `module.exports` itself,
// so this is purely additive and doesn't touch how server.js consumes this
// module. Lets the duplicate-game-detection logic (buildExistingGameIndex /
// findExistingGameMatch / titlesLikelySameGame) be unit-tested directly
// instead of only through a full API call. Added 2026-08-25 at Tiffany's
// request, alongside the same test-only export added to server/ai.js.
router._testables = {
  buildExistingGameIndex, findExistingGameMatch, normalizeGameName, titlesLikelySameGame, importDedupKey,
  looksLikeQuestion, isChineseText,
};

module.exports = router;
