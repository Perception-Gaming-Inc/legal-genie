'use strict';
/* Legal Genie - frontend SPA (vanilla JS + a small self-contained UI kit) */

// ---------------------------------------------------------------------------
// Icons — inline SVG line-icon set (no icon font / no CDN dependency)
// ---------------------------------------------------------------------------
const ICON_PATHS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  briefcase: '<rect x="2" y="7" width="20" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="2" y1="13" x2="22" y2="13"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>',
  shield: '<path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/><polyline points="8.5 12 11 14.5 15.5 9.5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H3z"/><path d="M3 10h18l-1.8 8.3a2 2 0 0 1-2 1.7H6.8a2 2 0 0 1-2-1.7z"/>',
  checklist: '<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><polyline points="4 6 5 7 7 5"/><polyline points="4 12 5 13 7 11"/><polyline points="4 18 5 19 7 17"/>',
  checkSquare: '<rect x="3" y="3" width="18" height="18" rx="3"/><polyline points="8 12 11 15 16 9"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M9.5 21a2.5 2.5 0 0 0 5 0"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 1.5v3.4M12 19.1v3.4M4.6 4.6l2.4 2.4M17 17l2.4 2.4M1.5 12h3.4M19.1 12h3.4M4.6 19.4l2.4-2.4M17 7l2.4-2.4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/>',
  download: '<path d="M12 3v12"/><polyline points="7 10 12 15 17 10"/><path d="M5 19h14"/>',
  upload: '<path d="M12 21V9"/><polyline points="7 14 12 9 17 14"/><path d="M5 5h14"/>',
  check: '<polyline points="4 12 10 18 20 6"/>',
  x: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/>',
  scale: '<path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7l-3 6a3 3 0 0 0 6 0Z"/><path d="M19 7l-3 6a3 3 0 0 0 6 0Z"/>',
  sparkle: '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.2"/><line x1="16" y1="2.5" x2="16" y2="6.5"/><line x1="8" y1="2.5" x2="8" y2="6.5"/><line x1="3" y1="9.5" x2="21" y2="9.5"/>',
  chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
  chevronRight: '<polyline points="9 18 15 12 9 6"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 9 8 9"/><polyline points="12 7 12 12 16 14"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
};
function Icon(name, cls) {
  const d = ICON_PATHS[name] || '';
  return `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}
function sparkleMark(cls) {
  return `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2c.45 2.85 1.1 4.85 2.1 5.9 1 1 3 1.65 5.9 2.1-2.9.45-4.9 1.1-5.9 2.1-1 1.05-1.65 3.05-2.1 5.9-.45-2.85-1.1-4.85-2.1-5.9-1-1-3-1.65-5.9-2.1 2.9-.45 4.9-1.1 5.9-2.1 1-1.05 1.65-3.05 2.1-5.9z"/><path d="M19 15.5c.24 1.36.58 2.3 1 2.73.42.44 1.34.78 2.65 1.02-1.31.24-2.23.58-2.65 1.02-.42.43-.76 1.37-1 2.73-.24-1.36-.58-2.3-1-2.73-.42-.44-1.34-.78-2.65-1.02 1.31-.24 2.23-.58 2.65-1.02.42-.43.76-1.37 1-2.73z"/></svg>`;
}
function initials(name) {
  return String(name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------
const Api = {
  token: localStorage.getItem('lms_token') || null,
  setToken(t) { this.token = t; if (t) localStorage.setItem('lms_token', t); else localStorage.removeItem('lms_token'); },
  async req(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const resp = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    if (resp.status === 401) {
      this.setToken(null);
      State.user = null;
      renderLogin('Your session expired. Please log in again.');
      throw new Error('Unauthorized');
    }
    let data = null;
    try { data = await resp.json(); } catch (e) { /* no body */ }
    if (!resp.ok) throw new Error((data && data.error) || `Request failed (${resp.status})`);
    return data;
  },
  get(p) { return this.req('GET', p); },
  post(p, b) { return this.req('POST', p, b); },
  put(p, b) { return this.req('PUT', p, b); },
  del(p) { return this.req('DELETE', p); },
};

// A plain <a href="/api/...">, which browsers navigate to directly, never
// carries the app's Authorization header (that's only ever attached by
// Api.req's own fetch() calls) — every protected download route responds
// "Not authenticated" to a bare link click. This does the same
// fetch-with-header dance as Api.req, but for a binary response: fetches
// the file as a Blob with the token attached, then triggers the save via a
// throwaway object URL (same trick exportCasesCsv already uses for its
// client-built CSV, just fed a server response instead of a local Blob).
async function downloadAuthedFile(url, fileName) {
  const headers = {};
  if (Api.token) headers['Authorization'] = `Bearer ${Api.token}`;
  let resp;
  try {
    resp = await fetch(url, { headers });
  } catch (err) {
    toast('Download failed: ' + err.message, 'danger');
    return;
  }
  if (resp.status === 401) {
    Api.setToken(null);
    State.user = null;
    renderLogin('Your session expired. Please log in again.');
    return;
  }
  if (!resp.ok) {
    let message = `Download failed (${resp.status})`;
    try { const data = await resp.json(); if (data && data.error) message = data.error; } catch (e) { /* non-JSON error body */ }
    toast(message, 'danger');
    return;
  }
  const blob = await resp.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

// Same authenticated fetch-as-Blob trick as downloadAuthedFile above, but
// opens the result in a new tab instead of forcing a save — a Blob's own
// `type` (taken from the response's real Content-Type) is what the browser
// uses to decide whether to render it inline (PDF/image) or fall back to a
// download prompt for anything it can't display; the server's
// Content-Disposition: attachment header on /download only affects a direct
// navigation, not a Blob built from a fetch() response, so no separate
// "preview" backend route is needed. The tab is opened synchronously (before
// the await) so browsers don't treat it as an unrequested popup — its
// location is only pointed at the real blob URL once the fetch resolves.
async function previewAuthedFile(url) {
  const win = window.open('', '_blank');
  const headers = {};
  if (Api.token) headers['Authorization'] = `Bearer ${Api.token}`;
  let resp;
  try {
    resp = await fetch(url, { headers });
  } catch (err) {
    if (win) win.close();
    toast('Preview failed: ' + err.message, 'danger');
    return;
  }
  if (resp.status === 401) {
    if (win) win.close();
    Api.setToken(null);
    State.user = null;
    renderLogin('Your session expired. Please log in again.');
    return;
  }
  if (!resp.ok) {
    if (win) win.close();
    let message = `Preview failed (${resp.status})`;
    try { const data = await resp.json(); if (data && data.error) message = data.error; } catch (e) { /* non-JSON error body */ }
    toast(message, 'danger');
    return;
  }
  if (!win) {
    toast('Please allow pop-ups for this site to preview files.', 'warning');
    return;
  }
  const blob = await resp.blob();
  const blobUrl = URL.createObjectURL(blob);
  win.location = blobUrl;
}

// ---------------------------------------------------------------------------
// Global state
// ---------------------------------------------------------------------------
const State = { user: null, role: null, lookups: null };

// Document Center folder-browser position (Provider -> Game -> Documents —
// see renderDocuments()). Deliberately module-level (not local to
// renderDocuments) so it survives the re-render a delete/edit/upload
// triggers via route() — otherwise deleting one file from inside a game's
// folder would bounce you all the way back out to the provider list.
// UNCATEGORIZED_* are display-only sentinel labels for documents missing a
// provider/gameTitle; they're never written back as real field values.
const UNCATEGORIZED_PROVIDER = 'Uncategorized Provider';
const UNCATEGORIZED_GAME = 'Uncategorized Game';
let documentsFolderNav = { provider: null, gameTitle: null };

// Task Management's status stat tiles (see renderTasks) act as a toggleable
// filter over the table below them — module-level for the same reason as
// documentsFolderNav above: it needs to survive the re-render a create/
// edit/delete triggers via route(), so filtering by "Overdue" and then
// editing one of those tasks doesn't silently reset back to showing
// everything.
let taskStatusFilter = null; // null = show all; else 'To-Do' | 'In Progress' | 'Completed' | 'Overdue'

// Some Providers show only a short in-game watermark on their own screens
// rather than their full company name — confirmed directly by Tiffany:
// "OP" is Omniplay's own watermark, not a separate company. AI-extracted
// documents can end up tagged with either form depending on what a given
// file actually shows, so Document Center groups/displays these under the
// SAME provider tab rather than fracturing into two — same idea as the
// case/whitespace-insensitive grouping in renderDocuments() below, just for
// an abbreviation instead of a casing difference. Unlike that casing case
// (where whichever exact spelling appeared most often wins the display
// label), an aliased provider always displays under its full name, since
// the short form is just a watermark, never really "a name" on its own.
// Add more entries here as they turn up in real testing.
const PROVIDER_NAME_ALIASES = { op: 'Omniplay' };

// Calendar page (renderCalendar()) — which month is currently shown, and
// which single day the "Daily Agenda" panel beneath the grid is showing.
// Module-level (not local to renderCalendar) for the same reason as
// documentsFolderNav above: survives re-renders (e.g. after "Today") without
// losing the user's place. Both start null and are lazily set to the real
// current date on first render, since "today" can't be computed at module
// load time in every environment this file might be evaluated in.
let calendarNav = { year: null, month: null };
let calendarSelectedDate = null;

// "Approval Center" and "Notifications" deliberately have no entry here —
// they're still real, fully working pages (routes untouched below), just
// not permanent sidebar items anymore. Notifications is already one click
// away via the bell icon in the topbar (see renderShell); Approval Center
// now has its pending items surfaced directly as a Dashboard widget (see
// renderDashboard), with a link out to the full page for anyone who wants
// it. Removed to cut sidebar clutter — most days neither needs its own
// permanent slot in the nav.
const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
  { key: 'cases', label: 'Case Management', icon: 'briefcase' },
  { key: 'documents', label: 'Document Center', icon: 'folder' },
  { key: 'tasks', label: 'Task Management', icon: 'checklist' },
  { key: 'knowledgeBase', label: 'Knowledge Base', icon: 'book' },
  { key: 'settings', label: 'Settings', icon: 'gear' },
];

// ---------------------------------------------------------------------------
// PAGCOR-domain constants (Case Management / Document Center extensions)
// ---------------------------------------------------------------------------
// Mirrors server/pagcor.js exactly — kept as a separate copy here because
// this is plain browser JS with no build step to share a module with the
// server. If you change the wording/keys in server/pagcor.js, update this
// copy too.
// Changed 2026-08-12 at Tiffany's request from the earlier 6-stage list
// (Not Started / Preparing Documents / Submitted to PAGCOR / Under PAGCOR
// Review / LOA Approved / Rejected) to this simpler 5-stage one — see the
// matching comment in server/pagcor.js and scripts/migrate-pagcor-stages.js
// for how existing cases on the old stage names were migrated.
// 'Game Testing' added 2026-08-20 at Tiffany's request — see the matching
// comment in server/pagcor.js. Sits between 'Pending Documents' and 'For
// Review' since, per Galatic Events Corp's flowchart, jackpot games must
// complete PAGCOR Game Testing (and submit the Jackpot Report/Screenshots)
// before PAGCOR Evaluation starts; non-jackpot games skip it entirely.
const PAGCOR_STAGE_OPTIONS = [
  'Pending Documents', 'Game Testing', 'For Review', 'On Process', 'Approved', 'Rejected',
];
// The normal, linear left-to-right pipeline a game submission moves through.
// 'Rejected' is deliberately excluded here — it's an off-path terminal state
// (a submission can be rejected from any point in the pipeline), not a
// further step along it, so it gets its own distinct visual treatment in
// pagcorStageStepperHtml() below rather than a further step on the bar.
// 'Game Testing' is included here but pagcorStageStepperHtml() filters it
// back out for non-jackpot games (withJackpot !== 'Yes') before rendering,
// since the flowchart has them skip straight to 'For Review' — see that
// function's withJackpot param.
const PAGCOR_LINEAR_STAGES = [
  'Pending Documents', 'Game Testing', 'For Review', 'On Process', 'Approved',
];
// Brought back 2026-08-12 at Tiffany's request (was removed once already,
// see the matching comment in server/pagcor.js for the full history). This
// is a simple, manually-maintained tracking checklist; it does not gate the
// "Download All Documents" button (that's the AI Parameter Consistency
// Check's job — see renderCaseDetail()'s downloadReady logic).
//
// `let`, not `const`, since 2026-08-12 (later the same day): the actual
// list of items is now editable in Settings > Required Document Settings
// (see renderChecklistSettingsTab below), not fixed in code. boot() below
// sets this from State.lookups.checklistItems (sent by GET /api/lookups —
// app.js is plain browser JS with no bundler, so it can't require()
// server/routes.js's getChecklistItems() directly, unlike server/import.js
// can). Starts empty so nothing tries to render checklist UI before boot()
// has actually populated it.
let PAGCOR_CHECKLIST_ITEMS = [];
function checklistDoneCount(checklist) {
  if (!checklist) return 0;
  return PAGCOR_CHECKLIST_ITEMS.filter((i) => checklist[i.key]).length;
}
// Small "2/3" pill for the case row / case detail header — title attribute
// spells out exactly which items are still outstanding, so hovering answers
// "what's left" without opening the modal.
function checklistBadgeHtml(checklist) {
  const done = checklistDoneCount(checklist);
  const total = PAGCOR_CHECKLIST_ITEMS.length;
  const missing = PAGCOR_CHECKLIST_ITEMS.filter((i) => !(checklist && checklist[i.key])).map((i) => i.label);
  const tone = done === total ? 'success' : done === 0 ? 'neutral' : 'warning';
  const title = done === total ? 'Checklist complete' : `Still missing: ${missing.join(', ')}`;
  return `<span class="badge badge-soft-${tone}" title="${escapeHtml(title)}">${done}/${total}</span>`;
}
// Modal to tick off the PAGCOR Checklist for one case — saves straight
// through the normal PUT /api/cases/:id endpoint (checklist is just a
// regular field on the case, same as any other), then calls onSaved() so
// the caller can refresh whatever's showing the case (table row or the
// case detail page).
function showPagcorChecklistModal(item, onSaved) {
  const modalId = 'pagcorChecklistModal';
  let modalEl = document.getElementById(modalId);
  if (modalEl) modalEl.remove();
  modalEl = document.createElement('div');
  modalEl.id = modalId;
  modalEl.className = 'modal fade';
  modalEl.tabIndex = -1;
  const checklist = item.checklist || {};
  modalEl.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">PAGCOR Checklist — ${escapeHtml(item.gameTitle || item.title)}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          ${PAGCOR_CHECKLIST_ITEMS.map((i) => `
            <div class="form-check mb-2">
              <input class="form-check-input checklist-item" type="checkbox" id="checklist-${i.key}" data-key="${i.key}" ${checklist[i.key] ? 'checked' : ''}>
              <label class="form-check-label" for="checklist-${i.key}">${escapeHtml(i.label)}</label>
            </div>`).join('')}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="checklistSaveBtn">Save</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modalEl);
  const modal = new bootstrap.Modal(modalEl);
  modal.show();

  modalEl.querySelector('#checklistSaveBtn').addEventListener('click', async () => {
    const btn = modalEl.querySelector('#checklistSaveBtn');
    btn.disabled = true;
    const newChecklist = {};
    modalEl.querySelectorAll('.checklist-item').forEach((cb) => { newChecklist[cb.dataset.key] = cb.checked; });
    try {
      await Api.put(`/api/cases/${item.id}`, { checklist: newChecklist });
      modal.hide();
      toast('Checklist updated');
      if (onSaved) onSaved();
    } catch (err) {
      toast(err.message, 'danger');
      btn.disabled = false;
    }
  });
  modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
}
// Modal to edit the three jackpot-testing fields on one game
// (jackpotTestingDate / jackpotReportSubmitted / testingScreenshotsSubmitted)
// — added 2026-08-20 at Tiffany's request. These fields already existed in
// the data model (set on Excel import, read-only displayed on the game card
// when withJackpot === 'Yes') but had no editable UI anywhere in the
// multi-game case flow until now; the only prior editable copy was in
// caseFormFields(), which is exclusively used by the legacy single-game AI
// intake review modal, never by this multi-game game card. `game` is the
// current game object (for pre-filling); `onSave(fieldPatch)` does the
// actual persisting — the caller (renderCaseDetail) supplies one that reuses
// its existing patchOneGame() helper so this reuses the exact same
// "merge onto the one game being edited, leave every other game's fields
// untouched" approach as the PAGCOR stage stepper and checklist saves right
// above it, avoiding the class of data-loss bug fixed 2026-08-20 in
// showCaseFormModal's submit handler.
function showJackpotTestingModal(game, onSave) {
  const modalId = 'jackpotTestingModal';
  let modalEl = document.getElementById(modalId);
  if (modalEl) modalEl.remove();
  modalEl = document.createElement('div');
  modalEl.id = modalId;
  modalEl.className = 'modal fade';
  modalEl.tabIndex = -1;
  const dateVal = game.jackpotTestingDate ? String(game.jackpotTestingDate).slice(0, 10) : '';
  modalEl.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Game Testing Info — ${escapeHtml(game.gameTitle || 'Game')}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label class="form-label small">PAGCOR Game Testing Date</label>
            <input type="date" class="form-control" id="jtTestingDate" value="${dateVal}">
          </div>
          <div class="mb-3">
            <label class="form-label small">Jackpot Report Submitted?</label>
            <select class="form-select" id="jtReportSubmitted">
              <option value="">—</option>
              ${YES_NO_OPTIONS.map((v) => `<option value="${v}" ${v === game.jackpotReportSubmitted ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label small">Testing Screenshots Submitted?</label>
            <select class="form-select" id="jtScreenshotsSubmitted">
              <option value="">—</option>
              ${YES_NO_OPTIONS.map((v) => `<option value="${v}" ${v === game.testingScreenshotsSubmitted ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="jtSaveBtn">Save</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modalEl);
  const modal = new bootstrap.Modal(modalEl);
  modal.show();

  modalEl.querySelector('#jtSaveBtn').addEventListener('click', async () => {
    const btn = modalEl.querySelector('#jtSaveBtn');
    btn.disabled = true;
    const fieldPatch = {
      jackpotTestingDate: modalEl.querySelector('#jtTestingDate').value || null,
      jackpotReportSubmitted: modalEl.querySelector('#jtReportSubmitted').value || null,
      testingScreenshotsSubmitted: modalEl.querySelector('#jtScreenshotsSubmitted').value || null,
    };
    try {
      await onSave(fieldPatch);
      modal.hide();
    } catch (err) {
      toast(err.message, 'danger');
      btn.disabled = false;
    }
  });
  modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
}
// Renders the horizontal PAGCOR review progress stepper shown at the top of
// the case detail page (renderCaseDetail() below). Steps before the current
// stage are marked done (checkmark), the current stage is highlighted, and
// later steps are shown as upcoming. 'Rejected' shows a separate red banner
// instead of a stepper position, since it isn't a point on the linear path.
// When canEdit is true, each linear step gets a data-stage attribute and a
// clickable style — renderCaseDetail() wires up the actual click handler,
// this function only marks which steps should be clickable and with what
// value, same split as the PAGCOR Checklist (markup here, save-on-click
// logic at the call site).
// withJackpot: pass the game's `withJackpot` value ('Yes'/'No'/undefined).
// 'Game Testing' is only shown as a step for withJackpot === 'Yes' games —
// per the flowchart, non-jackpot games skip that step entirely and go
// straight from 'Pending Documents' to 'For Review'. Added 2026-08-20.
function pagcorStageStepperHtml(stage, canEdit, withJackpot) {
  if (stage === 'Rejected') {
    return `
      <div class="pagcor-stepper pagcor-stepper-rejected d-flex align-items-center gap-2">
        ${Icon('x', 'text-danger')}
        <span class="fw-semibold text-danger">Rejected</span>
        <span class="small text-secondary">This game submission did not pass PAGCOR review.</span>
      </div>`;
  }
  const stages = withJackpot === 'Yes' ? PAGCOR_LINEAR_STAGES : PAGCOR_LINEAR_STAGES.filter((s) => s !== 'Game Testing');
  const idx = Math.max(0, stages.indexOf(stage || 'Pending Documents'));
  return `
    <div class="pagcor-stepper d-flex align-items-start">
      ${stages.map((s, i) => {
        const state = i < idx ? 'done' : (i === idx ? 'current' : 'upcoming');
        const connector = i > 0 ? `<div class="pagcor-step-connector ${i <= idx ? 'done' : ''}"></div>` : '';
        const clickable = canEdit && i !== idx;
        const titleText = clickable ? `Click to set to "${s}"` : s;
        return `${connector}
        <div class="pagcor-step pagcor-step-${state}${clickable ? ' pagcor-step-clickable' : ''}" ${clickable ? `data-stage="${escapeHtml(s)}"` : ''} title="${escapeHtml(titleText)}">
          <div class="pagcor-step-dot">${state === 'done' ? Icon('check') : (i + 1)}</div>
          <div class="pagcor-step-label">${escapeHtml(s)}</div>
        </div>`;
      }).join('')}
    </div>`;
}
const REPORT_TYPE_OPTIONS = [
  'Math Model Report', 'RNG Test Report', 'Game Rules / Paytable', 'PAGCOR Submission Letter', 'Letter of Approval (LOA)',
  // Added 2026-08-18 for the Jackpot-game testing branch (PAGCOR Game
  // Testing -> Post-Testing Requirements) — see caseFormFields()'s jackpot
  // tracking fields below for the matching case-level tracking.
  'Jackpot Report', 'PAGCOR Testing Screenshots', 'Other',
];
const GAME_TYPE_OPTIONS = ['Slots', 'Arcade-Type', 'Table', 'eBingo', 'Other'];
const YES_NO_OPTIONS = ['Yes', 'No'];

function canView(moduleKey) {
  // The Calendar page has no data of its own, it just reads Case deadlines
  // and Task due dates, each of which is already permission-checked at
  // its own /api/cases and /api/tasks
  // fetch (renderCalendar only requests either list when canView('cases')/
  // canView('tasks') is true, so a viewer without Case access simply never
  // sees deadlines on the calendar, without needing its own roles-table row).
  if (moduleKey === 'calendar') return true;
  if (!State.role) return false;
  if (State.role.name === 'Admin') return true;
  const p = (State.role.permissions || {})[moduleKey];
  return !!(p && p.view);
}
function canDo(moduleKey, action) {
  if (!State.role) return false;
  if (State.role.name === 'Admin') return true;
  const p = (State.role.permissions || {})[moduleKey];
  return !!(p && p[action]);
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Date Received (and possibly other free-text-from-Excel fields) can carry
// a raw string with no year at all (e.g. a spreadsheet cell that just said
// "May 13") — server/import.js's formatDateish() passes those through
// as-is rather than guessing a year. new Date("May 13") doesn't fail,
// though: it silently parses to some arbitrary year (2001, a legacy JS
// Date quirk), which would then be treated as if it were a real, known
// year. That's actively misleading for DISPLAY (fmtDate below) and just as
// misleading for SORTING (sortValue in renderCases) — a year-less date
// used to sort by that same fake 2001 regardless of the column showing the
// plain "May 13" text next to it, scrambling the order. Shared here so
// both call sites agree on what counts as "no real year to sort/format by".
function hasReliableYear(v) {
  return !(typeof v === 'string' && !/\d{4}/.test(v));
}
function fmtDate(iso) {
  if (!iso) return '—';
  if (!hasReliableYear(iso)) return iso;
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
const STATUS_TONE = {
  Open: 'info', Active: 'info', Pending: 'warning', 'In Progress': 'info',
  Closed: 'neutral', Completed: 'success', Approved: 'success', Compliant: 'success',
  Overdue: 'danger', Rejected: 'danger', 'Due Soon': 'warning',
  'To-Do': 'neutral',
  Expired: 'neutral', Terminated: 'neutral', Draft: 'neutral',
  // PAGCOR Stage tones (Approved/Rejected reuse the generic entries above).
  'Pending Documents': 'neutral', 'For Review': 'info', 'On Process': 'warning',
  // Knowledge Base document/FAQ status (see renderKnowledgeBase in app.js).
  'Pending Review': 'warning', Archived: 'neutral',
};
function badge(text) {
  const tone = STATUS_TONE[text] || 'neutral';
  return `<span class="badge badge-soft-${tone}">${escapeHtml(text || '—')}</span>`;
}
function priorityBadge(text) {
  const tone = text === 'High' ? 'danger' : text === 'Medium' ? 'warning' : 'neutral';
  return `<span class="badge badge-soft-${tone}">${escapeHtml(text || '—')}</span>`;
}
function userName(id) {
  const u = (State.lookups.users || []).find((x) => x.id === id);
  return u ? u.fullName : '—';
}
function caseName(id) {
  const c = (State.lookups.cases || []).find((x) => x.id === id);
  return c ? `${c.caseNumber} – ${c.title}` : null;
}
function toast(message, variant = 'success') {
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = `toast align-items-center text-bg-${variant} border-0`;
  el.setAttribute('role', 'alert');
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${escapeHtml(message)}</div>
    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  wrap.appendChild(el);
  const t = new bootstrap.Toast(el, { delay: 3500 });
  t.show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}

// ---------------------------------------------------------------------------
// Generic form modal
// ---------------------------------------------------------------------------
function fieldInputHtml(f, value) {
  const val = value === undefined || value === null ? '' : value;
  const req = f.required ? 'required' : '';
  const placeholder = f.placeholder ? `placeholder="${escapeHtml(f.placeholder)}"` : '';
  if (f.type === 'select') {
    const opts = f.options.map((o) => `<option value="${escapeHtml(o.value)}" ${String(o.value) === String(val) ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('');
    return `<select class="form-select" name="${f.name}" ${req}>${f.allowEmpty ? '<option value="">— None —</option>' : ''}${opts}</select>`;
  }
  // Added 2026-08-18 (Task Management's Assignee field, at Tiffany's
  // request — "一筆任務可以指派給多個負責人") — a checkbox list rather than a
  // native <select multiple>, since a multi-select's "hold Cmd/Ctrl to pick
  // more than one" interaction isn't discoverable and is easy to
  // accidentally clear. Reads back in showFormModal's submit handler via
  // querySelectorAll('[name="..."]:checked'), not form.elements[name] —
  // several checkboxes sharing one `name` don't behave like a single form
  // control there. `required` isn't enforced as an HTML attribute here
  // (checkbox groups don't support that natively); showFormModal checks
  // "at least one checked" itself before calling onSubmit.
  if (f.type === 'multiselect') {
    const selected = new Set((Array.isArray(val) ? val : []).map(String));
    return `<div class="border rounded p-2" style="max-height:180px;overflow:auto;">${(f.options || []).map((o) => `
      <div class="form-check">
        <input type="checkbox" class="form-check-input" name="${f.name}" value="${escapeHtml(o.value)}" ${selected.has(String(o.value)) ? 'checked' : ''}>
        <label class="form-check-label">${escapeHtml(o.label)}</label>
      </div>`).join('') || '<div class="small text-secondary">No options available.</div>'}</div>`;
  }
  if (f.type === 'textarea') {
    return `<textarea class="form-control" name="${f.name}" rows="${f.rows || 3}" ${req} ${placeholder}>${escapeHtml(val)}</textarea>`;
  }
  if (f.type === 'checkbox') {
    return `<div class="form-check pt-2"><input type="checkbox" class="form-check-input" name="${f.name}" ${val ? 'checked' : ''}></div>`;
  }
  if (f.type === 'file') {
    return `<input type="file" class="form-control" name="${f.name}">`;
  }
  return `<input type="${f.type || 'text'}" class="form-control" name="${f.name}" value="${escapeHtml(val)}" ${req} ${placeholder}>`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// `reuseFileField` is the name of this form's own real file-upload field
// (e.g. Document Center's `fileName`), if it has one. When it does, AI
// smart-fill reads whatever file is already selected there instead of
// showing a second, separate file picker of its own — previously this box
// always had its own independent "Choose File" input, which was easy to
// confuse with the real attachment field further down the same form (a
// user could pick a file here, see the AI read it, and still have nothing
// actually attached to the record). Forms with no file field of their own
// (cases, contracts) keep the standalone picker, since there's nothing to
// reuse there.
function aiAssistHtml(reuseFileField) {
  return `
    <div class="ai-assist border rounded p-3 mb-3 bg-light">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <strong class="d-flex align-items-center gap-1">${sparkleMark()} AI Smart-Fill</strong>
        <span class="small text-secondary">Optional — paste text${reuseFileField ? '' : ', or upload a file'}</span>
      </div>
      <textarea class="form-control form-control-sm mb-2" id="aiAssistText" rows="3" placeholder="Paste an email, case description, contract excerpt… (optional)"></textarea>
      <div class="d-flex align-items-center gap-2">
        ${reuseFileField
          ? `<span class="small text-secondary">Will automatically read the file selected in "File Upload" below</span>`
          : `<input type="file" class="form-control form-control-sm" id="aiAssistFile" accept=".pdf,image/*,.txt">`}
        <button type="button" class="btn btn-sm btn-outline-primary text-nowrap ms-auto" id="aiAssistBtn">AI Smart-Fill</button>
      </div>
      <div id="aiAssistMsg" class="small mt-2"></div>
    </div>`;
}

async function showFormModal({ title, fields, initial = {}, onSubmit, submitLabel = 'Save', aiAssist = null }) {
  const modalId = 'formModal';
  let modalEl = document.getElementById(modalId);
  if (modalEl) modalEl.remove();
  modalEl = document.createElement('div');
  modalEl.id = modalId;
  modalEl.className = 'modal fade';
  modalEl.tabIndex = -1;

  // Progressive disclosure: a field with `section: 'x'` starts hidden and
  // is only shown once the field with `controlsSection: 'x'` (a checkbox,
  // rendered as its own toggle row rather than the usual label+input) is
  // checked. Lets a form default to just its common fields and only show
  // the rarer/specialized ones (e.g. PAGCOR game details on a case that
  // isn't a PAGCOR submission) once asked for — see caseFormFields()/
  // documents' fields() for the sections this is actually used on. A
  // section starts pre-expanded when editing a record that already has
  // data in it, so existing values are never hidden from view.
  const sectionsToExpand = new Set(
    fields.filter((f) => f.section && initial[f.name] !== undefined && initial[f.name] !== null && initial[f.name] !== '')
      .map((f) => f.section)
  );
  // This form's own real file-upload field, if it has one — see aiAssistHtml().
  const reuseFileField = fields.find((f) => f.type === 'file');

  modalEl.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">${escapeHtml(title)}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <form id="modalForm">
          <div class="modal-body">
            ${aiAssist ? aiAssistHtml(reuseFileField ? reuseFileField.name : null) : ''}
            ${aiAssist ? '<div id="multiGameFillBlock"></div>' : ''}
            ${fields.map((f) => {
              if (f.controlsSection) {
                const checked = sectionsToExpand.has(f.controlsSection);
                return `
                  <div class="form-check mb-3">
                    <input type="checkbox" class="form-check-input" id="toggle_${f.name}" name="${f.name}" ${checked ? 'checked' : ''}>
                    <label class="form-check-label" for="toggle_${f.name}">${escapeHtml(f.label)}</label>
                  </div>`;
              }
              const hidden = f.section && !sectionsToExpand.has(f.section);
              return `
              <div class="mb-3" ${f.section ? `data-section="${escapeHtml(f.section)}"` : ''} style="${hidden ? 'display:none' : ''}">
                <label class="form-label">${escapeHtml(f.label)}</label>
                ${fieldInputHtml(f, initial[f.name])}
              </div>`;
            }).join('')}
            <div id="modalError" class="text-danger small"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-primary">${escapeHtml(submitLabel)}</button>
          </div>
        </form>
      </div>
    </div>`;
  document.body.appendChild(modalEl);
  const modal = new bootstrap.Modal(modalEl);
  modal.show();

  // Shows/hides a section's fields, and keeps its toggle checkbox in sync
  // with that (needed for the AI-fill path below, which expands a section
  // programmatically rather than via the user clicking the checkbox).
  const setSectionExpanded = (section, expanded) => {
    modalEl.querySelectorAll(`[data-section="${section}"]`).forEach((el) => { el.style.display = expanded ? '' : 'none'; });
    const controllerField = fields.find((f) => f.controlsSection === section);
    if (controllerField) {
      const toggleEl = modalEl.querySelector(`#toggle_${controllerField.name}`);
      if (toggleEl) toggleEl.checked = expanded;
    }
  };
  fields.filter((f) => f.controlsSection).forEach((f) => {
    const toggleEl = modalEl.querySelector(`#toggle_${f.name}`);
    if (!toggleEl) return;
    toggleEl.addEventListener('change', () => setSectionExpanded(f.controlsSection, toggleEl.checked));
  });

  // Set by runAiAssist below when the AI decides one uploaded file actually
  // covers 2+ distinct games at once (see server/ai.js's `detectedGames` on
  // the documents module schema) — read again by the submit handler further
  // down to decide whether to create one document per checked game instead
  // of the usual single record. Stays null for every other form (cases,
  // contracts, ...) since only the documents schema ever returns this.
  let detectedGames = null;

  // Shared by both the "AI Smart-Fill" button (manual) and the file picker's
  // own change handler below (automatic — see reuseFileField block).
  // `auto` just changes the "reading…" message shown while it's running;
  // an auto-run failing (e.g. no GEMINI_API_KEY configured) is expected to
  // happen silently often enough that it shouldn't feel like an error the
  // way a manual click's failure should.
  const runAiAssist = async (auto) => {
    const btn = modalEl.querySelector('#aiAssistBtn');
    const msgEl = modalEl.querySelector('#aiAssistMsg');
    const textEl = modalEl.querySelector('#aiAssistText');
    const textVal = textEl ? textEl.value : '';
    // Reuse the form's own real file field if this form has one (see
    // aiAssistHtml's reuseFileField param) — otherwise fall back to the
    // AI box's own standalone file picker.
    const fileEl = reuseFileField
      ? modalEl.querySelector('#modalForm').elements[reuseFileField.name]
      : modalEl.querySelector('#aiAssistFile');
    const payload = { text: textVal };
    if (fileEl && fileEl.files && fileEl.files[0]) {
      payload.fileName = fileEl.files[0].name;
      payload.fileContentBase64 = await fileToBase64(fileEl.files[0]);
    }
    if (btn) btn.disabled = true;
    const originalLabel = btn ? btn.textContent : null;
    if (btn) btn.textContent = 'Processing…';
    if (msgEl) { msgEl.className = 'small mt-2 text-secondary'; msgEl.textContent = auto ? 'AI reading file…' : ''; }
    try {
      const { fields: extracted } = await Api.post(`/api/ai/extract/${aiAssist.module}`, payload);
      const form = modalEl.querySelector('#modalForm');
      let filledCount = 0;
      for (const f of fields) {
        if (f.controlsSection || f.type === 'multiselect' || extracted[f.name] === undefined || extracted[f.name] === null || extracted[f.name] === '') continue;
        const el = form.elements[f.name];
        if (!el) continue;
        el.value = extracted[f.name];
        filledCount++;
        // AI just filled a field that lives in a collapsed section (e.g.
        // it recognized this as a PAGCOR game document and filled
        // `provider`) — expand that section so the filled value is
        // actually visible, instead of silently populating a hidden field.
        if (f.section) setSectionExpanded(f.section, true);
      }
      // Multi-game bundle detection (Document Center only — see
      // MODULE_SCHEMAS.documents' `detectedGames` in server/ai.js): when one
      // uploaded file actually covers several different games at once (e.g.
      // a combined front-end testing screenshot report), there's no single
      // correct provider/gameTitle/gameId to fill in above. Show a
      // checklist instead so the user picks which game folders this same
      // file should be filed into — the submit handler further down reads
      // the checked boxes and creates one document per selected game.
      const multiBlock = modalEl.querySelector('#multiGameFillBlock');
      if (multiBlock) {
        if (Array.isArray(extracted.detectedGames) && extracted.detectedGames.length > 1) {
          detectedGames = extracted.detectedGames;
          multiBlock.innerHTML = `
            <div class="border rounded p-3 mb-3 bg-light">
              <div class="fw-semibold mb-2">${sparkleMark()} This document looks like it covers ${detectedGames.length} different games — check which ones to file it under:</div>
              ${detectedGames.map((g, i) => `
                <div class="form-check">
                  <input type="checkbox" class="form-check-input" id="multiGame_${i}" data-idx="${i}" checked>
                  <label class="form-check-label" for="multiGame_${i}">${escapeHtml(g.gameTitle || '(Unnamed game)')}${g.provider ? ` — ${escapeHtml(g.provider)}` : ''}${g.gameId ? ` (Game ID: ${escapeHtml(g.gameId)})` : ''}</label>
                </div>`).join('')}
              <div class="small text-secondary mt-2">Each checked game will get its own document record (same file content); unchecked games will not be filed.</div>
            </div>`;
          if (fields.some((f) => f.section === 'pagcor')) setSectionExpanded('pagcor', true);
        } else {
          detectedGames = null;
          multiBlock.innerHTML = '';
        }
      }
      if (msgEl) {
        msgEl.className = 'small mt-2 text-success';
        msgEl.textContent = detectedGames
          ? `AI detected ${detectedGames.length} games in this document — check which ones to file it under above.`
          : filledCount > 0
            ? `AI auto-filled ${filledCount} field(s) — please check them before submitting.`
            : 'AI could not find any fields to fill from this content. Please check the pasted content, or try pasting text/uploading a file instead.';
      }
    } catch (err) {
      // An auto-run that fails because there's simply no file/text yet, or
      // no GEMINI_API_KEY configured, shouldn't read as a scary error the
      // moment someone picks a file — it just quietly clears the "reading…"
      // status back out (fields are still fine to fill in by hand). A
      // manual button click still surfaces the real error message.
      if (msgEl) {
        if (auto) { msgEl.className = 'small mt-2'; msgEl.textContent = ''; }
        else { msgEl.className = 'small mt-2 text-danger'; msgEl.textContent = err.message; }
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
    }
  };

  if (aiAssist) {
    modalEl.querySelector('#aiAssistBtn').addEventListener('click', () => runAiAssist(false));
  }

  // Title is a required field on every form that has one (so every record
  // has a real searchable label), but a form with its own file field
  // shouldn't force typing a title just to name-copy the file you're
  // already uploading — picking a file fills Title from the filename
  // (extension stripped) as an instant fallback while AI (below) may
  // overwrite it with something better once it's read the actual content.
  if (reuseFileField) {
    const fileInputEl = modalEl.querySelector('#modalForm').elements[reuseFileField.name];
    const hasTitleField = fields.some((f) => f.name === 'title');
    if (fileInputEl) {
      fileInputEl.addEventListener('change', () => {
        if (hasTitleField) {
          const titleEl = modalEl.querySelector('#modalForm').elements['title'];
          if (titleEl && !titleEl.value.trim() && fileInputEl.files && fileInputEl.files[0]) {
            titleEl.value = fileInputEl.files[0].name.replace(/\.[^./\\]+$/, '');
          }
        }
        // Auto-run AI extraction the moment a file is picked, instead of
        // requiring a separate "AI Smart-Fill" click — this is the actual fix
        // for the repeated report that Provider/Game Title (and other
        // PAGCOR fields) were coming out blank: they were never wrong, AI
        // just never got asked because clicking the button is an easy step
        // to forget. Still fully editable/overridable afterward, and the
        // button stays for re-running by hand (e.g. after pasting extra
        // context text).
        if (aiAssist && fileInputEl.files && fileInputEl.files[0]) runAiAssist(true);
      });
    }
  }

  modalEl.querySelector('#modalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {};
    for (const f of fields) {
      if (f.controlsSection) continue; // UI-only section toggle, not a real record field
      if (f.type === 'multiselect') {
        // Several checkboxes share this `name` — form.elements[name] gives
        // back a RadioNodeList that doesn't behave like a normal control, so
        // read the checked ones directly instead (see fieldInputHtml above).
        data[f.name] = Array.from(form.querySelectorAll(`[name="${f.name}"]:checked`)).map((n) => n.value);
        continue;
      }
      const el = form.elements[f.name];
      if (!el) continue;
      if (f.type === 'checkbox') data[f.name] = el.checked;
      else if (f.type === 'file') {
        if (el.files && el.files[0]) {
          data.fileName = el.files[0].name;
          data.fileContentBase64 = await fileToBase64(el.files[0]);
        }
      } else if (f.type === 'number') data[f.name] = el.value === '' ? null : Number(el.value);
      else data[f.name] = el.value;
    }
    // Checkbox groups can't enforce HTML `required` the way a normal input
    // does — check "at least one selected" by hand instead, same error
    // surface a real required-field failure would hit.
    const missingMultiselect = fields.find((f) => f.type === 'multiselect' && f.required && !(data[f.name] || []).length);
    if (missingMultiselect) {
      modalEl.querySelector('#modalError').textContent = `${missingMultiselect.label} is required — select at least one.`;
      return;
    }
    // Multi-game bundle: if a checklist is showing (see runAiAssist above)
    // and at least one game is checked, this one uploaded file becomes N
    // separate document records — one per checked game, each reusing the
    // same fileContentBase64/title/category/etc, only provider/gameTitle/
    // gameId swapped in per game — instead of the usual single record. If
    // every box got unchecked, fall through to the normal single-record
    // path below using whatever's in the provider/gameTitle/gameId fields.
    const checkedGames = detectedGames
      ? Array.from(modalEl.querySelectorAll('#multiGameFillBlock input[type=checkbox]:checked'))
          .map((cb) => detectedGames[Number(cb.dataset.idx)])
      : [];
    try {
      if (checkedGames.length > 0) {
        await Promise.all(checkedGames.map((g) => onSubmit({
          ...data,
          provider: g.provider || '',
          gameTitle: g.gameTitle || '',
          gameId: g.gameId || '',
        })));
      } else {
        await onSubmit(data);
      }
      modal.hide();
    } catch (err) {
      modalEl.querySelector('#modalError').textContent = err.message;
    }
  });
  modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
}

function confirmDialog(message) {
  return Promise.resolve(window.confirm(message));
}

// Generic read-only info modal (title + arbitrary body HTML, just a Close
// button) — used by the Document Center's "AI Summary" result,
// and reusable for any other simple "show some content" popup later instead
// of every caller building its own one-off modal markup.
function showInfoModal({ title, bodyHtml, size }) {
  const modalId = 'infoModal';
  let modalEl = document.getElementById(modalId);
  if (modalEl) modalEl.remove();
  modalEl = document.createElement('div');
  modalEl.id = modalId;
  modalEl.className = 'modal fade';
  modalEl.tabIndex = -1;
  modalEl.innerHTML = `
    <div class="modal-dialog${size ? ` ${size}` : ''}">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">${escapeHtml(title)}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modalEl);
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
  modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
}

// ---------------------------------------------------------------------------
// Shell (sidebar + topbar) & router
// ---------------------------------------------------------------------------
function renderShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="d-flex">
      <nav class="lms-sidebar d-flex flex-column flex-shrink-0">
        <div class="brand"><span class="brand-mark"><img src="/images/logo-mark.png" alt="" /></span>Legal Genie</div>
        <div class="nav flex-column" id="sideNav">
          ${NAV.filter((n) => canView(n.key)).map((n) => `
            <a class="nav-link" href="#/${n.key}" data-key="${n.key}">${Icon(n.icon)}${n.label}</a>
          `).join('')}
        </div>
        <div class="mt-auto sidebar-footer d-flex align-items-center gap-2">
          <span class="user-avatar">${escapeHtml(initials(State.user.fullName))}</span>
          <div class="small" style="min-width:0;">
            <div class="text-light fw-semibold" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(State.user.fullName)}</div>
            <div style="opacity:.65;">${escapeHtml(State.role.name)}</div>
          </div>
        </div>
      </nav>
      <div class="flex-grow-1">
        <div class="lms-topbar d-flex justify-content-between align-items-center px-4 py-2">
          <div id="pageTitle">&nbsp;</div>
          <div class="d-flex align-items-center gap-2">
            <a href="#/notifications" class="icon-btn position-relative" title="Notifications">
              ${Icon('bell')}
              <span id="notifBadge" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style="display:none;font-size:.6rem;"></span>
            </a>
            <button class="icon-btn" id="logoutBtn" title="Logout">${Icon('logout')}</button>
          </div>
        </div>
        <div class="lms-content" id="content"></div>
      </div>
    </div>
    <div class="toast-container position-fixed bottom-0 end-0 p-3" id="toastWrap" style="z-index:2000"></div>
  `;
  document.getElementById('logoutBtn').addEventListener('click', doLogout);
  refreshNotifBadge();
}

async function refreshNotifBadge() {
  try {
    const list = await Api.get('/api/notifications');
    const unread = list.filter((n) => !n.isRead).length;
    const el = document.getElementById('notifBadge');
    if (el) { el.style.display = unread ? 'inline-block' : 'none'; el.textContent = unread; }
  } catch (e) { /* ignore */ }
}

const ROUTES = {
  dashboard: renderDashboard,
  calendar: renderCalendar,
  cases: renderCases,
  documents: renderDocuments,
  tasks: renderTasks,
  approvals: renderApprovals,
  notifications: renderNotifications,
  knowledgeBase: renderKnowledgeBase,
  settings: renderSettings,
};

async function route() {
  if (!State.user) return;
  const hash = location.hash.replace(/^#\/?/, '') || 'dashboard';
  // Split off an optional "?query=string" (e.g. "#/cases?stage=Under%20PAGCOR%20Review",
  // used by the Dashboard's PAGCOR board links to deep-link into a pre-filtered
  // Case Management list) before taking the route key, so a query string never
  // breaks route matching. A second path segment after the key (e.g.
  // "#/cases/<id>") is a record id for that module's own detail page, if it
  // has one — currently only Case Management does (see the "cases" branch
  // below and renderCaseDetail()).
  const pathPart = hash.split('?')[0];
  const segments = pathPart.split('/').filter(Boolean);
  const key = segments[0] || 'dashboard';
  const subId = segments[1];
  document.querySelectorAll('#sideNav .nav-link').forEach((a) => a.classList.toggle('active', a.dataset.key === key));
  const title = (NAV.find((n) => n.key === key) || {}).label || 'Legal Genie';
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = title;
  const content = document.getElementById('content');
  if (!canView(key)) {
    content.innerHTML = `<div class="alert alert-warning">You do not have access to this module.</div>`;
    return;
  }
  content.innerHTML = `<div class="text-secondary"><div class="spinner-border spinner-border-sm me-2"></div>Loading…</div>`;
  try {
    if (key === 'cases' && subId) {
      await renderCaseDetail(content, subId);
    } else {
      const renderer = ROUTES[key] || renderDashboard;
      await renderer(content);
    }
  } catch (err) {
    content.innerHTML = `<div class="alert alert-danger">Failed to load: ${escapeHtml(err.message)}</div>`;
  }
}
window.addEventListener('hashchange', route);

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
function renderLogin(message) {
  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="login-wrap">
    <div class="card login-card shadow-lg">
      <div class="login-card-accent-bar"></div>
      <div class="card-body p-4">
        <div class="text-center mb-4">
          <div class="login-logo-mark"><img src="/images/logo-mark.png" alt="" /></div>
          <h5 class="mt-3 mb-1 login-title">Legal Genie</h5>
          <div class="text-secondary small">Gaming Machine &amp; Online Gaming Manufacturer</div>
        </div>
        ${message ? `<div class="alert alert-warning py-2 small">${escapeHtml(message)}</div>` : ''}
        <form id="loginForm">
          <div class="mb-3">
            <label class="form-label">Username</label>
            <input class="form-control" name="username" autofocus required autocomplete="username">
          </div>
          <div class="mb-3">
            <label class="form-label">Password</label>
            <input class="form-control" type="password" name="password" required autocomplete="current-password">
          </div>
          <div id="loginError" class="text-danger small mb-2"></div>
          <button class="btn btn-primary w-100 login-submit-btn" type="submit">Sign In</button>
        </form>
      </div>
    </div>
  </div>`;
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errEl = document.getElementById('loginError');
    errEl.textContent = '';
    try {
      const resp = await Api.post('/api/auth/login', { username: form.username.value, password: form.password.value });
      Api.setToken(resp.token);
      State.user = resp.user;
      State.role = resp.role;
      await boot(true);
    } catch (err) {
      errEl.textContent = err.message;
    }
  });
}

async function doLogout() {
  try { await Api.post('/api/auth/logout'); } catch (e) { /* ignore */ }
  Api.setToken(null);
  State.user = null;
  renderLogin();
}

// ---------------------------------------------------------------------------
// Page: Calendar
// ---------------------------------------------------------------------------
// Month-grid view (styled after the iOS/Google Calendar apps) that plots
// every case's Submit Date alongside Task Management due dates —
// including the auto-generated "follow up 30 days later" task
// server/routes.js's syncDeadlineFollowUpTask() keeps in sync with each
// Submit Date (see there for why that task exists instead of this page
// inventing its own separate reminder mechanism), user-created calendar
// events (see calendarEventFormFields() below), and Philippine public
// holidays (see PH_HOLIDAYS_2026 below), since a PAGCOR submission deadline
// that lands on a Philippine holiday matters for planning. Reuses
// /api/cases and /api/tasks directly rather than /api/lookups, since
// lookups intentionally strips fields like deadline/dueDate down to just
// id/title for the nav-wide autocomplete use case.
//
// Two panels above the grid answer "what's coming up" at different zoom
// levels — "Next 7 Days" and the selected day's own agenda — while the big
// grid itself is the "at a glance" view (each cell shows its own event
// chips, not just dots). Clicking a grid cell updates the selected-day
// panel instead of scrolling to a row in a longer list.
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDaysToKey(dateKey, n) {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + n);
  return ymd(d);
}
// Philippine 2026 regular holidays + special (non-working) days, straight
// from Malacañang's official proclamations (incl. the separate Eid'l Fitr /
// Eid'l Adha proclamations, which follow the Islamic calendar and are
// announced closer to the date each year) — see README.md for sources.
// `working: true` marks the one "special working day" (EDSA anniversary),
// which is NOT a day off, just an observance, so it's shown in a distinct
// (neutral, not green) color to avoid implying offices are closed.
// This list is 2026-specific and will need a matching PH_HOLIDAYS_<year>
// array added for any other year the Calendar page is browsed into — it
// intentionally does NOT try to compute movable dates itself.
const PH_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-02-17', name: 'Chinese New Year' },
  { date: '2026-02-25', name: 'EDSA People Power Anniversary', working: true },
  { date: '2026-03-20', name: "Eid'l Fitr" },
  { date: '2026-04-02', name: 'Maundy Thursday' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-04', name: 'Black Saturday' },
  { date: '2026-04-09', name: 'Araw ng Kagitingan' },
  { date: '2026-05-01', name: 'Labor Day' },
  { date: '2026-05-27', name: "Eid'l Adha" },
  { date: '2026-06-12', name: 'Independence Day' },
  { date: '2026-08-21', name: 'Ninoy Aquino Day' },
  { date: '2026-08-31', name: 'National Heroes Day' },
  { date: '2026-11-01', name: "All Saints' Day" },
  { date: '2026-11-02', name: "All Souls' Day" },
  { date: '2026-11-30', name: 'Bonifacio Day' },
  { date: '2026-12-08', name: 'Feast of the Immaculate Conception' },
  { date: '2026-12-24', name: 'Christmas Eve' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-30', name: 'Rizal Day' },
  { date: '2026-12-31', name: "New Year's Eve" },
];
const PH_HOLIDAYS_BY_YEAR = { 2026: PH_HOLIDAYS_2026 };
// Single source of truth for how each event type is labeled/colored,
// shared by the grid-cell chips, the day-by-day list, and the 7-day panel.
function calendarEventMeta(ev) {
  if (ev.type === 'holiday') return ev.working ? { label: 'Special Working Day', tone: 'neutral' } : { label: 'PH Holiday', tone: 'success' };
  return {
    deadline: { label: 'Submit Date', tone: 'danger' },
    followup: { label: 'Follow-up', tone: 'warning' },
    task: { label: 'Task', tone: 'info' },
    event: { label: 'Event', tone: 'purple' },
    // Added 2026-08-20 alongside the Game Testing PAGCOR stage — see
    // renderCalendar()'s cases.forEach for where these get added.
    gametest: { label: 'Game Testing', tone: 'warning' },
  }[ev.type] || { label: 'Task', tone: 'info' };
}
function calendarEventBadgeHtml(ev) {
  const meta = calendarEventMeta(ev);
  return `<span class="badge badge-soft-${meta.tone} text-nowrap">${meta.label}</span>`;
}
function calendarAgendaListHtml(events, emptyText) {
  if (!events.length) return `<div class="text-secondary small py-2">${escapeHtml(emptyText)}</div>`;
  return `<div class="list-group list-group-flush">
    ${events.map((ev) => {
      const badge = calendarEventBadgeHtml(ev);
      // User-created events (type 'event') aren't a link into another module
      // like a Case/Task/holiday row — instead, whoever created one (or an
      // Admin) gets inline edit/delete icons right here, wired up by
      // wireCalEventButtons() in renderCalendar. Everyone else just sees it.
      if (ev.type === 'event') {
        const editable = ev.createdBy === State.user.id || (State.role && State.role.name === 'Admin');
        return `<div class="list-group-item px-0 py-2 d-flex justify-content-between align-items-center gap-2">
          <span class="small text-truncate" ${ev.note ? `title="${escapeHtml(ev.note)}"` : ''}>${escapeHtml(ev.title)}</span>
          <span class="d-flex align-items-center gap-1 flex-shrink-0">
            ${badge}
            ${editable ? `
              <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-1 btn-cal-event-edit" data-id="${ev.id}" title="Edit">${Icon('edit')}</button>
              <button type="button" class="btn btn-sm btn-outline-danger py-0 px-1 btn-cal-event-del" data-id="${ev.id}" title="Delete">${Icon('trash')}</button>
            ` : ''}
          </span>
        </div>`;
      }
      const inner = `<span class="small text-truncate">${escapeHtml(ev.title)}</span>${badge}`;
      return ev.href
        ? `<a href="${ev.href}" class="list-group-item list-group-item-action px-0 py-2 d-flex justify-content-between align-items-center gap-2">${inner}</a>`
        : `<div class="list-group-item px-0 py-2 d-flex justify-content-between align-items-center gap-2">${inner}</div>`;
    }).join('')}
  </div>`;
}
// Chips rendered directly inside each (now much bigger) grid cell — up to 3
// event titles, truncated, colored by type, plus a "+N" overflow marker.
function calendarCellChipsHtml(events) {
  const MAX = 3;
  const shown = events.slice(0, MAX);
  const rest = events.length - shown.length;
  if (!shown.length) return '';
  return `<div class="ios-cal-chips">
    ${shown.map((e) => `<span class="ios-cal-chip tone-${calendarEventMeta(e).tone}" title="${escapeHtml(e.title)}">${escapeHtml(e.title)}</span>`).join('')}
    ${rest > 0 ? `<span class="ios-cal-more-chip">+${rest} more</span>` : ''}
  </div>`;
}
// The bottom "Daily Agenda" panel — just ONE day's events at a time
// (defaults to today; clicking a grid cell switches it to that day instead
// of scrolling through a whole-month list — see renderCalendar's click
// handler). Tiffany tried the full "every day this month" list first, then
// asked to simplify it back down to a single day.
function calendarDayAgendaHtml(dateKey, eventsByDate, todayKey) {
  const events = eventsByDate[dateKey] || [];
  const label = new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', weekday: 'long' });
  return `
    <div class="fw-semibold mb-2">${escapeHtml(label)}${dateKey === todayKey ? ' <span class="badge badge-soft-info">Today</span>' : ''}</div>
    ${calendarAgendaListHtml(events, 'No Submit Dates, tasks, events, or holidays on this day.')}`;
}
async function renderCalendar(content) {
  const canSeeCases = canView('cases');
  const canSeeTasks = canView('tasks');
  const [cases, tasks, calEvents] = await Promise.all([
    canSeeCases ? Api.get('/api/cases') : Promise.resolve([]),
    canSeeTasks ? Api.get('/api/tasks') : Promise.resolve([]),
    Api.get('/api/calendar-events'),
  ]);

  const today = new Date();
  const todayKey = ymd(today);
  if (calendarNav.year == null) { calendarNav.year = today.getFullYear(); calendarNav.month = today.getMonth(); }
  if (!calendarSelectedDate) calendarSelectedDate = todayKey;

  const eventsByDate = {};
  const addEvent = (dateStr, ev) => {
    if (!dateStr) return;
    const key = String(dateStr).slice(0, 10);
    if (isNaN(new Date(`${key}T00:00:00`))) return;
    (eventsByDate[key] = eventsByDate[key] || []).push({ ...ev, date: key });
  };
  cases.forEach((c) => {
    if (c.deadline && c.status !== 'Closed') {
      addEvent(c.deadline, { type: 'deadline', title: `Submit: ${c.title}`, href: `#/cases/${c.id}` });
    }
    // PAGCOR Game Testing dates — added 2026-08-20 at Tiffany's request, so
    // a scheduled jackpot-game testing date shows up on the Calendar the
    // same way a case's Submit Date already does. Reads through
    // caseGamesList(c) (defined below, hoisted) rather than c.jackpotTestingDate
    // directly, since on a multi-game case that field lives per-game inside
    // c.games, not flat on the case — see caseGamesList's header comment for
    // why it normalizes both shapes the same way.
    if (c.status !== 'Closed') {
      caseGamesList(c).forEach((g) => {
        if (g.jackpotTestingDate) {
          addEvent(g.jackpotTestingDate, { type: 'gametest', title: `Game Testing: ${g.gameTitle || c.title}`, href: `#/cases/${c.id}` });
        }
      });
    }
  });
  tasks.forEach((t) => {
    if (t.dueDate && t.status !== 'Completed') {
      addEvent(t.dueDate, { type: t.isDeadlineFollowUp ? 'followup' : 'task', title: t.title, href: '#/tasks' });
    }
  });
  // Calendar events — freeform items created straight from this page
  // (meetings, personal reminders, office closures…), backed by their own
  // /api/calendar-events collection, not Task Management. href is null
  // (there's no other module page for these to link to); calendarAgendaListHtml
  // instead renders inline edit/delete icons for whoever created one.
  calEvents.forEach((e) => {
    if (e.date) addEvent(e.date, { type: 'event', title: e.title, href: null, id: e.id, note: e.note, createdBy: e.createdBy });
  });
  const { year, month } = calendarNav;
  // Pull in whichever years' Philippine holidays are actually visible in
  // this + the adjacent months (a month view can show a few days of the
  // previous/next month too) — see PH_HOLIDAYS_BY_YEAR above.
  [year, year - 1, year + 1].forEach((y) => {
    (PH_HOLIDAYS_BY_YEAR[y] || []).forEach((h) => {
      addEvent(h.date, { type: 'holiday', working: !!h.working, title: `${h.working ? '⚠️' : '🇵🇭'} ${h.name}`, href: null });
    });
  });

  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startWeekday + 1;
    let cellDate, inMonth;
    if (dayNum < 1) { cellDate = new Date(year, month - 1, daysInPrevMonth + dayNum); inMonth = false; }
    else if (dayNum > daysInMonth) { cellDate = new Date(year, month + 1, dayNum - daysInMonth); inMonth = false; }
    else { cellDate = new Date(year, month, dayNum); inMonth = true; }
    const key = ymd(cellDate);
    cells.push({ key, dayLabel: cellDate.getDate(), inMonth, isToday: key === todayKey, events: eventsByDate[key] || [] });
  }
  const monthLabel = firstOfMonth.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const upcoming7 = [];
  for (let i = 0; i < 7; i++) upcoming7.push(...(eventsByDate[addDaysToKey(todayKey, i)] || []));
  upcoming7.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // The Calendar reflects Case Management (Submit Dates) and Task
  // Management (to-dos, incl. the auto "follow up 30 days later" reminder —
  // see server/routes.js's syncDeadlineFollowUpTask()) read-only — a Case or
  // Task made in its own module already shows up here automatically via
  // the /api/cases + /api/tasks reads above, so there's no separate way to
  // create one from this page. The one thing this page DOES create
  // directly is a calendar event — something that isn't a Case or a Task at
  // all, e.g. a meeting or a personal reminder — via its own
  // /api/calendar-events collection (see calendarEventFormFields() above).
  content.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="mb-0">Calendar</h5>
      <button class="btn btn-primary btn-sm" id="btnCalNew">${Icon('plus', 'me-1')}New Event</button>
    </div>
    <div class="row g-3 mb-3">
      <div class="col-lg-6">
        <div class="card stat-card p-3 h-100">
          <div class="fw-semibold mb-2 d-flex align-items-center gap-2">${Icon('checklist')} Next 7 Days</div>
          ${calendarAgendaListHtml(upcoming7, 'No Submit Dates, tasks, events, or holidays in the next 7 days.')}
          ${!canSeeCases || !canSeeTasks ? `
          <div class="small text-secondary mt-2">
            ${!canSeeCases ? '(Your role cannot view Case Submit Dates)' : ''}${!canSeeCases && !canSeeTasks ? ' ' : ''}${!canSeeTasks ? '(Your role cannot view Tasks)' : ''}
          </div>` : ''}
        </div>
      </div>
      <div class="col-lg-6">
        <div class="card stat-card p-3 h-100" id="calDayAgendaCard">
          ${calendarDayAgendaHtml(calendarSelectedDate, eventsByDate, todayKey)}
        </div>
      </div>
    </div>
    <div class="card stat-card p-3 cal-big">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div class="d-flex align-items-center gap-1">
          <button class="btn btn-sm btn-outline-secondary" id="calPrev">${Icon('chevronLeft')}</button>
          <div class="fw-bold px-2 fs-5" style="min-width:150px;text-align:center;">${escapeHtml(monthLabel)}</div>
          <button class="btn btn-sm btn-outline-secondary" id="calNext">${Icon('chevronRight')}</button>
        </div>
        <button class="btn btn-sm btn-outline-primary" id="calToday">Today</button>
      </div>
      <div class="ios-cal-weekdays">${weekdayLabels.map((w) => `<div>${w}</div>`).join('')}</div>
      <div class="ios-cal-grid ios-cal-grid-big">
        ${cells.map((c) => `
          <div class="ios-cal-cell ${c.inMonth ? '' : 'is-outside'} ${c.isToday ? 'is-today' : ''} ${c.key === calendarSelectedDate ? 'is-selected' : ''}" data-date="${c.key}">
            <div class="ios-cal-daynum">${c.dayLabel}</div>
            ${calendarCellChipsHtml(c.events)}
          </div>`).join('')}
      </div>
    </div>`;

  content.querySelector('#calPrev').addEventListener('click', () => {
    calendarNav.month--; if (calendarNav.month < 0) { calendarNav.month = 11; calendarNav.year--; }
    renderCalendar(content);
  });
  content.querySelector('#calNext').addEventListener('click', () => {
    calendarNav.month++; if (calendarNav.month > 11) { calendarNav.month = 0; calendarNav.year++; }
    renderCalendar(content);
  });
  content.querySelector('#calToday').addEventListener('click', () => {
    calendarNav.year = today.getFullYear(); calendarNav.month = today.getMonth(); calendarSelectedDate = todayKey;
    renderCalendar(content);
  });
  content.querySelectorAll('.ios-cal-cell').forEach((cell) => cell.addEventListener('click', () => {
    calendarSelectedDate = cell.dataset.date;
    content.querySelector('#calDayAgendaCard').innerHTML = calendarDayAgendaHtml(calendarSelectedDate, eventsByDate, todayKey);
    content.querySelectorAll('.ios-cal-cell').forEach((c) => c.classList.toggle('is-selected', c.dataset.date === calendarSelectedDate));
    // The day-agenda card's own edit/delete icons were just replaced along
    // with the rest of its innerHTML above — rewire them (the 7-day panel's
    // copies, built once at full render, are untouched by this).
    wireCalEventButtons(content.querySelector('#calDayAgendaCard'), calEvents);
  }));

  const openNewEventModal = () => showFormModal({
    title: 'New Event', fields: calendarEventFormFields(), initial: { date: calendarSelectedDate },
    onSubmit: async (data) => { await Api.post('/api/calendar-events', data); toast('Event created'); route(); },
  });
  content.querySelector('#btnCalNew').addEventListener('click', () => openNewEventModal());
  wireCalEventButtons(content, calEvents);
}

// Wires up the inline edit/delete icons calendarAgendaListHtml renders for
// each calendar event the current user is allowed to touch. Called once for
// the whole page at full render, and again just for the day-agenda card
// after its own innerHTML is replaced on grid-cell click (see
// renderCalendar) — same reason every other Calendar sub-render re-binds
// its own listeners rather than relying on ones from an earlier render that
// no longer exist.
function wireCalEventButtons(container, calEvents) {
  container.querySelectorAll('.btn-cal-event-edit').forEach((btn) => btn.addEventListener('click', () => {
    const item = calEvents.find((ev) => ev.id === btn.dataset.id);
    if (!item) return;
    showFormModal({
      title: 'Edit Event', fields: calendarEventFormFields(), initial: item,
      onSubmit: async (data) => { await Api.put(`/api/calendar-events/${item.id}`, data); toast('Event updated'); route(); },
    });
  }));
  container.querySelectorAll('.btn-cal-event-del').forEach((btn) => btn.addEventListener('click', async () => {
    if (!(await confirmDialog('Delete this event?'))) return;
    await Api.del(`/api/calendar-events/${btn.dataset.id}`);
    toast('Event deleted'); route();
  }));
}

// ---------------------------------------------------------------------------
// Page: Dashboard
// ---------------------------------------------------------------------------
async function renderDashboard(content) {
  const s = await Api.get('/api/dashboard/summary');

  // The lower row is Today's To-Dos (left) next to Recently Updated
  // Cases/Pending Approvals/Follow-ups (right). Both sides are only ever
  // populated when there's actually data (each widget function returns ''
  // when empty — see todaysTasksWidgetHtml etc. below), which is common
  // day-to-day (e.g. "My Pending Tasks" is often 0). Splitting into two
  // fixed col-lg-6 halves regardless left a big empty rectangle on
  // whichever side had nothing — just moved from "cards shrink-wrapped,
  // blank flex remainder" (the col-lg-6 width bug) to "column is properly
  // 50% wide but empty". So: only split 50/50 when BOTH sides have
  // something to show; otherwise give the side that has content the full
  // row width, and skip the row entirely if neither has anything.
  const leftHtml = todaysTasksWidgetHtml(s.todaysTasks);
  const rightHtml = [
    recentlyUpdatedCasesWidgetHtml(s.recentlyUpdatedCases),
    pendingApprovalsWidgetHtml(s.pendingApprovals),
    followUpsWidgetHtml(s.followUps),
  ].join('');
  let widgetRowHtml = '';
  if (leftHtml && rightHtml) {
    widgetRowHtml = `
    <div class="row g-3">
      <div class="col-lg-6">${leftHtml}</div>
      <div class="col-lg-6">${rightHtml}</div>
    </div>`;
  } else if (leftHtml || rightHtml) {
    widgetRowHtml = `<div class="row g-3"><div class="col-lg-12">${leftHtml}${rightHtml}</div></div>`;
  }

  content.innerHTML = `
    <div class="row g-3 mb-4">
      <div class="col-md-4"><div class="card stat-card"><div class="card-body">
        <div class="stat-icon tone-indigo">${Icon('checklist')}</div>
        <div class="stat-value">${s.pendingTasksCount}</div>
        <div class="stat-label">My Pending Tasks</div>
      </div></div></div>
      <div class="col-md-4"><div class="card stat-card"><div class="card-body">
        <div class="stat-icon tone-amber">${Icon('checkSquare')}</div>
        <div class="stat-value">${s.pendingApprovalsCount}</div>
        <div class="stat-label">Pending Approvals (mine to review)</div>
      </div></div></div>
      <div class="col-md-4"><div class="card stat-card"><div class="card-body">
        <div class="stat-icon tone-rose">${Icon('clock')}</div>
        <div class="stat-value">${s.followUpsCount}</div>
        <div class="stat-label">PAGCOR Follow-ups Due (${s.followUpDays || 30}+ days)</div>
      </div></div></div>
    </div>
    ${widgetRowHtml}
    ${pagcorBoardHtml(s.pagcorBoard)}`;

  const canApprove = canDo('approvals', 'approve');
  if (canApprove) {
    content.querySelectorAll('.btn-dash-approve').forEach((btn) => btn.addEventListener('click', async () => {
      await Api.post(`/api/approvals/${btn.dataset.id}/decide`, { decision: 'approve' });
      toast('Approved'); route();
    }));
    content.querySelectorAll('.btn-dash-reject').forEach((btn) => btn.addEventListener('click', async () => {
      const comment = window.prompt('Reason for rejection (optional):') || '';
      await Api.post(`/api/approvals/${btn.dataset.id}/decide`, { decision: 'reject', comment });
      toast('Rejected'); route();
    }));
  }
}

// "Today's To-Dos" — my own not-yet-completed tasks due today or already
// overdue (see /api/dashboard/summary's todaysTasks), so the day can start
// with "what do I actually need to do" instead of opening Task Management
// and filtering by hand. Each row links straight into Task Management.
function todaysTasksWidgetHtml(todaysTasks) {
  if (!todaysTasks || !todaysTasks.length) return '';
  const todayStr = new Date().toISOString().slice(0, 10);
  return `
    <div class="mb-4">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="mb-0">Today's To-Dos</h6>
        <a href="#/tasks" class="small text-decoration-none">View all &rarr;</a>
      </div>
      <div class="card stat-card"><div class="list-group list-group-flush">
        ${todaysTasks.map((t) => `
          <a href="#/tasks" class="list-group-item d-flex justify-content-between align-items-center flex-wrap gap-2 text-decoration-none" style="color:inherit;">
            <div>
              <div class="fw-semibold">${escapeHtml(t.title)}</div>
              <div class="small text-secondary">${escapeHtml(t.status)}</div>
            </div>
            <span class="badge ${t.dueDate < todayStr ? 'badge-soft-danger' : 'badge-soft-warning'}">${t.dueDate < todayStr ? 'Overdue' : 'Due Today'}</span>
          </a>`).join('')}
      </div></div>
    </div>`;
}

// "Recently Updated Cases" — the most recently touched cases across the
// whole team, most recent first (see /api/dashboard/summary's
// recentlyUpdatedCases), so anyone can see "what's moved lately" without
// hunting through Case Management.
function recentlyUpdatedCasesWidgetHtml(recentlyUpdatedCases) {
  if (!recentlyUpdatedCases || !recentlyUpdatedCases.length) return '';
  return `
    <div class="mb-4">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="mb-0">Recently Updated Cases</h6>
        <a href="#/cases" class="small text-decoration-none">View all &rarr;</a>
      </div>
      <div class="card stat-card"><div class="list-group list-group-flush">
        ${recentlyUpdatedCases.map((c) => `
          <a href="#/cases/${c.id}" class="list-group-item d-flex justify-content-between align-items-center flex-wrap gap-2 text-decoration-none" style="color:inherit;">
            <div>
              <div class="fw-semibold">${escapeHtml(c.gameTitle || c.title)}</div>
              <div class="small text-secondary">${c.pagcorStage ? escapeHtml(c.pagcorStage) + ' · ' : ''}${fmtDate(c.updatedAt)}</div>
            </div>
          </a>`).join('')}
      </div></div>
    </div>`;
}

// (This section used to also include a "Pending Documents" dashboard widget
// driven by the PAGCOR Checklist — removed at Tiffany's request along with
// that checklist feature; see renderCaseDetail()'s Download All Documents
// gate, which now relies purely on the AI Parameter Consistency Check.)

// Approval Center no longer has its own permanent sidebar slot (see NAV) —
// this is where its pending items actually surface day-to-day now. Same
// approve/reject actions as the full Approval Center page (server does the
// same permission check either way), just without needing a whole separate
// page visit for the common case of "I have 1-2 things to decide on right
// now." "View all →" still links to the full page (#/approvals — the route
// itself was never removed, only its sidebar entry) for approval history
// or anything beyond what's pending for this person.
function pendingApprovalsWidgetHtml(pendingApprovals) {
  if (!pendingApprovals || !pendingApprovals.length) return '';
  const canApprove = canDo('approvals', 'approve');
  return `
    <div class="mt-4">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="mb-0">Pending Approvals (mine to review)</h6>
        <a href="#/approvals" class="small text-decoration-none">View all &rarr;</a>
      </div>
      <div class="card stat-card"><div class="list-group list-group-flush">
        ${pendingApprovals.map((a) => `
          <div class="list-group-item d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <div class="fw-semibold">${escapeHtml(a.title)}</div>
              <div class="small text-secondary text-capitalize">${escapeHtml(a.type)} · requested by ${escapeHtml(userName(a.requestedBy))}</div>
            </div>
            ${canApprove ? `
              <div class="d-flex gap-2">
                <button class="btn btn-sm btn-success btn-dash-approve" data-id="${a.id}">${Icon('check')} Approve</button>
                <button class="btn btn-sm btn-outline-danger btn-dash-reject" data-id="${a.id}">${Icon('x')} Reject</button>
              </div>` : `<a href="#/approvals" class="btn btn-sm btn-outline-secondary">View</a>`}
          </div>`).join('')}
      </div></div>
    </div>`;
}

// 30-day PAGCOR follow-up reminder — a game sitting in "For Review"
// or "On Process" for 30+ days with no Stage change is
// easy to lose track of when it's buried in a spreadsheet; this surfaces
// it right on the Dashboard instead. Each row links straight to that
// case's detail page (not a filtered list — these are specific games that
// need a specific person to go check on them, see server/routes.js's
// /api/dashboard/summary for how "stuck" is computed).
function followUpsWidgetHtml(followUps) {
  if (!followUps || !followUps.length) return '';
  return `
    <div class="mt-4">
      <h6 class="mb-2">PAGCOR Follow-ups Due (30+ days in stage)</h6>
      <div class="card stat-card"><div class="list-group list-group-flush">
        ${followUps.map((c) => `
          <a href="#/cases/${c.id}" class="list-group-item d-flex justify-content-between align-items-center flex-wrap gap-2 text-decoration-none" style="color:inherit;">
            <div>
              <div class="fw-semibold">${escapeHtml(c.gameTitle || c.title)}${c.provider ? ` <span class="text-secondary fw-normal">· ${escapeHtml(c.provider)}</span>` : ''}</div>
              <div class="small text-secondary">${escapeHtml(c.pagcorStage)} · not updated in ${c.daysSince} days</div>
            </div>
            <span class="badge badge-soft-danger">${c.daysSince}d</span>
          </a>`).join('')}
      </div></div>
    </div>`;
}

// PAGCOR submission pipeline overview — one horizontal bar per PAGCOR Stage,
// bar length proportional to that stage's share of the largest stage, count
// shown alongside. Clicking a row jumps to Case Management pre-filtered to
// that Stage (see /api/dashboard/summary's pagcorBoard for the per-stage
// counts computed server-side). Skipped entirely if there are no PAGCOR
// cases yet (nothing to show). Deliberately just counts, not individual
// game cards — a stage like "On Process" can hold hundreds of
// games, and this is meant to answer "how are we distributed across
// stages?" at a glance, not to browse the games themselves (that's what
// clicking through to the filtered Case Management list is for).
function pagcorBoardHtml(board) {
  if (!board || !board.some((col) => col.count > 0)) return '';
  const max = Math.max(...board.map((col) => col.count), 1);
  return `
    <div class="mt-4">
      <h6 class="mb-2">PAGCOR Submission Pipeline</h6>
      <div class="card stat-card">
        <div class="list-group list-group-flush">
          ${board.map((col) => {
            const tone = STATUS_TONE[col.stage] || 'neutral';
            const pct = Math.round((col.count / max) * 100);
            return `
            <a href="#/cases?stage=${encodeURIComponent(col.stage)}" class="list-group-item pagcor-bar-row">
              <span class="pagcor-bar-label">${escapeHtml(col.stage)}</span>
              <span class="pagcor-bar-track">
                <span class="pagcor-bar-fill tone-${tone}" style="width:${pct}%"></span>
              </span>
              <span class="pagcor-bar-count tone-${tone}">${col.count}</span>
            </a>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Generic list page builder
// ---------------------------------------------------------------------------
function listToolbar({ title, canCreate, onCreate, extraButtonsHtml }) {
  return `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="mb-0">${escapeHtml(title)}</h5>
      <div class="d-flex gap-2">
        ${extraButtonsHtml || ''}
        ${canCreate ? `<button class="btn btn-primary btn-sm" id="btnCreate">${Icon('plus', 'me-1')}New</button>` : ''}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Page: Case Management
// ---------------------------------------------------------------------------
// (This section used to also include pagcorChecklistLabel()/
// showPagcorChecklistModal() for a manually-maintained PAGCOR Checklist —
// removed at Tiffany's request once the AI Parameter Consistency Check's
// own documentCompleteness section started covering "which required
// documents are missing" automatically, making a second manual checklist
// redundant. See renderCaseDetail()'s Download All Documents gate below,
// which now relies purely on that AI check.)
// ---------------------------------------------------------------------------
// Import Excel/CSV -> bulk-create Cases (see server/import.js). Two-step:
// pick a file -> server parses + shows a per-sheet preview/settings -> user
// reviews/adjusts Provider & PAGCOR Stage per sheet -> confirm actually
// creates the records. Nothing is written until "Confirm Import" is clicked.
// ---------------------------------------------------------------------------
function importSheetSettingsHtml(sheet) {
  const needsProvider = !sheet.hasProviderColumn;
  const needsStage = !sheet.hasStatusColumn;
  const sampleNames = sheet.sampleRows.map((r) => escapeHtml(r.title)).join(', ');
  return `
    <div class="border rounded p-2 mb-2 import-sheet-row" data-sheet="${escapeHtml(sheet.name)}">
      <div class="d-flex align-items-start gap-2">
        <input type="checkbox" class="form-check-input mt-1 sheet-include" ${sheet.rowCount > 0 ? 'checked' : ''} ${sheet.rowCount === 0 ? 'disabled' : ''}>
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-center">
            <strong>${escapeHtml(sheet.name.trim() || '(Unnamed sheet)')}</strong>
            <span class="badge text-bg-light border">${sheet.rowCount} rows</span>
          </div>
          <div class="small text-secondary mt-1">${sampleNames ? `e.g. ${sampleNames}${sheet.rowCount > sheet.sampleRows.length ? '…' : ''}` : '(No importable rows detected)'}</div>
          <div class="d-flex flex-wrap gap-3 mt-2 align-items-end">
            ${needsProvider ? `
              <div>
                <label class="form-label small mb-1">Provider</label>
                <input type="text" class="form-control form-control-sm sheet-provider" value="${escapeHtml(sheet.suggestedProvider || '')}" style="width:160px;">
              </div>` : `<div class="small text-secondary">Provider column detected — will use each row's own value.</div>`}
            ${needsStage ? `
              <div>
                <label class="form-label small mb-1">PAGCOR Stage</label>
                <select class="form-select form-select-sm sheet-stage" style="width:200px;">
                  ${PAGCOR_STAGE_OPTIONS.map((s) => `<option value="${escapeHtml(s)}" ${s === 'Pending Documents' ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
                </select>
              </div>` : `<div class="small text-secondary">Status column detected — stage will be inferred per row.</div>`}
          </div>
        </div>
      </div>
    </div>`;
}

async function showImportCasesModal() {
  const modalId = 'importCasesModal';
  let modalEl = document.getElementById(modalId);
  if (modalEl) modalEl.remove();
  modalEl = document.createElement('div');
  modalEl.id = modalId;
  modalEl.className = 'modal fade';
  modalEl.tabIndex = -1;
  modalEl.innerHTML = `
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Import Excel / CSV</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label class="form-label">Choose a file (.xlsx or .csv) — each sheet/tab is detected separately</label>
            <input type="file" class="form-control" id="importFile" accept=".xlsx,.csv">
          </div>
          <div id="importAnalyzeMsg" class="small text-secondary mb-2"></div>
          <div id="importSheets"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="importConfirmBtn" style="display:none;">Confirm Import</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modalEl);
  const modal = new bootstrap.Modal(modalEl);
  modal.show();

  let fileContentBase64 = null;
  let fileName = null;

  modalEl.querySelector('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    fileName = file.name;
    fileContentBase64 = await fileToBase64(file);
    const msgEl = modalEl.querySelector('#importAnalyzeMsg');
    const sheetsEl = modalEl.querySelector('#importSheets');
    const confirmBtn = modalEl.querySelector('#importConfirmBtn');
    msgEl.textContent = 'Analyzing…';
    sheetsEl.innerHTML = '';
    confirmBtn.style.display = 'none';
    try {
      const resp = await Api.post('/api/cases/import/preview', { fileName, fileContentBase64 });
      const sheets = resp.sheets || [];
      const totalRows = sheets.reduce((sum, s) => sum + s.rowCount, 0);
      msgEl.textContent = totalRows > 0
        ? `Detected ${sheets.length} sheet(s) with ${totalRows} total row(s). Review each sheet's settings below before importing.`
        : 'No data rows detected — please check the file content.';
      sheetsEl.innerHTML = sheets.map((s) => importSheetSettingsHtml(s)).join('');
      confirmBtn.style.display = totalRows > 0 ? '' : 'none';
    } catch (err) {
      msgEl.textContent = '';
      sheetsEl.innerHTML = `<div class="text-danger small">${escapeHtml(err.message)}</div>`;
    }
  });

  modalEl.querySelector('#importConfirmBtn').addEventListener('click', async () => {
    const btn = modalEl.querySelector('#importConfirmBtn');
    const sheetEls = modalEl.querySelectorAll('.import-sheet-row');
    const sheets = Array.from(sheetEls).map((row) => {
      const providerEl = row.querySelector('.sheet-provider');
      const stageEl = row.querySelector('.sheet-stage');
      return {
        name: row.dataset.sheet,
        include: row.querySelector('.sheet-include').checked,
        provider: providerEl ? providerEl.value : undefined,
        pagcorStage: stageEl ? stageEl.value : undefined,
      };
    });
    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = 'Importing…';
    try {
      const result = await Api.post('/api/cases/import/commit', { fileName, fileContentBase64, sheets });
      modal.hide();
      const skippedMsg = result.skipped ? `, ${result.skipped} already existed (same Provider + game name) and were skipped` : '';
      const errorMsg = result.errors && result.errors.length ? `, ${result.errors.length} error(s) (see the browser console)` : '';
      const conflictMsg = result.gameIdConflicts && result.gameIdConflicts.length
        ? `; ⚠️ ${result.gameIdConflicts.length} Game ID group(s) share an ID but look like different games and were not auto-merged — see the browser console` : '';
      const gamesAdded = result.gamesAdded != null ? result.gamesAdded : result.created;
      const caseSummary = [];
      if (result.casesCreated) caseSummary.push(`${result.casesCreated} new case(s)`);
      if (result.casesUpdated) caseSummary.push(`${result.casesUpdated} existing case(s) updated`);
      const caseSummaryMsg = caseSummary.length ? ` across ${caseSummary.join(' and ')}` : '';
      toast(`Imported ${gamesAdded} game(s)${caseSummaryMsg}${skippedMsg}${errorMsg}${conflictMsg}`);
      if (result.errors && result.errors.length) console.warn('Import errors:', result.errors);
      if (result.gameIdConflicts && result.gameIdConflicts.length) console.warn('Game ID conflicts (not auto-merged):', result.gameIdConflicts);
      route();
    } catch (err) {
      toast(err.message, 'danger');
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });

  modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
}

// Shared between renderCases()'s "New"/"Edit" form modal and the case
// detail page's own "Edit" button (renderCaseDetail()) — kept as one
// top-level function so both call sites stay in sync automatically.
// PAGCOR game-detail fields (section: 'pagcor') stay collapsed behind the
// "This is a PAGCOR game submission case" toggle until checked — most cases aren't a
// PAGCOR game submission, so showing 8 game-specific fields on every single
// case form was pure clutter for them. The section auto-expands instead
// when editing a case that already has any of these fields set, or when AI
// smart-fill fills one of them in (see showFormModal's setSectionExpanded).
function caseFormFields() {
  return [
    { name: 'title', label: 'Title', required: true },
    { name: 'type', label: 'Type', type: 'select', options: ['Regulatory', 'Commercial', 'IP', 'Litigation', 'Employment', 'Other'].map((v) => ({ value: v, label: v })), required: true },
    { name: 'ownerId', label: 'Owner', type: 'select', options: State.lookups.users.map((u) => ({ value: u.id, label: u.fullName })), required: true },
    { name: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'].map((v) => ({ value: v, label: v })), required: true },
    { name: 'status', label: 'Status', type: 'select', options: ['Open', 'In Progress', 'Closed'].map((v) => ({ value: v, label: v })), required: true },
    // Label shown as "Submit Date" per Tiffany's request — this is the
    // date documents get submitted/are due, which the Calendar page's
    // 30-day follow-up reminder is computed from (see server/routes.js's
    // syncDeadlineFollowUpTask). The underlying field name stays `deadline`
    // everywhere else (form data, API, sorting, CSV export column key,
    // etc.) — only changed the label users actually see, so no data
    // migration or renamed logic is needed.
    { name: 'deadline', label: 'Submit Date', type: 'date' },
    // Added 2026-08-12 at Tiffany's request, replacing "Case #" as a column
    // in Case Management's table (see renderCases() below) — when the
    // documents for this submission actually came in from the Provider.
    // Not gated behind isPagcorCase since it's a generally useful date for
    // any case, same as Submit Date above. Populated automatically by Excel
    // import when the sheet has its own "Date Received" column (see
    // server/import.js's mapRow()), or settable by hand.
    { name: 'dateReceived', label: 'Date Received (optional)', type: 'date' },
    { name: 'isPagcorCase', label: 'This is a PAGCOR game submission case (check to show game-related fields)', type: 'checkbox', controlsSection: 'pagcor' },
    { name: 'provider', label: 'PAGCOR Provider (optional)', placeholder: 'e.g. FC, JDB, VP', section: 'pagcor' },
    { name: 'gameTitle', label: 'Game Title (optional)', section: 'pagcor' },
    { name: 'gameType', label: 'Game Type (optional)', type: 'select', allowEmpty: true, options: GAME_TYPE_OPTIONS.map((v) => ({ value: v, label: v })), section: 'pagcor' },
    { name: 'gameId', label: 'Game ID (optional)', section: 'pagcor' },
    { name: 'gameVersion', label: 'Game Version (optional)', section: 'pagcor' },
    { name: 'withJackpot', label: 'With Jackpot? (optional)', type: 'select', allowEmpty: true, options: YES_NO_OPTIONS.map((v) => ({ value: v, label: v })), section: 'pagcor' },
    // Added 2026-08-18 to track the "Jackpot games only" PAGCOR Game Testing
    // branch from Galatic Events Corp's process flowchart — a jackpot game
    // must be scheduled/tested by PAGCOR and its post-testing docs (Jackpot
    // Report, Testing Screenshots — see REPORT_TYPE_OPTIONS above) submitted
    // before PAGCOR Evaluation, whereas a non-jackpot game skips straight to
    // evaluation. Left as plain optional fields (not conditionally hidden
    // behind With Jackpot's value) since the form-field system here has no
    // value-conditional visibility — they're simply only relevant/filled in
    // when With Jackpot is Yes.
    { name: 'jackpotTestingDate', label: 'PAGCOR Game Testing Date (optional, jackpot games only)', type: 'date', section: 'pagcor' },
    { name: 'jackpotReportSubmitted', label: 'Jackpot Report Submitted? (optional)', type: 'select', allowEmpty: true, options: YES_NO_OPTIONS.map((v) => ({ value: v, label: v })), section: 'pagcor' },
    { name: 'testingScreenshotsSubmitted', label: 'Testing Screenshots Submitted? (optional)', type: 'select', allowEmpty: true, options: YES_NO_OPTIONS.map((v) => ({ value: v, label: v })), section: 'pagcor' },
    { name: 'pagcorStage', label: 'PAGCOR Stage (optional)', type: 'select', allowEmpty: true, options: PAGCOR_STAGE_OPTIONS.map((v) => ({ value: v, label: v })), section: 'pagcor' },
    // Added 2026-08-18 so a Rejected case can record why (for the "Email
    // Sent: Non-compliant, Reasons Provided" step on the flowchart) and how
    // many times this game has been submitted — the flowchart's "END (for
    // this attempt)" implies a rejected game is often resubmitted as a new
    // attempt rather than the same case just changing stage. Bump this by
    // hand when resubmitting; kept as a simple number rather than an
    // auto-incrementing/linked-case system to match how small the rest of
    // this form already is.
    { name: 'rejectionReason', label: 'Rejection Reason (optional)', type: 'textarea', section: 'pagcor' },
    { name: 'submissionAttempt', label: 'Submission Attempt # (optional, e.g. 1, 2, 3...)', section: 'pagcor' },
    { name: 'loaExpiryDate', label: 'LOA Expiry Date (optional)', type: 'date', section: 'pagcor' },
    { name: 'description', label: 'Description', type: 'textarea' },
  ];
}

// Multi-game Case create/edit modal (added 2026-08-19, at Tiffany's request
// — "多個遊戲放在同一個案子，但遊戲細節跟狀態必須分開"). Deliberately separate
// from caseFormFields()/showFormModal above rather than extending them —
// that generic single-record field-list renderer has no concept of a
// repeatable sub-section, and caseFormFields() is still used unchanged by
// the AI case-intake wizard's single-game review flow (see
// showCaseIntakeSingleReview), which this doesn't touch. A game row here
// only collects the fields that identify the game (Title/Type/ID/Version/
// With Jackpot) — PAGCOR Stage, checklist, jackpot testing sub-fields, and
// rejection info are edited per-game from the case detail page's game cards
// once the game actually exists (see renderCaseDetail), same division as
// before this change (those were never on the "New Case" form either).
function caseBaseFormFields() {
  return [
    { name: 'title', label: 'Title', required: true },
    { name: 'type', label: 'Type', type: 'select', options: ['Regulatory', 'Commercial', 'IP', 'Litigation', 'Employment', 'Other'].map((v) => ({ value: v, label: v })), required: true },
    // Owner removed from this form 2026-08-20 at Tiffany's request — it's
    // still stored on the case (defaults to whoever creates it — see
    // routes.js's onCreate for '/api/cases') and still shown/sortable as a
    // read-only column in Case Management's table (renderCases()) and on
    // the case detail page, just no longer editable from this modal. An
    // existing case's ownerId is left untouched on save since it's simply
    // absent from `data` now and store.update() only merges the fields it's
    // given (see store.js's update()).
    { name: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'].map((v) => ({ value: v, label: v })), required: true },
    { name: 'status', label: 'Status', type: 'select', options: ['Open', 'In Progress', 'Closed'].map((v) => ({ value: v, label: v })), required: true },
    { name: 'deadline', label: 'Submit Date', type: 'date' },
    { name: 'dateReceived', label: 'Date Received (optional)', type: 'date' },
    { name: 'provider', label: 'PAGCOR Provider (optional)', placeholder: 'e.g. Galatics, FC, JDB' },
    { name: 'description', label: 'Description', type: 'textarea' },
  ];
}

function caseGameRowHtml(game, idx) {
  const g = game || {};
  return `
    <div class="card mb-2 case-game-row" data-game-id="${escapeHtml(g.id || '')}">
      <div class="card-body py-2">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="small fw-semibold text-secondary">Game ${idx + 1}${g.pagcorStage ? ` — <span class="badge bg-secondary">${escapeHtml(g.pagcorStage)}</span>` : ''}</div>
          <button type="button" class="btn btn-sm btn-outline-danger btn-remove-game">Remove</button>
        </div>
        <div class="row g-2">
          <div class="col-md-6">
            <label class="small text-secondary">Game Title</label>
            <input class="form-control form-control-sm case-game-gameTitle" value="${escapeHtml(g.gameTitle || '')}">
          </div>
          <div class="col-md-3">
            <label class="small text-secondary">Game ID</label>
            <input class="form-control form-control-sm case-game-gameId" value="${escapeHtml(g.gameId || '')}">
          </div>
          <div class="col-md-3">
            <label class="small text-secondary">Game Version</label>
            <input class="form-control form-control-sm case-game-gameVersion" value="${escapeHtml(g.gameVersion || '')}">
          </div>
          <div class="col-md-4">
            <label class="small text-secondary">Game Type</label>
            <select class="form-select form-select-sm case-game-gameType">
              <option value="">—</option>
              ${GAME_TYPE_OPTIONS.map((v) => `<option value="${v}" ${v === g.gameType ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="col-md-4">
            <label class="small text-secondary">With Jackpot?</label>
            <select class="form-select form-select-sm case-game-withJackpot">
              <option value="">—</option>
              ${YES_NO_OPTIONS.map((v) => `<option value="${v}" ${v === g.withJackpot ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    </div>`;
}

function showCaseFormModal({ title, initial = {}, submitLabel = 'Save', onSubmit }) {
  const modalId = 'caseFormModal';
  let modalEl = document.getElementById(modalId);
  if (modalEl) modalEl.remove();
  modalEl = document.createElement('div');
  modalEl.id = modalId;
  modalEl.className = 'modal fade';
  modalEl.tabIndex = -1;
  const baseFields = caseBaseFormFields();
  const games = Array.isArray(initial.games) ? initial.games : [];
  const startsPagcor = !!(games.length || initial.isPagcorCase);
  modalEl.innerHTML = `
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <form id="caseFormModalForm">
          <div class="modal-header">
            <h5 class="modal-title">${escapeHtml(title)}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="row g-2 mb-2">
              ${baseFields.map((f) => `
                <div class="${f.type === 'textarea' ? 'col-12' : 'col-md-6'}">
                  <label class="form-label">${escapeHtml(f.label)}</label>
                  ${fieldInputHtml(f, initial[f.name])}
                </div>`).join('')}
            </div>
            <div class="form-check mb-2">
              <input type="checkbox" class="form-check-input" id="caseFormIsPagcor" ${startsPagcor ? 'checked' : ''}>
              <label class="form-check-label" for="caseFormIsPagcor">This is a PAGCOR game submission case (one case, one or more games)</label>
            </div>
            <div id="caseFormGamesSection" class="${startsPagcor ? '' : 'd-none'}">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <strong>Games in this case</strong>
                <button type="button" class="btn btn-sm btn-outline-primary" id="btnAddGameRow">+ Add Game</button>
              </div>
              <div id="caseFormGamesRows">${games.map((g, i) => caseGameRowHtml(g, i)).join('')}</div>
              <div class="small text-secondary" id="caseFormGamesEmptyMsg" style="${games.length ? 'display:none' : ''}">No games added yet — click "+ Add Game".</div>
            </div>
            <div id="caseFormError" class="text-danger small mt-2"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-primary">${escapeHtml(submitLabel)}</button>
          </div>
        </form>
      </div>
    </div>`;
  document.body.appendChild(modalEl);
  const modal = new bootstrap.Modal(modalEl);
  modal.show();

  const rowsEl = modalEl.querySelector('#caseFormGamesRows');
  const emptyMsg = modalEl.querySelector('#caseFormGamesEmptyMsg');
  const refreshEmptyMsg = () => { emptyMsg.style.display = rowsEl.children.length ? 'none' : ''; };
  const wireRemove = (rowEl) => rowEl.querySelector('.btn-remove-game').addEventListener('click', () => { rowEl.remove(); refreshEmptyMsg(); });
  modalEl.querySelectorAll('.case-game-row').forEach(wireRemove);
  modalEl.querySelector('#btnAddGameRow').addEventListener('click', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = caseGameRowHtml(null, rowsEl.children.length);
    const rowEl = wrap.firstElementChild;
    rowsEl.appendChild(rowEl);
    wireRemove(rowEl);
    refreshEmptyMsg();
  });
  modalEl.querySelector('#caseFormIsPagcor').addEventListener('change', (e) => {
    modalEl.querySelector('#caseFormGamesSection').classList.toggle('d-none', !e.target.checked);
  });

  modalEl.querySelector('#caseFormModalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {};
    for (const f of baseFields) {
      const el = form.elements[f.name];
      if (!el) continue;
      data[f.name] = el.value;
    }
    const isPagcor = modalEl.querySelector('#caseFormIsPagcor').checked;
    data.isPagcorCase = isPagcor;
    if (isPagcor) {
      // Merge onto each row's ORIGINAL game object (by id) rather than
      // replacing it outright — this form only exposes the identifying
      // fields (Title/ID/Version/Type/Jackpot), so a plain rebuild here
      // would silently drop every other game's pagcorStage/checklist/
      // jackpot-testing/rejection/LOA fields back to blank the moment
      // ANY game in the case was added or removed and the form saved
      // (found 2026-08-20 verifying Tiffany's Excel-imported cases —
      // adding one game to e.g. the Omniplay case would have reset all
      // 25 games, including the 10 already Approved, back to Pending
      // Documents with an empty checklist). A genuinely new row (no
      // matching original) has nothing to merge onto, so it still gets
      // the same server-side defaulting a brand-new game always got.
      const originalGamesById = new Map(games.map((g) => [g.id, g]));
      data.games = Array.from(rowsEl.querySelectorAll('.case-game-row')).map((rowEl) => {
        const existingId = rowEl.dataset.gameId;
        const original = existingId ? originalGamesById.get(existingId) : null;
        return {
          ...(original || {}),
          id: existingId || (window.crypto && crypto.randomUUID ? crypto.randomUUID() : `g_${Date.now()}_${Math.random().toString(36).slice(2)}`),
          gameTitle: rowEl.querySelector('.case-game-gameTitle').value,
          gameId: rowEl.querySelector('.case-game-gameId').value,
          gameVersion: rowEl.querySelector('.case-game-gameVersion').value,
          gameType: rowEl.querySelector('.case-game-gameType').value,
          withJackpot: rowEl.querySelector('.case-game-withJackpot').value,
        };
      });
      if (!data.games.length) {
        modalEl.querySelector('#caseFormError').textContent = 'Add at least one game, or uncheck "This is a PAGCOR game submission case".';
        return;
      }
    } else {
      data.games = [];
    }
    try {
      await onSubmit(data);
      modal.hide();
    } catch (err) {
      modalEl.querySelector('#caseFormError').textContent = err.message;
    }
  });
  modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
}

// Normalizes a case's games into one array regardless of which shape the
// record actually has: a case created/edited through showCaseFormModal
// above carries a real `item.games` array, one entry per game, each with
// its own id/pagcorStage/checklist/etc; an older case (Excel import, AI
// multi-game intake — neither rewritten yet, see notifyCaseStageChange's
// server-side comment for why) still has the flat single-game fields
// directly on the case itself. Every place that displays "this case's
// games" (case list, case detail) reads through this instead of
// `item.games` directly, so both shapes render correctly without the
// older paths needing to change at all.
function caseGamesList(item) {
  if (Array.isArray(item.games)) return item.games;
  if (item.gameTitle || item.gameId || item.pagcorStage || item.provider) {
    return [{
      id: item.id, gameTitle: item.gameTitle, gameId: item.gameId, gameVersion: item.gameVersion,
      gameType: item.gameType, withJackpot: item.withJackpot, pagcorStage: item.pagcorStage,
      pagcorStageChangedAt: item.pagcorStageChangedAt, checklist: item.checklist,
      jackpotTestingDate: item.jackpotTestingDate, jackpotReportSubmitted: item.jackpotReportSubmitted,
      testingScreenshotsSubmitted: item.testingScreenshotsSubmitted, rejectionReason: item.rejectionReason,
      submissionAttempt: item.submissionAttempt, loaExpiryDate: item.loaExpiryDate,
      _legacyFlat: true,
    }];
  }
  return [];
}

// Shared by Task Management's own "New"/"Edit" form modal, same pattern as
// caseFormFields() above. (Tasks are only ever created in Task Management
// itself — the Calendar just reflects them; see renderCalendar's doc
// comment.)
function taskFormFields() {
  return [
    { name: 'title', label: 'Title', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    // Changed 2026-08-18 from a single-select `assigneeId` to a multiselect
    // `assigneeIds`, at Tiffany's request — a task can now be given to more
    // than one person at once. `assigneeId` (first of the list) is still
    // kept in sync server-side for older code that only knows a single
    // assignee (see server/routes.js's normalizeTaskAssignees).
    { name: 'assigneeIds', label: 'Assignee(s)', type: 'multiselect', options: State.lookups.users.map((u) => ({ value: u.id, label: u.fullName })), required: true },
    { name: 'type', label: 'Type', type: 'select', options: [{ value: 'personal', label: 'Personal' }, { value: 'team', label: 'Team' }], required: true },
    { name: 'status', label: 'Status', type: 'select', options: ['To-Do', 'In Progress', 'Completed'].map((v) => ({ value: v, label: v })), required: true },
    { name: 'dueDate', label: 'Due Date', type: 'date' },
    { name: 'relatedCaseId', label: 'Related Case (optional)', type: 'select', allowEmpty: true, options: State.lookups.cases.map((c) => ({ value: c.id, label: c.caseNumber + ' - ' + c.title })) },
    { name: 'relatedContractId', label: 'Related Contract (optional)', type: 'select', allowEmpty: true, options: State.lookups.contracts.map((c) => ({ value: c.id, label: c.contractNumber + ' - ' + c.title })) },
  ];
}

// The Calendar page's own "+ New Event" button (renderCalendar) creates a
// lightweight item that's neither a Case nor a Task — a meeting, a personal
// reminder, an office closure, anything that doesn't belong in Case
// Management or Task Management. Backed by its own /api/calendar-events
// collection (server/routes.js), not tasks/cases.
function calendarEventFormFields() {
  return [
    { name: 'title', label: 'Title', required: true },
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'note', label: 'Note (optional)', type: 'textarea' },
  ];
}

// Builds the copyable "game just got its LOA" notification text from a
// case's own fields — see renderCaseDetail's #btnLoaNotice handler. Uses
// pagcorStageChangedAt (stamped whenever pagcorStage actually changes — see
// server/routes.js's cases onCreate/onUpdate) as the approval date, since
// that's precisely the moment the case last became "Approved"; falls
// back to today if that's somehow missing (e.g. a very old record).
function loaNotificationDraftText(item) {
  const lines = [
    '✅ PAGCOR LOA Approved',
    `Game: ${item.gameTitle || item.title}`,
    item.gameId ? `Game ID: ${item.gameId}` : null,
    item.provider ? `Provider: ${item.provider}` : null,
    item.gameVersion ? `Version: ${item.gameVersion}` : null,
    `Approval Date: ${fmtDate(item.pagcorStageChangedAt || new Date().toISOString())}`,
    item.loaExpiryDate ? `LOA Expiry: ${fmtDate(item.loaExpiryDate)}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

// Renders the "AI Submission Validation" result — see server/ai.js's
// checkDocumentConsistency() for the three sections this covers:
// documentCompleteness (do the required PAGCOR submission document TYPES
// exist at all), parameterValidation (does each tracked parameter have a
// value stated anywhere), and documentConsistency (for parameters that do
// have values, do all the documents that mention it agree — shown per
// source document). overallStatus ('ready'/'not_ready') drives the banner.
// Shared by every place this check can be triggered: the case detail
// page's "AI Parameter Consistency Check" button, the batch document
// upload's auto-run-after-upload, the (UI-unreachable, code-still-present)
// old intake wizard's auto-run, and Document Center's per-folder
// "AI Parameter Consistency Check" button. Only this modal's own content
// changes for the "AI Submission Validation" redesign — none of those four
// call sites' surrounding page layout is touched.
function presenceMeta(present) {
  return present
    ? { icon: '✅', label: 'Present' }
    : { icon: '❌', label: 'Missing' };
}
function consistencyStatusMeta(status) {
  if (status === 'match') return { icon: '✅', label: 'Match' };
  if (status === 'mismatch') return { icon: '⚠️', label: 'Mismatch Detected' };
  return { icon: '❔', label: 'Not Mentioned' }; // 'missing'
}
function showConsistencyResultModal(context, result) {
  const ready = result.overallStatus === 'ready';
  const documentCompleteness = result.documentCompleteness || [];
  const parameterValidation = result.parameterValidation || [];
  const documentConsistency = result.documentConsistency || [];

  const checklistSection = (label, items, getIconMeta, getName) => `
    <div class="mb-3">
      <div class="fw-semibold small text-uppercase text-secondary mb-1">${escapeHtml(label)}</div>
      <div class="list-group">
        ${items.map((it) => {
          const meta = getIconMeta(it);
          return `
          <div class="list-group-item py-2">
            <div class="d-flex justify-content-between align-items-center gap-2">
              <span class="fw-semibold">${meta.icon} ${escapeHtml(getName(it))}</span>
              <span class="small text-secondary text-nowrap">${escapeHtml(meta.label)}</span>
            </div>
            ${it.detail ? `<div class="small text-secondary mt-1">${escapeHtml(it.detail)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`;

  const consistencySection = `
    <div class="mb-2">
      <div class="fw-semibold small text-uppercase text-secondary mb-1">Document Consistency</div>
      ${documentConsistency.map((c) => {
        const meta = consistencyStatusMeta(c.status);
        const values = c.values || [];
        const isMismatch = c.status === 'mismatch';
        return `
        <div class="card mb-2 ${isMismatch ? 'border-danger' : ''}">
          <div class="card-body py-2 px-3">
            <div class="d-flex justify-content-between align-items-center gap-2 mb-1">
              <span class="fw-semibold">${escapeHtml(c.parameter)}</span>
              <span class="badge ${isMismatch ? 'bg-danger' : c.status === 'match' ? 'bg-success' : 'bg-secondary'}">${meta.icon} ${escapeHtml(meta.label)}</span>
            </div>
            ${values.length ? `
              <ul class="list-unstyled small mb-1 ${isMismatch ? 'bg-warning-subtle rounded p-2' : ''}">
                ${values.map((v) => `<li><span class="text-secondary">${escapeHtml(v.source)}:</span> <span class="fw-semibold">${escapeHtml(v.value)}</span></li>`).join('')}
              </ul>
            ` : ''}
            ${c.detail ? `<div class="small text-secondary">${escapeHtml(c.detail)}</div>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;

  showInfoModal({
    title: `AI Submission Validation${context ? ` – ${context}` : ''}`,
    size: 'modal-lg',
    bodyHtml: `
      <div class="small text-secondary mb-1">Validation Result</div>
      <div class="alert ${ready ? 'alert-success' : 'alert-danger'} py-2 px-3 mb-3">
        ${ready ? '🟢 Ready for Submission' : '🔴 Not Ready for Submission'}
      </div>
      ${checklistSection('Document Completeness', documentCompleteness, (d) => presenceMeta(d.present), (d) => d.documentType)}
      ${checklistSection('Parameter Validation', parameterValidation, (p) => presenceMeta(p.present), (p) => p.parameter)}
      ${consistencySection}
      ${result.summary ? `<p class="small text-secondary mb-2">${escapeHtml(result.summary)}</p>` : ''}
      <p class="small text-secondary mb-0">Compared ${result.documentsCompared || 0} document(s). This is an AI-generated pre-submission check based on document content, for reference only — it is not an official compliance determination; the original documents remain authoritative.</p>
    `,
  });
}

// Full-page, read/write case + game detail view — reached by clicking a row
// in Case Management (see attachRowHandlers() below), routed via
// "#/cases/<id>" (see the route() dispatcher's cases-with-id branch).
// Originally this was a modal, but with every game-specific field plus the
// PAGCOR Checklist shown at once it felt cramped in a dialog, so it's a
// real page instead — same pattern as every other module's list page, just
// for a single record.
async function renderCaseDetail(content, id) {
  let item;
  try {
    item = await Api.get(`/api/cases/${id}`);
  } catch (err) {
    content.innerHTML = `<div class="alert alert-danger">Failed to load case: ${escapeHtml(err.message)}</div>`;
    return;
  }
  const canEdit = canDo('cases', 'edit');
  const canDelete = canDo('cases', 'delete');
  const canUploadDocs = canDo('documents', 'create');
  // No server-side "documents for this case" filter exists (same as
  // check-consistency's own lookup below) — fetch everything and filter
  // client-side by relatedCaseId. Fine at this app's scale; see
  // /api/cases/:id/check-consistency in server/routes.js for the same
  // pattern server-side.
  const relatedDocs = canDo('documents', 'view') ? (await Api.get('/api/documents')).filter((d) => d.relatedCaseId === item.id) : [];

  // Gate for the "Download All Documents" button below — mirrors
  // GET /api/cases/:id/download-all's own gate in server/routes.js exactly
  // (the last AI Parameter Consistency Check came back "ready" for the
  // CURRENT set of related documents), so the button's enabled/disabled
  // state never disagrees with what clicking it will actually do. The
  // server re-checks this itself too — this is purely so the button can
  // explain *why* it's disabled instead of the person having to click it
  // and read a toast. (This gate used to also require a separate
  // manually-maintained PAGCOR Checklist to be fully checked off — removed
  // at Tiffany's request since the AI check's own documentCompleteness
  // section already covers "what's missing".)
  const filedDocs = relatedDocs.filter((d) => d.filePath);
  const isMultiGameCase = Array.isArray(item.games);
  function isCheckStaleClient(check, docs) {
    if (!check || !Array.isArray(check.documentIds)) return true;
    const currentIds = docs.map((d) => d.id).sort();
    const lastIds = [...check.documentIds].sort();
    if (currentIds.length !== lastIds.length) return true;
    return currentIds.some((docId, i) => docId !== lastIds[i]);
  }
  function docsForGameClient(docs, game) {
    if (!game) return [];
    const byId = game.id ? docs.filter((d) => d.relatedGameId === game.id) : [];
    if (byId.length) return byId;
    const gt = ((game && game.gameTitle) || '').trim().toLowerCase();
    if (!gt) return [];
    return docs.filter((d) => !d.relatedGameId && (d.gameTitle || '').trim().toLowerCase() === gt);
  }
  let downloadReady = false;
  let downloadDisabledReason = '';
  if (!filedDocs.length) {
    downloadDisabledReason = 'Upload at least one document before downloading.';
  } else if (isMultiGameCase) {
    // Ready only once every game with 2+ filed docs has its own passed,
    // non-stale check — mirrors caseDownloadGateStatus in server/routes.js.
    const blockedGame = (item.games || []).find((g) => {
      const gDocs = docsForGameClient(filedDocs, g);
      if (gDocs.length < 2) return false;
      return !g.lastConsistencyCheck || g.lastConsistencyCheck.overallStatus !== 'ready' || isCheckStaleClient(g.lastConsistencyCheck, gDocs);
    });
    if (blockedGame) {
      downloadDisabledReason = `Run the AI Parameter Consistency Check for game "${blockedGame.gameTitle || '(untitled game)'}" and confirm no anomalies before downloading.`;
    } else {
      downloadReady = true;
    }
  } else {
    const lastCheck = item.lastConsistencyCheck;
    const consistencyPassed = !!lastCheck && lastCheck.overallStatus === 'ready';
    const consistencyStale = isCheckStaleClient(lastCheck, filedDocs);
    downloadReady = consistencyPassed && !consistencyStale;
    if (!downloadReady) downloadDisabledReason = 'Run the AI Parameter Consistency Check above and confirm no anomalies before downloading.';
  }

  const field = (label, value) => `
    <div class="col-6 col-md-3 mb-3">
      <div class="small text-secondary">${escapeHtml(label)}</div>
      <div class="fw-semibold">${value === undefined || value === null || value === '' ? '<span class="text-secondary">—</span>' : escapeHtml(String(value))}</div>
    </div>`;
  // Multi-game case (added 2026-08-19 — see caseGamesList's header comment):
  // `games` is one entry per game under this case, each with its own
  // PAGCOR Stage/checklist/jackpot fields, normalized so this renders the
  // same whether `item` is a brand-new multi-game case or an older
  // single-game case (Excel import / AI intake) that still has those fields
  // flat on the case itself.
  const games = caseGamesList(item);
  const approvedGame = games.find((g) => g.pagcorStage === 'Approved');
  const gameCardHtml = (g, idx) => `
    <div class="card mb-3 case-game-card" data-game-id="${escapeHtml(g.id || '')}" data-legacy-flat="${g._legacyFlat ? '1' : '0'}">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
          <h6 class="mb-0">${escapeHtml(g.gameTitle || `Game ${idx + 1}`)}</h6>
          ${isMultiGameCase && item.provider ? `<button class="btn btn-outline-secondary btn-sm btn-check-game-consistency" data-game-id="${escapeHtml(g.id || '')}">${Icon('sparkle', 'me-1')}AI Parameter Consistency Check</button>` : ''}
        </div>
        ${g.reskinOf ? `<div class="badge bg-info-subtle text-info-emphasis mb-2">Reskin of already-approved game: ${escapeHtml(g.reskinOf)}</div>` : ''}
        <div class="small text-secondary mb-2">PAGCOR Review Progress${canEdit && g.pagcorStage !== 'Rejected' ? ' — click a stage to switch to it directly' : ''}</div>
        ${pagcorStageStepperHtml(g.pagcorStage, canEdit, g.withJackpot)}
        <div class="row mt-3">
          ${field('Game ID', g.gameId)}
          ${field('Game Type', g.gameType)}
          ${field('Game Version', g.gameVersion)}
          ${field('With Jackpot', g.withJackpot)}
          ${g.withJackpot === 'Yes' ? field('PAGCOR Game Testing Date', fmtDate(g.jackpotTestingDate)) : ''}
          ${g.withJackpot === 'Yes' ? field('Jackpot Report Submitted', g.jackpotReportSubmitted) : ''}
          ${g.withJackpot === 'Yes' ? field('Testing Screenshots Submitted', g.testingScreenshotsSubmitted) : ''}
          ${field('LOA Expiry Date', fmtDate(g.loaExpiryDate))}
          ${g.pagcorStage === 'Rejected' ? field('Submission Attempt #', g.submissionAttempt) : ''}
        </div>
        ${g.withJackpot === 'Yes' && canEdit ? `
        <div class="mt-1">
          <button type="button" class="btn btn-outline-secondary btn-sm btn-edit-jackpot-testing" data-game-id="${escapeHtml(g.id || '')}" data-legacy-flat="${g._legacyFlat ? '1' : '0'}">${Icon('edit', 'me-1')}Edit Game Testing Info</button>
        </div>` : ''}
        ${g.pagcorStage === 'Rejected' && g.rejectionReason ? `<div class="mt-2"><div class="small text-secondary">Rejection Reason</div><div>${escapeHtml(g.rejectionReason)}</div></div>` : ''}
        ${PAGCOR_CHECKLIST_ITEMS.length ? `
        <div class="mt-3">
          <h6 class="mb-2" style="font-size:1rem;">PAGCOR Checklist ${checklistBadgeHtml(g.checklist)}</h6>
          ${PAGCOR_CHECKLIST_ITEMS.map((i) => `
            <div class="form-check mb-2">
              <input class="form-check-input checklist-item" type="checkbox" id="checklist-${g.id}-${i.key}" data-game-id="${escapeHtml(g.id || '')}" data-legacy-flat="${g._legacyFlat ? '1' : '0'}" data-key="${i.key}" ${g.checklist && g.checklist[i.key] ? 'checked' : ''} ${canEdit ? '' : 'disabled'}>
              <label class="form-check-label" for="checklist-${g.id}-${i.key}">${escapeHtml(i.label)}</label>
            </div>`).join('')}
        </div>` : ''}
      </div>
    </div>`;
  content.innerHTML = `
    <div class="mb-3"><a href="#/cases" class="small text-decoration-none">&larr; Back to Case Management</a></div>
    <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3 case-detail-header-row">
      <div>
        <h4 class="mb-0">${escapeHtml(item.caseNumber)}</h4>
        <div class="text-secondary">${escapeHtml(item.title)}</div>
      </div>
      <div class="d-flex gap-2 case-header-actions">
        ${canUploadDocs ? `<button class="btn btn-outline-secondary btn-sm" id="btnUploadCaseDocs">${Icon('upload', 'me-1')}Upload Documents</button>` : ''}
        ${!isMultiGameCase && item.provider ? `<button class="btn btn-outline-secondary btn-sm" id="btnCheckConsistency">${Icon('sparkle', 'me-1')}AI Parameter Consistency Check</button>` : ''}
        ${canDo('documents', 'view') && filedDocs.length ? `<button class="btn ${downloadReady ? 'btn-primary' : 'btn-outline-secondary'} btn-sm" id="btnDownloadAll" ${downloadReady ? '' : 'disabled'} title="${escapeHtml(downloadReady ? 'Download all of this case\'s documents as a .zip' : downloadDisabledReason)}">${Icon('download', 'me-1')}Download All Documents</button>` : ''}
        ${approvedGame ? `<button class="btn btn-outline-primary btn-sm" id="btnLoaNotice">${Icon('bell', 'me-1')}Approval Notice Draft</button>` : ''}
        ${canEdit ? `<button class="btn btn-outline-secondary btn-sm" id="btnEditCase">${Icon('edit', 'me-1')}Edit</button>` : ''}
        ${canDelete ? `<button class="btn btn-outline-danger btn-sm" id="btnDeleteCase">${Icon('trash', 'me-1')}Delete</button>` : ''}
      </div>
    </div>
    <div class="card mb-3"><div class="card-body">
      <div class="row">
        ${field('Provider', item.provider)}
        ${field('Type', item.type)}
        ${field('Owner', userName(item.ownerId))}
        ${field('Priority', item.priority)}
        ${field('Status', item.status)}
        ${field('Submit Date', fmtDate(item.deadline))}
      </div>
      ${item.description ? `<div class="mt-2"><div class="small text-secondary">Description</div><div>${escapeHtml(item.description)}</div></div>` : ''}
    </div></div>
    ${games.length ? `
    <h6 class="mb-2">Games in this case ${games.length > 1 ? `<span class="badge text-bg-light border">${games.length}</span>` : ''}</h6>
    ${games.map((g, i) => gameCardHtml(g, i)).join('')}
    ` : ''}
    ${canDo('documents', 'view') ? `
    <div class="card mt-3"><div class="card-body">
      <h6 class="mb-2">Uploaded Documents${relatedDocs.length ? ` <span class="badge text-bg-light border">${relatedDocs.length}</span>` : ''}</h6>
      ${relatedDocs.length ? `
      <div class="list-group list-group-flush">
        ${relatedDocs.map((d) => `
          <div class="list-group-item d-flex justify-content-between align-items-center px-0">
            <div>
              <div>${escapeHtml(d.title)}</div>
              <div class="small text-secondary">${escapeHtml(userName(d.uploadedBy))} · ${fmtDate(d.createdAt)}</div>
            </div>
            ${d.filePath ? `
              <div class="btn-group">
                <button type="button" class="btn btn-sm btn-outline-secondary btn-preview-doc" data-id="${d.id}" title="Preview">${Icon('eye')}</button>
                <button type="button" class="btn btn-sm btn-outline-secondary btn-download-doc" data-id="${d.id}" data-filename="${escapeHtml(d.fileName || 'file')}" title="Download">${Icon('download')}</button>
              </div>` : ''}
          </div>`).join('')}
      </div>` : `<div class="small text-secondary">No documents linked to this case yet${canUploadDocs ? ' — click "Upload Documents" above to get started.' : '.'}</div>`}
    </div></div>` : ''}`;

  content.querySelectorAll('.btn-download-doc').forEach((btn) => btn.addEventListener('click', () => {
    downloadAuthedFile(`/api/documents/${btn.dataset.id}/download`, btn.dataset.filename);
  }));
  content.querySelectorAll('.btn-preview-doc').forEach((btn) => btn.addEventListener('click', () => {
    previewAuthedFile(`/api/documents/${btn.dataset.id}/download`);
  }));

  const uploadDocsBtn = content.querySelector('#btnUploadCaseDocs');
  if (uploadDocsBtn) uploadDocsBtn.addEventListener('click', () => showCaseDocumentUploadModal(item, relatedDocs));

  // Only ever enabled (see downloadReady above) once every document is
  // uploaded and the AI Parameter Consistency Check has passed for the
  // current documents — the server re-verifies all of that itself in
  // GET /api/cases/:id/download-all and returns a JSON {error} otherwise,
  // which downloadAuthedFile() already surfaces as a toast.
  const downloadAllBtn = content.querySelector('#btnDownloadAll');
  if (downloadAllBtn) downloadAllBtn.addEventListener('click', () => {
    downloadAuthedFile(`/api/cases/${item.id}/download-all`, `${item.caseNumber || item.id} - ${item.title || item.gameTitle || 'Case'}.zip`);
  });

  // Clicking a step on the PAGCOR Review Progress stepper jumps straight to
  // that stage — no need to open the Edit form just to change one field.
  // Only rendered on steps other than the current one (see
  // pagcorStageStepperHtml()), so every click is a real change. Re-renders
  // the whole detail page afterward so the stepper, and anything else that
  // depends on pagcorStage, stays in sync.
  // Patches ONE game's fields within `item.games` and PUTs the whole case
  // — except a legacy flat single-game case (Excel import / AI intake,
  // no real `games` array — see caseGamesList), which still PUTs the flat
  // field directly, exactly as before this change, so those older cases
  // keep working unchanged.
  const patchOneGame = (gameId, isLegacyFlat, fieldPatch) => {
    if (isLegacyFlat) return Api.put(`/api/cases/${item.id}`, fieldPatch);
    const newGames = (item.games || []).map((g) => (g.id === gameId ? { ...g, ...fieldPatch } : g));
    return Api.put(`/api/cases/${item.id}`, { games: newGames });
  };

  content.querySelectorAll('.pagcor-step-clickable').forEach((stepEl) => stepEl.addEventListener('click', async () => {
    const newStage = stepEl.dataset.stage;
    const cardEl = stepEl.closest('.case-game-card');
    const gameId = cardEl ? cardEl.dataset.gameId : null;
    const isLegacyFlat = cardEl ? cardEl.dataset.legacyFlat === '1' : true;
    try {
      await patchOneGame(gameId, isLegacyFlat, { pagcorStage: newStage });
      toast(`PAGCOR Stage updated to "${newStage}"`);
      await renderCaseDetail(content, id);
    } catch (err) {
      toast(err.message, 'danger');
    }
  }));

  // Inline PAGCOR Checklist panel (inside each game's card) — each
  // checkbox saves and re-renders immediately, same pattern as the stepper
  // clicks above, so the X/3 badge in the heading always reflects what's
  // actually saved rather than pending, unconfirmed local state.
  content.querySelectorAll('.checklist-item').forEach((cb) => cb.addEventListener('change', async () => {
    const gameId = cb.dataset.gameId;
    const isLegacyFlat = cb.dataset.legacyFlat === '1';
    const scoped = Array.from(content.querySelectorAll(`.checklist-item[data-game-id="${gameId}"]`));
    const currentGame = games.find((g) => g.id === gameId) || {};
    const newChecklist = { ...(currentGame.checklist || {}) };
    scoped.forEach((el) => { newChecklist[el.dataset.key] = el.checked; });
    scoped.forEach((el) => { el.disabled = true; });
    try {
      await patchOneGame(gameId, isLegacyFlat, { checklist: newChecklist });
      toast('Checklist updated');
      await renderCaseDetail(content, id);
    } catch (err) {
      toast(err.message, 'danger');
      scoped.forEach((el) => { el.disabled = false; });
    }
  }));

  // "Edit Game Testing Info" button on each jackpot game's card — opens
  // showJackpotTestingModal() and saves through the same patchOneGame()
  // helper used by the stepper/checklist above (added 2026-08-20).
  content.querySelectorAll('.btn-edit-jackpot-testing').forEach((btn) => btn.addEventListener('click', () => {
    const gameId = btn.dataset.gameId;
    const isLegacyFlat = btn.dataset.legacyFlat === '1';
    const currentGame = games.find((g) => g.id === gameId) || {};
    showJackpotTestingModal(currentGame, async (fieldPatch) => {
      await patchOneGame(gameId, isLegacyFlat, fieldPatch);
      toast('Game Testing info updated');
      await renderCaseDetail(content, id);
    });
  }));

  // AI cross-document parameter consistency check — checks a fixed 5-item
  // checklist (Game ID / Game Manual / Game Version / Minimum Bet / Maximum
  // Bet) across every Document Center file whose "Related Case" points to
  // this case. See server/ai.js's checkDocumentConsistency and
  // showConsistencyResultModal() below (shared with the Case intake
  // wizard's auto-run version in renderCases()).
  const consistencyBtn = content.querySelector('#btnCheckConsistency');
  if (consistencyBtn) consistencyBtn.addEventListener('click', async () => {
    const originalHtml = consistencyBtn.innerHTML;
    consistencyBtn.disabled = true;
    consistencyBtn.innerHTML = '…';
    try {
      const result = await Api.post(`/api/cases/${item.id}/check-consistency`, {});
      showConsistencyResultModal(item.title, result);
      // The server just persisted this result as the case's
      // lastConsistencyCheck (see server/routes.js) — re-render so the
      // "Download All Documents" gate above picks up the fresh result
      // immediately instead of only after leaving and returning to the page.
      await renderCaseDetail(content, id);
    } catch (err) {
      toast(err.message, 'danger');
    } finally {
      consistencyBtn.disabled = false;
      consistencyBtn.innerHTML = originalHtml;
    }
  });

  // Same AI check as the button above, but scoped to one game inside a
  // multi-game case (see the per-game button in gameCardHtml) — documents
  // from different games under the same Provider case must never be
  // compared to each other, so this always passes gameId (see
  // POST /api/cases/:id/check-consistency in server/routes.js).
  content.querySelectorAll('.btn-check-game-consistency').forEach((btn) => btn.addEventListener('click', async () => {
    const gameId = btn.dataset.gameId;
    const game = games.find((g) => g.id === gameId);
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '…';
    try {
      const result = await Api.post(`/api/cases/${item.id}/check-consistency`, { gameId });
      showConsistencyResultModal((game && game.gameTitle) || item.title, result);
      await renderCaseDetail(content, id);
    } catch (err) {
      toast(err.message, 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }));

  // LOA-approval notification draft — legal's real pain point here was
  // manually re-typing (game title, Game ID, approval date, etc.) into a
  // Telegram message every time a game gets its LOA, which is slow and
  // error-prone. This just assembles that same text from the case's own
  // fields so it can be copied straight into whatever chat app they use.
  // Deliberately does NOT send anything itself (see loaNotificationDraftText
  // below / the safety-protocol boundary on sending messages on someone's
  // behalf) — it only prepares text for the person to paste and send
  // themselves.
  const loaNoticeBtn = content.querySelector('#btnLoaNotice');
  if (loaNoticeBtn) loaNoticeBtn.addEventListener('click', () => {
    const text = loaNotificationDraftText({ ...item, ...approvedGame });
    showInfoModal({
      title: 'Approval Notice Draft',
      bodyHtml: `
        <p class="small text-secondary mb-2">Copy this and paste it into Telegram or another channel yourself — the system does not send it automatically.</p>
        <textarea class="form-control" id="loaNoticeText" rows="7" readonly>${escapeHtml(text)}</textarea>
        <button type="button" class="btn btn-primary btn-sm mt-2" id="btnCopyLoaNotice">${Icon('check', 'me-1')}Copy Text</button>
      `,
    });
    const copyBtn = document.getElementById('btnCopyLoaNotice');
    if (copyBtn) copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
        toast('Copied to clipboard');
      } catch (err) {
        const ta = document.getElementById('loaNoticeText');
        if (ta) { ta.focus(); ta.select(); }
        toast('Could not copy automatically — the text has been selected for you, press Cmd/Ctrl+C to copy', 'danger');
      }
    });
  });

  const editBtn = content.querySelector('#btnEditCase');
  if (editBtn) editBtn.addEventListener('click', () => {
    showCaseFormModal({
      title: 'Edit Case', initial: item, submitLabel: 'Save',
      onSubmit: async (data) => { await Api.put(`/api/cases/${item.id}`, data); toast('Case updated'); route(); },
    });
  });
  const delBtn = content.querySelector('#btnDeleteCase');
  if (delBtn) delBtn.addEventListener('click', async () => {
    if (!(await confirmDialog('Delete this case?'))) return;
    await Api.del(`/api/cases/${item.id}`);
    toast('Case deleted');
    location.hash = '#/cases';
  });
}

// Batch document upload from a case's own detail page — reduces the
// repetitive "upload one, fill in fields, upload the next" work of adding documents to a
// case one at a time. Select multiple files at once; since this case
// already has a known Provider/Game Title/Game ID, there's nothing
// ambiguous about *where* each file belongs (unlike the old AI-creates-
// the-case flow this replaces) — AI only has to guess each file's own
// Title/Category/Report Type, which is shown in an editable row per file
// for review before anything is saved. Uploaded files are tagged with this
// case's relatedCaseId/provider/gameTitle/gameId, so they land in the
// right Document Center tab+game automatically — no separate filing step.
// Once the target game has 2+ documents with files, the same AI consistency
// check as the case detail page's own button auto-runs afterward.
// `relatedDocs` is every document already linked to this case (not just a
// count — Phase 2 needs the actual rows to work out how many already belong
// to whichever game gets picked below, see gameDocCount()).
function showCaseDocumentUploadModal(item, relatedDocs) {
  const games = caseGamesList(item);
  const isMultiGameCase = Array.isArray(item.games);
  const modalId = 'caseUploadModal';
  let modalEl = document.getElementById(modalId);
  if (modalEl) modalEl.remove();
  modalEl = document.createElement('div');
  modalEl.id = modalId;
  modalEl.className = 'modal fade';
  modalEl.tabIndex = -1;
  modalEl.innerHTML = `
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">${sparkleMark('me-1')} Upload Documents — ${escapeHtml(item.gameTitle || item.title)}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <p class="small text-secondary">You can select multiple files at once. Provider / Game Title / Game ID are filled in automatically from this case — AI only needs to guess each file's Title / Category / Report Type, which you can edit before saving.</p>
          ${isMultiGameCase && games.length > 1 ? `
          <div class="mb-3">
            <label class="small text-secondary d-block">Which game(s) are these documents for? Check every game this batch applies to — a document that covers multiple games (e.g. one RTP certificate listing several titles) gets linked to each game you check, so it shows up under all of them. Nothing is checked by default; pick at least one before uploading, even if it's just the one game.</label>
            <div class="form-check form-check-inline border-end pe-2 me-2">
              <input class="form-check-input" type="checkbox" id="caseUploadGameAll">
              <label class="form-check-label small fw-semibold" for="caseUploadGameAll">All</label>
            </div>
            ${games.map((g) => `
            <div class="form-check form-check-inline">
              <input class="form-check-input case-upload-game-check" type="checkbox" value="${escapeHtml(g.id || '')}" id="caseUploadGame_${escapeHtml(g.id || '')}">
              <label class="form-check-label small" for="caseUploadGame_${escapeHtml(g.id || '')}">${escapeHtml(g.gameTitle || '(untitled game)')}</label>
            </div>`).join('')}
          </div>` : ''}
          <input type="file" class="form-control mb-3" id="caseUploadFiles" multiple>
          <div id="caseUploadRows"></div>
          <div id="caseUploadMsg" class="small text-danger"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="btnCaseUploadAll" disabled>Upload Selected Documents</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modalEl);
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
  modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());

  let filesData = []; // [{ file, base64, proposed: {title,category,reportType}, aiFailed }]
  const rowsEl = modalEl.querySelector('#caseUploadRows');
  const uploadBtn = modalEl.querySelector('#btnCaseUploadAll');
  // Multi-game game-picker is now a checklist (see the HTML above), not a
  // single <select> — nothing is checked by default, so the upload button
  // also has to stay disabled until at least one game is picked (in
  // addition to the existing "at least one file chosen" requirement).
  const gameCheckEls = () => Array.from(modalEl.querySelectorAll('.case-upload-game-check'));
  const hasGameSelected = () => !isMultiGameCase || games.length <= 1 || gameCheckEls().some((c) => c.checked);
  const updateUploadBtnState = () => { uploadBtn.disabled = filesData.length === 0 || !hasGameSelected(); };
  // "All" checkbox — a shortcut for checking every game at once rather than
  // clicking each one individually (added 2026-08-20 at Tiffany's request,
  // useful for cases with dozens of games like the Excel-imported ones).
  // It's a plain toggle when clicked directly; it also reflects the
  // individual boxes' combined state (all/none/some checked) so it never
  // shows checked when a game was unchecked by hand — using indeterminate
  // for the "some but not all" case rather than silently picking a side.
  const allCheckEl = modalEl.querySelector('#caseUploadGameAll');
  const syncAllCheckbox = () => {
    if (!allCheckEl) return;
    const boxes = gameCheckEls();
    const checkedCount = boxes.filter((c) => c.checked).length;
    allCheckEl.checked = boxes.length > 0 && checkedCount === boxes.length;
    allCheckEl.indeterminate = checkedCount > 0 && checkedCount < boxes.length;
  };
  gameCheckEls().forEach((c) => c.addEventListener('change', () => { syncAllCheckbox(); updateUploadBtnState(); }));
  if (allCheckEl) {
    allCheckEl.addEventListener('change', () => {
      gameCheckEls().forEach((c) => { c.checked = allCheckEl.checked; });
      allCheckEl.indeterminate = false;
      updateUploadBtnState();
    });
  }

  const renderRows = () => {
    rowsEl.innerHTML = filesData.map((f, i) => `
      <div class="card mb-2 upload-file-row" data-index="${i}">
        <div class="card-body py-2">
          <div class="d-flex align-items-start gap-2">
            <input type="checkbox" class="form-check-input mt-2 upload-file-include" checked>
            <div class="flex-grow-1 row g-2">
              <div class="col-md-5">
                <label class="small text-secondary">Title</label>
                <input class="form-control form-control-sm upload-file-title" value="${escapeHtml(f.proposed.title || f.file.name)}">
              </div>
              <div class="col-md-3">
                <label class="small text-secondary">Category</label>
                <select class="form-select form-select-sm upload-file-category">
                  ${['Templates', 'Policies', 'Agreements', 'Certificates', 'Other'].map((v) => `<option value="${v}" ${v === (f.proposed.category || 'Certificates') ? 'selected' : ''}>${v}</option>`).join('')}
                </select>
              </div>
              <div class="col-md-4">
                <label class="small text-secondary">Report Type</label>
                <select class="form-select form-select-sm upload-file-reportType">
                  <option value="">—</option>
                  ${REPORT_TYPE_OPTIONS.map((v) => `<option value="${v}" ${v === f.proposed.reportType ? 'selected' : ''}>${v}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>
          <div class="small text-secondary mt-1 ms-4">${escapeHtml(f.file.name)}${f.aiFailed ? ' — AI could not read this file\'s content, please double-check the category yourself' : ''}</div>
        </div>
      </div>`).join('');
    updateUploadBtnState();
  };

  // A native <input type="file"> replaces its entire .files FileList on every
  // picker interaction — it's not additive. Re-opening the picker to browse
  // to another folder for more of the same game's documents used to wipe out
  // whatever was already selected (Tiffany: "如果我跳到另一個檔案頁面 原本選取的會不見").
  // Fix: accumulate onto the existing filesData instead of replacing it, only
  // running the AI extraction on newly-added files, and skip files that look
  // like exact re-picks (same name+size already staged) so re-selecting the
  // same file twice doesn't create a duplicate row.
  modalEl.querySelector('#caseUploadFiles').addEventListener('change', async (e) => {
    const picked = Array.from(e.target.files || []);
    const newFiles = picked.filter((file) => !filesData.some((f) => f.file.name === file.name && f.file.size === file.size));
    // Reset the input now so the same filename can be picked again later
    // (some browsers no-op a 'change' event if the resulting FileList would
    // look identical to the previous one) and so `picked` above isn't reused.
    e.target.value = '';
    if (!newFiles.length) return;
    uploadBtn.disabled = true;
    const loadingEl = document.createElement('div');
    loadingEl.className = 'small text-secondary';
    loadingEl.textContent = `AI reading ${newFiles.length} document(s)…`;
    rowsEl.appendChild(loadingEl);
    const newFilesData = await Promise.all(newFiles.map(async (file) => {
      const base64 = await fileToBase64(file);
      let proposed = {};
      let aiFailed = false;
      try {
        const { fields: extracted } = await Api.post('/api/ai/extract/documents', { fileName: file.name, fileContentBase64: base64 });
        proposed = extracted || {};
      } catch (err) {
        aiFailed = true;
      }
      return { file, base64, proposed, aiFailed };
    }));
    filesData = filesData.concat(newFilesData);
    renderRows();
  });

  uploadBtn.addEventListener('click', async () => {
    const msgEl = modalEl.querySelector('#caseUploadMsg');
    msgEl.textContent = '';
    const rows = Array.from(modalEl.querySelectorAll('.upload-file-row'))
      .filter((row) => row.querySelector('.upload-file-include').checked)
      .map((row) => {
        const i = Number(row.dataset.index);
        return {
          file: filesData[i].file, base64: filesData[i].base64,
          title: row.querySelector('.upload-file-title').value.trim(),
          category: row.querySelector('.upload-file-category').value,
          reportType: row.querySelector('.upload-file-reportType').value || undefined,
        };
      });
    if (!rows.length) { msgEl.textContent = 'Please select at least one document.'; return; }

    // Which game(s) these documents get stamped with. Multi-game case with
    // more than one game: every checked box in the game-picker (a document
    // covering several games is uploaded once per game it applies to, so
    // each game's own document list — and its own AI consistency check —
    // sees it). Single-game / legacy case: just that one game, no picker
    // shown at all.
    const selectedGames = (isMultiGameCase && games.length > 1)
      ? gameCheckEls().filter((c) => c.checked).map((c) => games.find((g) => g.id === c.value)).filter(Boolean)
      : [games[0] || {}];
    if (!selectedGames.length) { msgEl.textContent = 'Please select at least one game.'; return; }

    uploadBtn.disabled = true;
    const perGameUploaded = new Map(); // game (object identity) -> count of files uploaded successfully this batch
    const totalSteps = rows.length * selectedGames.length;
    let step = 0;
    for (const selectedGame of selectedGames) {
      perGameUploaded.set(selectedGame, 0);
      for (let i = 0; i < rows.length; i++) {
        step++;
        uploadBtn.innerHTML = `Uploading… (${step}/${totalSteps})`;
        try {
          await Api.post('/api/documents', {
            title: rows[i].title || rows[i].file.name, category: rows[i].category, reportType: rows[i].reportType,
            provider: item.provider, gameTitle: selectedGame.gameTitle, gameId: selectedGame.gameId,
            relatedCaseId: item.id,
            // Stable link to this specific game (not just its title) — see
            // docsForGame in server/routes.js for why this is preferred over
            // matching by gameTitle text. Legacy flat cases have no real game
            // id of their own to link to, so this is left unset for them.
            relatedGameId: isMultiGameCase ? selectedGame.id : undefined,
            fileName: rows[i].file.name, fileContentBase64: rows[i].base64,
          });
          perGameUploaded.set(selectedGame, perGameUploaded.get(selectedGame) + 1);
        } catch (err) {
          toast(`Failed to upload "${rows[i].file.name}"${selectedGames.length > 1 ? ` for "${selectedGame.gameTitle || item.title}"` : ''}: ${err.message}`, 'danger');
        }
      }
    }
    modal.hide();
    const uploadedCount = Array.from(perGameUploaded.values()).reduce((a, b) => a + b, 0);
    if (!uploadedCount) return;
    toast(`Uploaded ${uploadedCount}/${totalSteps} document(s)`);

    // Auto-run the AI consistency check for every game that just crossed
    // (or already had) 2+ filed documents. With exactly one game selected
    // this is unchanged from before — the full result opens in a modal.
    // With several games selected, popping one full-screen modal per game
    // back-to-back would just have each replace the last before anyone
    // could read it, so instead the checks still run and save (each game's
    // own "AI Parameter Consistency Check" button on the case page shows
    // its full result on demand), and a single toast summarizes pass/fail
    // per game here.
    const readyGames = [];
    for (const selectedGame of selectedGames) {
      const gameUploaded = perGameUploaded.get(selectedGame) || 0;
      if (!gameUploaded) continue;
      const existingGameDocCount = isMultiGameCase
        ? relatedDocs.filter((d) => d.filePath).filter((d) => (selectedGame.id && d.relatedGameId === selectedGame.id)
          || (!d.relatedGameId && (d.gameTitle || '').trim().toLowerCase() === (selectedGame.gameTitle || '').trim().toLowerCase())).length
        : relatedDocs.length;
      if (existingGameDocCount + gameUploaded < 2) continue;
      try {
        const result = await Api.post(`/api/cases/${item.id}/check-consistency`, isMultiGameCase ? { gameId: selectedGame.id } : {});
        if (selectedGames.length === 1) {
          showConsistencyResultModal(selectedGame.gameTitle || item.title, result);
        } else {
          readyGames.push(`${selectedGame.gameTitle || item.title}: ${result.overallStatus === 'ready' ? '🟢 ready' : '🔴 not ready'}`);
        }
      } catch (err) {
        toast(`Automatic consistency check failed for "${selectedGame.gameTitle || item.title}": ${err.message}`, 'danger');
      }
    }
    if (readyGames.length) toast(`Consistency check — ${readyGames.join(' · ')}`);
    route();
  });
}

async function renderCases(content) {
  const cases = await Api.get('/api/cases');
  const canCreate = canDo('cases', 'create');
  const canEdit = canDo('cases', 'edit');
  const canDelete = canDo('cases', 'delete');
  const providers = Array.from(new Set(cases.map((c) => c.provider).filter(Boolean))).sort();

  content.innerHTML = listToolbar({
    title: 'Case Management', canCreate,
    extraButtonsHtml: `
      <button class="btn btn-outline-secondary btn-sm" id="btnExportCases">${Icon('download', 'me-1')}Export CSV</button>
      ${canCreate ? `<button class="btn btn-outline-secondary btn-sm" id="btnImportCases">${Icon('download', 'me-1')}Import Excel/CSV</button>` : ''}`,
  }) + `
    <div class="d-flex flex-wrap gap-2 mb-3">
      <input type="search" class="form-control form-control-sm" id="filterSearch" style="min-width:240px; max-width:320px;" placeholder="Search Game ID / Title / Game Title…">
      ${providers.length ? `
      <select class="form-select form-select-sm w-auto" id="filterProvider">
        <option value="">All Providers</option>
        ${providers.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}
      </select>
      <select class="form-select form-select-sm w-auto" id="filterStage">
        <option value="">All PAGCOR Stages</option>
        ${PAGCOR_STAGE_OPTIONS.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
      </select>` : ''}
    </div>
    <div class="card stat-card">
      <div id="bulkActionBar" class="d-none align-items-center gap-2 p-2 border-bottom bg-light"></div>
      <div class="table-responsive">
        <table class="table table-hover mb-0 table-clickable">
          <thead class="table-light"><tr>
            <th style="width:34px;"><input type="checkbox" id="selectAllCheckbox" title="Select all on this page"></th>
            <th class="sortable-th" data-sort="dateReceived">Date Received <span class="sort-indicator"></span></th>
            <th class="sortable-th" data-sort="gameId">Game ID <span class="sort-indicator"></span></th>
            <th class="sortable-th" data-sort="title">Title <span class="sort-indicator"></span></th>
            <th class="sortable-th" data-sort="type">Type <span class="sort-indicator"></span></th>
            <th class="sortable-th" data-sort="provider">Provider <span class="sort-indicator"></span></th>
            <th class="sortable-th" data-sort="pagcorStage">PAGCOR Stage <span class="sort-indicator"></span></th>
            <th class="sortable-th" data-sort="owner">Owner <span class="sort-indicator"></span></th>
            <th class="sortable-th" data-sort="priority">Priority <span class="sort-indicator"></span></th>
            <th class="sortable-th" data-sort="status">Status <span class="sort-indicator"></span></th>
            <th class="sortable-th" data-sort="deadline">Submit Date <span class="sort-indicator"></span></th>
            <th></th>
          </tr></thead>
          <tbody id="casesTbody"></tbody>
        </table>
      </div>
      <div class="card-footer bg-white d-flex align-items-center justify-content-between" id="casesPagination"></div>
    </div>`;

  const PAGE_SIZE = 30;
  let currentPage = 1;
  let filteredCases = cases;
  let currentPageItems = [];
  let sortColumn = null;
  let sortDir = 'asc';
  const selectedIds = new Set();

  const fields = caseFormFields;

  // Multi-game case (added 2026-08-19 — see caseGamesList's header comment):
  // a case with several games has no single Game ID / PAGCOR Stage to show
  // in these two columns, so a multi-game row shows a games count and a
  // per-stage breakdown ("2 Approved, 1 For Review") instead of the normal
  // single value. A case with exactly one game (new-style single-game, or
  // an older flat case) still shows the plain single value, unchanged.
  function rowHtml(c) {
    const gList = caseGamesList(c);
    const gameIdCell = gList.length > 1
      ? `<span class="small text-secondary">${gList.length} games</span>`
      : escapeHtml((gList[0] && gList[0].gameId) || '—');
    let stageCell;
    if (gList.length > 1) {
      const counts = {};
      gList.forEach((g) => { if (g.pagcorStage) counts[g.pagcorStage] = (counts[g.pagcorStage] || 0) + 1; });
      const parts = Object.entries(counts).map(([s, n]) => `${n} ${s}`);
      stageCell = parts.length ? `<span class="small">${escapeHtml(parts.join(', '))}</span>` : '<span class="text-secondary">—</span>';
    } else {
      const singleStage = gList[0] && gList[0].pagcorStage;
      stageCell = singleStage ? badge(singleStage) : '<span class="text-secondary">—</span>';
    }
    return `
      <tr data-id="${c.id}">
        <td><input type="checkbox" class="row-checkbox" data-id="${c.id}" ${selectedIds.has(c.id) ? 'checked' : ''}></td>
        <td class="text-nowrap">${fmtDate(c.dateReceived)}</td>
        <td class="text-nowrap">${gameIdCell}</td>
        <td title="${escapeHtml(c.caseNumber || '')}">${escapeHtml(c.title)}</td>
        <td>${escapeHtml(c.type)}</td>
        <td>${escapeHtml(c.provider || '—')}</td>
        <td>${stageCell}</td>
        <td>${escapeHtml(userName(c.ownerId))}</td>
        <td>${priorityBadge(c.priority)}</td>
        <td>${badge(c.status)}</td>
        <td class="text-nowrap">${fmtDate(c.deadline)}</td>
        <td class="text-end text-nowrap">
          ${c.provider && !Array.isArray(c.games) && PAGCOR_CHECKLIST_ITEMS.length ? `<button class="btn btn-sm btn-outline-secondary btn-checklist" data-id="${c.id}" title="PAGCOR Checklist (${checklistDoneCount(c.checklist)}/${PAGCOR_CHECKLIST_ITEMS.length})">${Icon('checklist')}</button>` : ''}
          ${canEdit ? `<button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${c.id}">${Icon('edit')}</button>` : ''}
          ${canDelete ? `<button class="btn btn-sm btn-outline-danger btn-del" data-id="${c.id}">${Icon('trash')}</button>` : ''}
        </td>
      </tr>`;
  }

  function attachRowHandlers() {
    // Row click navigates to the full case/game detail page (renderCaseDetail(),
    // routed via "#/cases/<id>") — this is what makes "click in to see this
    // game's info" possible from the list, rather than only via the Edit
    // button's form. Guard on e.target rather than relying solely on each
    // control's own stopPropagation(): a checkbox's own listener is on
    // 'change', not 'click', so a bare click on it still bubbles up to this
    // handler unless we bail out here too.
    content.querySelectorAll('#casesTbody tr[data-id]').forEach((tr) => tr.addEventListener('click', (e) => {
      if (e.target.closest('input, button, a')) return;
      location.hash = `#/cases/${tr.dataset.id}`;
    }));
    content.querySelectorAll('.btn-edit').forEach((btn) => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = cases.find((c) => c.id === btn.dataset.id);
      showCaseFormModal({
        title: 'Edit Case', initial: item, submitLabel: 'Save',
        onSubmit: async (data) => { await Api.put(`/api/cases/${item.id}`, data); toast('Case updated'); route(); },
      });
    }));
    content.querySelectorAll('.btn-checklist').forEach((btn) => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = cases.find((c) => c.id === btn.dataset.id);
      showPagcorChecklistModal(item, () => route());
    }));
    content.querySelectorAll('.btn-del').forEach((btn) => btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!(await confirmDialog('Delete this case?'))) return;
      await Api.del(`/api/cases/${btn.dataset.id}`);
      toast('Case deleted');
      route();
    }));
    content.querySelectorAll('.row-checkbox').forEach((cb) => cb.addEventListener('change', (e) => {
      e.stopPropagation();
      if (cb.checked) selectedIds.add(cb.dataset.id); else selectedIds.delete(cb.dataset.id);
      updateSelectAllCheckbox();
      updateBulkBar();
    }));
  }

  function updateSelectAllCheckbox() {
    const el = content.querySelector('#selectAllCheckbox');
    if (!el) return;
    el.checked = currentPageItems.length > 0 && currentPageItems.every((c) => selectedIds.has(c.id));
  }

  function updateBulkBar() {
    const bar = content.querySelector('#bulkActionBar');
    if (!bar) return;
    if (selectedIds.size === 0) {
      bar.classList.add('d-none');
      bar.classList.remove('d-flex');
      bar.innerHTML = '';
      return;
    }
    bar.classList.remove('d-none');
    bar.classList.add('d-flex');
    bar.innerHTML = `
      <span class="fw-semibold small">${selectedIds.size} selected</span>
      ${canEdit ? `<button class="btn btn-sm btn-primary" id="btnBulkStage">${Icon('checkSquare', 'me-1')}Bulk Update PAGCOR Stage</button>` : ''}
      <button class="btn btn-sm btn-outline-secondary" id="btnBulkClear">Clear Selection</button>`;
    const stageBtn = bar.querySelector('#btnBulkStage');
    if (stageBtn) stageBtn.addEventListener('click', showBulkStageModal);
    bar.querySelector('#btnBulkClear').addEventListener('click', () => { selectedIds.clear(); renderPage(); });
  }

  function showBulkStageModal() {
    const modalId = 'bulkStageModal';
    let modalEl = document.getElementById(modalId);
    if (modalEl) modalEl.remove();
    modalEl = document.createElement('div');
    modalEl.id = modalId;
    modalEl.className = 'modal fade';
    modalEl.tabIndex = -1;
    // Selected cases with more than one game get an expandable per-game
    // checklist (default: every game checked) so the new Stage can target
    // just some of a case's games — e.g. only the 2 (of 5) that actually got
    // approved — instead of always applying to the whole case. A selected
    // case with 0 or 1 games needs no such list; it's updated as a whole
    // case exactly as bulk stage update always worked.
    const selectedCases = Array.from(selectedIds).map((id) => cases.find((c) => c.id === id)).filter(Boolean);
    const multiGameSelected = selectedCases.filter((c) => Array.isArray(c.games) && c.games.length > 1);
    modalEl.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Bulk Update PAGCOR Stage (${selectedIds.size} case(s))</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <label class="form-label">Set to:</label>
            <select class="form-select mb-3" id="bulkStageSelect">
              ${PAGCOR_STAGE_OPTIONS.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
            </select>
            ${multiGameSelected.length ? `
            <div class="small text-secondary mb-2">${multiGameSelected.length} of the selected cases have more than one game — uncheck any game that shouldn't be updated (all are checked by default).</div>
            ${multiGameSelected.map((c) => `
              <div class="border rounded p-2 mb-2" data-bulk-case-id="${escapeHtml(c.id)}">
                <div class="fw-semibold small mb-1">${escapeHtml(c.title)}</div>
                ${c.games.map((g) => `
                  <div class="form-check">
                    <input class="form-check-input bulk-game-check" type="checkbox" value="${escapeHtml(g.id || '')}" id="bulkGame-${escapeHtml(g.id || '')}" checked>
                    <label class="form-check-label small" for="bulkGame-${escapeHtml(g.id || '')}">${escapeHtml(g.gameTitle || '(untitled game)')} <span class="text-secondary">— currently ${escapeHtml(g.pagcorStage || '—')}</span></label>
                  </div>`).join('')}
              </div>`).join('')}
            ` : `<label class="form-label small text-secondary d-block">This will set the Stage for every selected case (and, for any that have multiple games, every game inside it).</label>`}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="bulkStageConfirmBtn">Confirm Update</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modalEl);
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    modalEl.querySelector('#bulkStageConfirmBtn').addEventListener('click', async () => {
      const btn = modalEl.querySelector('#bulkStageConfirmBtn');
      const pagcorStage = modalEl.querySelector('#bulkStageSelect').value;
      // Only cases with a checkbox list actually narrow to specific games —
      // for those, an unchecked game is left out of gameIds[caseId]; if
      // every one of that case's checkboxes ends up checked, gameIds[caseId]
      // still gets the full list, which the server treats identically to
      // omitting it (see bulk-update-stage's header comment).
      const gameIds = {};
      modalEl.querySelectorAll('[data-bulk-case-id]').forEach((caseBlock) => {
        const caseId = caseBlock.dataset.bulkCaseId;
        gameIds[caseId] = Array.from(caseBlock.querySelectorAll('.bulk-game-check:checked')).map((cb) => cb.value);
      });
      btn.disabled = true;
      const originalLabel = btn.textContent;
      btn.textContent = 'Updating…';
      try {
        const result = await Api.post('/api/cases/bulk-update-stage', { ids: Array.from(selectedIds), pagcorStage, gameIds });
        modal.hide();
        toast(`Updated PAGCOR Stage for ${result.updated} case(s)${result.errors && result.errors.length ? `, ${result.errors.length} error(s)` : ''}`);
        selectedIds.clear();
        route();
      } catch (err) {
        toast(err.message, 'danger');
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    });

    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
  }

  // Sort value per column — pagcorStage sorts by pipeline order (Pending
  // Documents → ... → Rejected), not alphabetically; priority sorts High/Medium/Low
  // rather than alphabetically; everything else is a case-insensitive string
  // (or numeric epoch for Deadline, with no-deadline sorting last).
  function sortValue(c, col) {
    switch (col) {
      case 'dateReceived': return (c.dateReceived && hasReliableYear(c.dateReceived)) ? new Date(c.dateReceived).getTime() : Infinity;
      case 'gameId': return (c.gameId || '').toLowerCase();
      case 'title': return (c.title || '').toLowerCase();
      case 'type': return (c.type || '').toLowerCase();
      case 'provider': return (c.provider || '').toLowerCase();
      case 'pagcorStage': return c.pagcorStage ? PAGCOR_STAGE_OPTIONS.indexOf(c.pagcorStage) : -1;
      case 'owner': return userName(c.ownerId).toLowerCase();
      case 'priority': return { High: 0, Medium: 1, Low: 2 }[c.priority] ?? 3;
      case 'status': return (c.status || '').toLowerCase();
      case 'deadline': return c.deadline ? new Date(c.deadline).getTime() : Infinity;
      default: return '';
    }
  }
  function sortComparator(a, b) {
    const va = sortValue(a, sortColumn);
    const vb = sortValue(b, sortColumn);
    const cmp = (typeof va === 'number' && typeof vb === 'number') ? va - vb : String(va).localeCompare(String(vb));
    return sortDir === 'asc' ? cmp : -cmp;
  }
  function sortedFilteredCases() {
    return sortColumn ? [...filteredCases].sort(sortComparator) : filteredCases;
  }

  function csvEscape(v) {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  // Exports every row matching the current Provider/Stage/search filters
  // (not just the current page) in the current sort order — a CSV rather
  // than a real .xlsx since that needs no library/build step and opens
  // fine in Excel; mirrors the same field set the Import feature reads.
  function exportCasesCsv() {
    const header = ['Case #', 'Title', 'Type', 'Provider', 'Game Title', 'Game Type', 'Game ID', 'Game Version', 'With Jackpot',
      'PAGCOR Stage', 'Owner', 'Priority', 'Status', 'Date Received', 'Submit Date', 'LOA Expiry Date', 'Description'];
    const lines = [header.map(csvEscape).join(',')];
    // Multi-game case: one row per game, so every game's own PAGCOR Stage/
    // Game ID/etc. is actually visible in the export instead of only the
    // first game's — case-level fields (Case #, Title, Provider, Owner,
    // Priority, Status, Description) repeat on every row for that case, same
    // as a legacy flat single-game case's one row already looked. LOA Expiry
    // Date comes from the game (each game tracks its own), not the case.
    sortedFilteredCases().forEach((c) => {
      caseGamesList(c).forEach((g) => {
        lines.push([
          c.caseNumber, c.title, c.type, c.provider || '', g.gameTitle || '', g.gameType || '', g.gameId || '', g.gameVersion || '', g.withJackpot || '',
          g.pagcorStage || '',
          userName(c.ownerId), c.priority, c.status, c.dateReceived || '', c.deadline || '', g.loaExpiryDate || '', c.description || '',
        ].map(csvEscape).join(','));
      });
      if (!caseGamesList(c).length) {
        // Non-PAGCOR case (no provider, no games) — still export exactly one
        // row so it isn't silently dropped from the file.
        lines.push([
          c.caseNumber, c.title, c.type, '', '', '', '', '', '',
          '',
          userName(c.ownerId), c.priority, c.status, c.dateReceived || '', c.deadline || '', '', c.description || '',
        ].map(csvEscape).join(','));
      }
    });
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cases_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // 30 rows per page (see renderPage()) — filtering always jumps back to
  // page 1 since the previous page number may no longer make sense against
  // the new filtered set. Search matches Game ID, Title, or Game Title
  // (substring, case-insensitive) — useful once there are hundreds of
  // imported games and you just want to find one by its ID or name. Case #
  // is intentionally not matched here (was, until Tiffany asked for Game ID
  // instead) — it's still visible as its own sortable column and in the
  // Provider/Stage filters, just not part of this search box.
  function applyFilters() {
    const providerEl = content.querySelector('#filterProvider');
    const stageEl = content.querySelector('#filterStage');
    const searchEl = content.querySelector('#filterSearch');
    const provider = providerEl ? providerEl.value : '';
    const stage = stageEl ? stageEl.value : '';
    const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
    filteredCases = cases.filter((c) => (!provider || c.provider === provider)
      // Stage filter matches if ANY game inside the case is at that stage —
      // covers both a legacy flat case's own single stage and any one game
      // inside a multi-game case, so a Dashboard pipeline click-through
      // ("N games in For Review") actually surfaces multi-game cases too.
      && (!stage || caseGamesList(c).some((g) => g.pagcorStage === stage))
      && (!q || (c.title || '').toLowerCase().includes(q) || (c.gameTitle || '').toLowerCase().includes(q) || (c.gameId || '').toLowerCase().includes(q)
        || caseGamesList(c).some((g) => (g.gameTitle || '').toLowerCase().includes(q) || (g.gameId || '').toLowerCase().includes(q))));
    currentPage = 1;
    renderPage();
  }

  function renderPage() {
    const sorted = sortedFilteredCases();
    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    currentPageItems = sorted.slice(start, start + PAGE_SIZE);
    content.querySelector('#casesTbody').innerHTML = currentPageItems.map(rowHtml).join('') || `<tr><td colspan="12" class="text-center text-secondary py-3">No cases match this filter.</td></tr>`;
    attachRowHandlers();
    updateSelectAllCheckbox();
    updateBulkBar();

    const pag = content.querySelector('#casesPagination');
    if (sorted.length === 0) { pag.innerHTML = ''; return; }
    const rangeStart = start + 1;
    const rangeEnd = Math.min(start + PAGE_SIZE, sorted.length);
    pag.innerHTML = `
      <span class="text-secondary small">Showing ${rangeStart}–${rangeEnd} of ${sorted.length}</span>
      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-sm btn-outline-secondary" id="btnPagePrev" ${currentPage <= 1 ? 'disabled' : ''}>&lsaquo; Prev</button>
        <span class="small text-secondary">Page ${currentPage} of ${totalPages}</span>
        <button class="btn btn-sm btn-outline-secondary" id="btnPageNext" ${currentPage >= totalPages ? 'disabled' : ''}>Next &rsaquo;</button>
      </div>`;
    const prevBtn = pag.querySelector('#btnPagePrev');
    const nextBtn = pag.querySelector('#btnPageNext');
    if (prevBtn) prevBtn.addEventListener('click', () => { currentPage--; renderPage(); content.querySelector('.table-responsive').scrollIntoView({ block: 'nearest' }); });
    if (nextBtn) nextBtn.addEventListener('click', () => { currentPage++; renderPage(); content.querySelector('.table-responsive').scrollIntoView({ block: 'nearest' }); });
  }

  content.querySelector('#filterSearch').addEventListener('input', applyFilters);
  if (providers.length) {
    content.querySelector('#filterProvider').addEventListener('change', applyFilters);
    content.querySelector('#filterStage').addEventListener('change', applyFilters);
    // Deep-link support for "#/cases?stage=Under%20PAGCOR%20Review" (used by
    // the Dashboard's PAGCOR Submission Pipeline board's "N more →" links)
    // — pre-select the Stage filter from the URL's query string, if present.
    const stageParam = new URLSearchParams(location.hash.split('?')[1] || '').get('stage');
    if (stageParam && PAGCOR_STAGE_OPTIONS.includes(stageParam)) {
      content.querySelector('#filterStage').value = stageParam;
    }
  }

  content.querySelector('#selectAllCheckbox').addEventListener('change', (e) => {
    currentPageItems.forEach((c) => { if (e.target.checked) selectedIds.add(c.id); else selectedIds.delete(c.id); });
    renderPage();
  });

  content.querySelectorAll('.sortable-th').forEach((th) => th.addEventListener('click', () => {
    const col = th.dataset.sort;
    sortDir = (sortColumn === col && sortDir === 'asc') ? 'desc' : 'asc';
    sortColumn = col;
    content.querySelectorAll('.sortable-th .sort-indicator').forEach((el) => { el.textContent = ''; });
    th.querySelector('.sort-indicator').textContent = sortDir === 'asc' ? ' ▲' : ' ▼';
    currentPage = 1;
    renderPage();
  }));

  content.querySelector('#btnExportCases').addEventListener('click', exportCasesCsv);

  applyFilters();

  if (canCreate) {
    content.querySelector('#btnCreate').addEventListener('click', () => {
      showCaseFormModal({
        title: 'New Case', initial: { status: 'Open', priority: 'Medium' }, submitLabel: 'Create Case',
        onSubmit: async (data) => { await Api.post('/api/cases', data); toast('Case created'); route(); },
      });
    });
    content.querySelector('#btnImportCases').addEventListener('click', showImportCasesModal);
  }
}

// AI Case intake wizard — "when a new case comes in, upload every document
// at once and let AI organize it into a Case and auto-check consistency"
// (the workflow legal actually described). Two steps in one flow:
//   1. Pick every document for this game submission at once (RNG report,
//      Game Manual, approval notice...) and let AI read all of them
//      together to propose the new Case's fields (server/ai.js's
//      extractCaseFromDocuments) — reusing the same case form
//      (caseFormFields()) the plain "New Case" button uses, so the user
//      reviews/edits exactly like normal before anything is saved.
//   2. On confirm: create the Case, upload every one of the originally
//      selected files as Document Center records already linked to it
//      (relatedCaseId + matching provider/gameTitle, so they show up
//      immediately in that game's Document Center folder — see
//      renderDocuments()'s folder view), then automatically run the same
//      AI consistency check the case detail page's button runs, so the
//      Compliant/mismatch result appears right away without a second click.
function showCaseIntakeWizard() {
  const modalId = 'caseIntakeModal';
  let modalEl = document.getElementById(modalId);
  if (modalEl) modalEl.remove();
  modalEl = document.createElement('div');
  modalEl.id = modalId;
  modalEl.className = 'modal fade';
  modalEl.tabIndex = -1;
  modalEl.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">${sparkleMark('me-1')} Create Case from Documents (AI)</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <p class="small text-secondary">Upload all related documents for the same game at once (RNG report, Game Manual, approval notice, etc.).
            AI will read these documents and organize the case fields for you to review; once the case is created, it will automatically compare these documents on Game ID, Game Manual,
            Game Version, Minimum Bet, and Maximum Bet for consistency.</p>
          <input type="file" class="form-control" id="caseIntakeFiles" multiple accept=".pdf,image/*,.txt">
          <div id="caseIntakeMsg" class="small mt-2 text-danger"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="btnCaseIntakeNext">Read with AI &amp; Continue</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modalEl);
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
  modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());

  modalEl.querySelector('#btnCaseIntakeNext').addEventListener('click', async () => {
    const fileInput = modalEl.querySelector('#caseIntakeFiles');
    const msgEl = modalEl.querySelector('#caseIntakeMsg');
    const files = Array.from(fileInput.files || []);
    if (!files.length) { msgEl.textContent = 'Please select at least one document first.'; return; }
    const nextBtn = modalEl.querySelector('#btnCaseIntakeNext');
    const originalHtml = nextBtn.innerHTML;
    nextBtn.disabled = true;
    nextBtn.innerHTML = 'AI reading…';
    msgEl.textContent = '';
    try {
      const documents = await Promise.all(files.map(async (f) => ({
        fileName: f.name, fileContentBase64: await fileToBase64(f),
      })));
      const { common, games } = await Api.post('/api/cases/extract-from-documents', { documents });
      modal.hide();
      if (!games || !games.length) {
        toast('AI could not read any game information from these documents. Please check the uploaded files, or use "New" to create the case manually.', 'danger');
        return;
      }
      if (games.length === 1) {
        showCaseIntakeSingleReview(documents, { status: 'Open', priority: 'Medium', ...common, ...games[0] });
      } else {
        showCaseIntakeMultiGameReview(documents, common || {}, games);
      }
    } catch (err) {
      msgEl.textContent = err.message;
      nextBtn.disabled = false;
      nextBtn.innerHTML = originalHtml;
    }
  });
}

// Creates a single Case, uploads `documents` (already {fileName,
// fileContentBase64} pairs) as Document Center records linked to it, and
// (if 2+ uploaded successfully) auto-runs the AI consistency check —
// shared by both the single-game intake review below and each row of the
// multi-game review, so "what happens after a case is confirmed" only
// exists in one place.
async function createCaseFromIntake(caseData, documents) {
  const newCase = await Api.post('/api/cases', caseData);
  let uploadedCount = 0;
  for (const doc of documents) {
    try {
      await Api.post('/api/documents', {
        title: doc.fileName, category: 'Certificates',
        provider: caseData.provider, gameTitle: caseData.gameTitle, gameId: caseData.gameId,
        relatedCaseId: newCase.id,
        fileName: doc.fileName, fileContentBase64: doc.fileContentBase64,
      });
      uploadedCount++;
    } catch (err) {
      toast(`Failed to upload "${doc.fileName}": ${err.message}`, 'danger');
    }
  }
  let consistency = null;
  if (uploadedCount >= 2) {
    try { consistency = await Api.post(`/api/cases/${newCase.id}/check-consistency`, {}); }
    catch (err) { toast(`Automatic consistency check for "${newCase.title}" failed: ${err.message}`, 'danger'); }
  }
  return { case: newCase, uploadedCount, consistency };
}

// The common case — AI found exactly 1 game in the uploaded documents.
// Reuses the normal case form (caseFormFields()) so review/edit works
// exactly like every other form in the app.
function showCaseIntakeSingleReview(documents, initial) {
  showFormModal({
    title: `Confirm Case Details (${documents.length} document(s) read)`,
    fields: caseFormFields(),
    initial,
    submitLabel: 'Create Case & Check Documents',
    onSubmit: async (data) => {
      const { case: newCase, uploadedCount, consistency } = await createCaseFromIntake(data, documents);
      toast(`Case created — ${uploadedCount}/${documents.length} document(s) uploaded successfully`);
      if (consistency) showConsistencyResultModal(newCase.title, consistency);
      else if (uploadedCount < 2) toast('Fewer than 2 documents uploaded successfully, so the automatic consistency check was skipped — you can run it manually from the case detail page later.', 'danger');
      location.hash = `#/cases/${newCase.id}`;
    },
  });
}

// The case that prompted this: a single PAGCOR submission bundle (most
// often one Notice of Approval letter) can cover several DIFFERENT games
// at once via an "Annex A"-style table. Forcing that into one flat case
// form left the most important field (which game?) blank, since there
// was never one correct single answer. Instead: show every detected game
// as its own editable, checkable row, apply the shared `common` fields
// (Provider/Type/Priority/Status/Deadline/Description) to whichever rows
// stay checked, and create one Case per checked row — all of them getting
// copies of the same uploaded documents (the one approval letter really
// does apply to all of them), each auto-running its own consistency check.
function showCaseIntakeMultiGameReview(documents, common, games) {
  const modalId = 'caseIntakeMultiModal';
  let modalEl = document.getElementById(modalId);
  if (modalEl) modalEl.remove();
  modalEl = document.createElement('div');
  modalEl.id = modalId;
  modalEl.className = 'modal fade';
  modalEl.tabIndex = -1;
  const gameTypeOptions = (selected) => `<option value="">—</option>${GAME_TYPE_OPTIONS.map((v) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${v}</option>`).join('')}`;
  modalEl.innerHTML = `
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">${sparkleMark('me-1')} ${games.length} Game(s) Detected in These Documents</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <p class="small text-secondary">AI determined that this batch of documents (often the case when one approval notice covers several games at once) spans ${games.length} different game(s),
            each organized into a row below. Uncheck a row to skip creating that case; every other field can be edited directly.
            These ${documents.length} document(s) will be copied and linked to every case you check and create.</p>
          <div class="border rounded p-3 mb-3 bg-light">
            <div class="small fw-semibold mb-2">Shared Fields (applied to every checked case below)</div>
            <div class="row g-2">
              <div class="col-md-4">
                <label class="small text-secondary">Provider</label>
                <input class="form-control form-control-sm" id="intakeCommonProvider" value="${escapeHtml(common.provider || '')}">
              </div>
              <div class="col-md-4">
                <label class="small text-secondary">Type</label>
                <select class="form-select form-select-sm" id="intakeCommonType">
                  ${['Regulatory', 'Commercial', 'IP', 'Litigation', 'Employment', 'Other'].map((v) => `<option value="${v}" ${v === (common.type || 'Regulatory') ? 'selected' : ''}>${v}</option>`).join('')}
                </select>
              </div>
              <div class="col-md-4">
                <label class="small text-secondary">Priority</label>
                <select class="form-select form-select-sm" id="intakeCommonPriority">
                  ${['High', 'Medium', 'Low'].map((v) => `<option value="${v}" ${v === (common.priority || 'Medium') ? 'selected' : ''}>${v}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>
          <div id="intakeGamesRows">
            ${games.map((g, i) => `
              <div class="card mb-2 intake-game-row" data-index="${i}">
                <div class="card-body py-2">
                  <div class="d-flex align-items-start gap-2">
                    <input type="checkbox" class="form-check-input mt-2 intake-game-include" checked>
                    <div class="flex-grow-1 row g-2">
                      <div class="col-md-6">
                        <label class="small text-secondary">Case Title</label>
                        <input class="form-control form-control-sm intake-game-title" value="${escapeHtml(g.title || `PAGCOR game submission - ${g.gameTitle || ''}`)}">
                      </div>
                      <div class="col-md-6">
                        <label class="small text-secondary">Game Title</label>
                        <input class="form-control form-control-sm intake-game-gameTitle" value="${escapeHtml(g.gameTitle || '')}">
                      </div>
                      <div class="col-md-4">
                        <label class="small text-secondary">Game ID</label>
                        <input class="form-control form-control-sm intake-game-gameId" value="${escapeHtml(g.gameId || '')}">
                      </div>
                      <div class="col-md-4">
                        <label class="small text-secondary">Game Type</label>
                        <select class="form-select form-select-sm intake-game-gameType">${gameTypeOptions(g.gameType)}</select>
                      </div>
                      <div class="col-md-4">
                        <label class="small text-secondary">Game Version</label>
                        <input class="form-control form-control-sm intake-game-gameVersion" value="${escapeHtml(g.gameVersion || '')}">
                      </div>
                    </div>
                  </div>
                </div>
              </div>`).join('')}
          </div>
          <div id="intakeMultiMsg" class="small text-danger"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="btnIntakeCreateAll">Create Selected Cases & Check Documents</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modalEl);
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
  modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());

  modalEl.querySelector('#btnIntakeCreateAll').addEventListener('click', async () => {
    const msgEl = modalEl.querySelector('#intakeMultiMsg');
    msgEl.textContent = '';
    const commonData = {
      provider: modalEl.querySelector('#intakeCommonProvider').value.trim() || undefined,
      type: modalEl.querySelector('#intakeCommonType').value,
      priority: modalEl.querySelector('#intakeCommonPriority').value,
      status: 'Open',
    };
    const rows = Array.from(modalEl.querySelectorAll('.intake-game-row'))
      .filter((row) => row.querySelector('.intake-game-include').checked)
      .map((row) => ({
        title: row.querySelector('.intake-game-title').value.trim(),
        gameTitle: row.querySelector('.intake-game-gameTitle').value.trim(),
        gameId: row.querySelector('.intake-game-gameId').value.trim() || undefined,
        gameType: row.querySelector('.intake-game-gameType').value || undefined,
        gameVersion: row.querySelector('.intake-game-gameVersion').value.trim() || undefined,
      }));
    if (!rows.length) { msgEl.textContent = 'Please check at least one game.'; return; }
    if (rows.some((r) => !r.gameTitle)) { msgEl.textContent = 'Every checked game needs a Game Title.'; return; }

    const createBtn = modalEl.querySelector('#btnIntakeCreateAll');
    createBtn.disabled = true;
    const results = [];
    for (let i = 0; i < rows.length; i++) {
      createBtn.innerHTML = `Creating… (${i + 1}/${rows.length})`;
      try {
        const caseData = { ...commonData, title: rows[i].title || `PAGCOR game submission - ${rows[i].gameTitle}`, gameTitle: rows[i].gameTitle, gameId: rows[i].gameId, gameType: rows[i].gameType, gameVersion: rows[i].gameVersion };
        const result = await createCaseFromIntake(caseData, documents);
        results.push(result);
      } catch (err) {
        toast(`Failed to create "${rows[i].gameTitle}": ${err.message}`, 'danger');
      }
    }
    modal.hide();
    if (!results.length) { toast('No cases were created successfully.', 'danger'); return; }
    showInfoModal({
      title: `${results.length} Case(s) Created`,
      bodyHtml: `
        <div class="list-group">
          ${results.map((r) => `
            <a href="#/cases/${r.case.id}" class="list-group-item d-flex justify-content-between align-items-center flex-wrap gap-2 text-decoration-none" style="color:inherit;" data-bs-dismiss="modal">
              <div>
                <div class="fw-semibold">${escapeHtml(r.case.gameTitle || r.case.title)}</div>
                <div class="small text-secondary">${r.uploadedCount}/${documents.length} document(s) uploaded${r.consistency ? ` · ${r.consistency.compliant ? '✅ Compliant' : '⚠️ Discrepancy needs review'}` : ' · Consistency check not run'}</div>
              </div>
              <span class="small text-secondary">View &rarr;</span>
            </a>`).join('')}
        </div>
        <p class="small text-secondary mt-3 mb-0">Click any row to view that case's full comparison results and details.</p>
      `,
    });
  });
}

// Upload a real PAGCOR "Notice of Approval" letter (often a scanned image
// with no text layer — pdf-parse can't read those, which is why "check the
// PAGCOR approval list" alone isn't enough for approvals PAGCOR hasn't folded
// into its public list yet) and have Gemini read it directly. Deliberately
// conservative: the backend only auto-approves a game when it can match it
// to exactly one case (by Game ID, or by exact title as a fallback) —
// anything else comes back as "unmatched" or "ambiguous" and is shown here
// so the user can resolve it by hand rather than the system guessing.
function showImportApprovalNoticeModal() {
  const modalId = 'importApprovalNoticeModal';
  let modalEl = document.getElementById(modalId);
  if (modalEl) modalEl.remove();
  modalEl = document.createElement('div');
  modalEl.id = modalId;
  modalEl.className = 'modal fade';
  modalEl.tabIndex = -1;
  modalEl.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Upload Approval Notice</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body" id="approvalNoticeModalBody">
          <div class="small text-secondary mb-2">
            Upload the approval notice PAGCOR sent you (PDF or image, scanned files are fine too).
            AI will read the content, find the games approved in the letter, and automatically match them against the corresponding cases in your system,
            changing matched cases to "Approved". If no match is found, or multiple cases match,
            they'll be listed here for you to confirm manually — nothing is guessed.
          </div>
          <input type="file" class="form-control" id="approvalNoticeFile" accept="application/pdf,image/*">
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="approvalNoticeSubmitBtn">Upload & Check</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modalEl);
  const modal = new bootstrap.Modal(modalEl);
  modal.show();

  let didUpdateAnything = false;
  modalEl.addEventListener('hidden.bs.modal', () => {
    modalEl.remove();
    if (didUpdateAnything) route();
  });

  modalEl.querySelector('#approvalNoticeSubmitBtn').addEventListener('click', async () => {
    const fileInput = modalEl.querySelector('#approvalNoticeFile');
    const file = fileInput.files && fileInput.files[0];
    if (!file) { toast('Please select a file first', 'danger'); return; }
    const btn = modalEl.querySelector('#approvalNoticeSubmitBtn');
    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = 'AI reading…';
    try {
      const fileContentBase64 = await fileToBase64(file);
      const result = await Api.post('/api/cases/import-approval-notice', { fileName: file.name, fileContentBase64 });
      if (result.updatedCases.length) didUpdateAnything = true;
      const body = modalEl.querySelector('#approvalNoticeModalBody');
      const section = (title, items, renderItem) => items && items.length
        ? `<div class="mb-3"><div class="fw-semibold small mb-1">${escapeHtml(title)}</div><ul class="small mb-0">${items.map(renderItem).join('')}</ul></div>`
        : '';
      body.innerHTML = `
        ${result.noticeReference || result.approvalDate ? `<div class="small text-secondary mb-2">${result.noticeReference ? `Reference No.: ${escapeHtml(result.noticeReference)}　` : ''}${result.approvalDate ? `Date: ${escapeHtml(result.approvalDate)}` : ''}</div>` : ''}
        ${section('Automatically Approved', result.updatedCases, (c) => `<li>${escapeHtml(c.caseNumber)} — ${escapeHtml(c.title)} (${escapeHtml(c.oldStage)} → Approved)</li>`)}
        ${section('Already Approved', result.alreadyApproved, (c) => `<li>${escapeHtml(c.caseNumber)} — ${escapeHtml(c.title)}</li>`)}
        ${section('Case Status is Rejected — Not Automatically Changed', result.skippedRejected, (c) => `<li>${escapeHtml(c.caseNumber)} — ${escapeHtml(c.title)}</li>`)}
        ${section('⚠️ No Matching Case Found (needs manual confirmation)', result.unmatched, (g) => `<li>${escapeHtml(g.gameTitle || '(unnamed)')}${g.gameId ? ` — Game ID: ${escapeHtml(g.gameId)}` : ''}${g.provider ? ` — ${escapeHtml(g.provider)}` : ''}</li>`)}
        ${section('⚠️ Matches Multiple Cases — Not Automatically Changed (needs manual confirmation)', result.ambiguous, (g) => `<li>${escapeHtml(g.gameTitle || '(unnamed)')}${g.gameId ? ` — Game ID: ${escapeHtml(g.gameId)}` : ''} — Matches: ${g.matchedCaseNumbers.map(escapeHtml).join(', ')}</li>`)}
        ${!result.updatedCases.length && !result.alreadyApproved.length && !result.skippedRejected.length && !result.unmatched.length && !result.ambiguous.length ? '<div class="small text-secondary">AI could not read any game information from this document.</div>' : ''}`;
      modalEl.querySelector('.modal-footer').innerHTML = `<button type="button" class="btn btn-primary" data-bs-dismiss="modal">Done</button>`;
      toast(`${result.updatedCases.length} case(s) automatically approved`, (result.unmatched.length || result.ambiguous.length) ? 'warning' : 'success');
    } catch (err) {
      toast(err.message, 'danger');
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });
}

// ---------------------------------------------------------------------------
// Page: Document Center
// ---------------------------------------------------------------------------
// Document Center — a Provider filter bar (tabs, not page navigation) over a
// list of games, drilling into a per-game document list on click. Came
// directly from feedback that with hundreds of documents a flat list wasn't
// a usable way to find "all of this game's paperwork," and that switching
// providers should just re-filter the same list rather than jump to a whole
// new page. Games are grouped from fields documents already carry
// (provider/gameTitle, set on upload or by AI smart-fill); a document
// missing either falls into an "Uncategorized" bucket rather than disappearing.
// Category/Report Type are deliberately NOT shown anywhere in this view —
// Document Center's job here is just filing/finding files, not classifying
// them; those fields still exist and are still set on the upload/edit form
// (used elsewhere, e.g. non-PAGCOR documents) but this page doesn't surface
// them. Position is tracked in the module-level `documentsFolderNav` so it
// survives a delete/edit/upload's route() re-render — see its declaration
// near the top of this file for why that has to live outside this function.
async function renderDocuments(content) {
  const docs = await Api.get('/api/documents');
  const canCreate = canDo('documents', 'create');
  const canEdit = canDo('documents', 'edit');
  const canDelete = canDo('documents', 'delete');

  // fileName comes right after Title — deliberately near the top, right
  // below the AI Smart-Fill box, so the natural flow is "pick the file, then
  // (optionally) click AI Smart-Fill to read that same file" rather than
  // needing to scroll all the way down before AI smart-fill has anything
  // to read. See showFormModal's reuseFileField.
  const fields = () => ([
    { name: 'title', label: 'Title', required: true },
    { name: 'fileName', label: 'File Upload', type: 'file' },
    { name: 'category', label: 'Category', type: 'select', options: ['Templates', 'Policies', 'Agreements', 'Certificates', 'Other'].map((v) => ({ value: v, label: v })), required: true },
    { name: 'isPagcorDoc', label: 'This is a PAGCOR game-related document (check to show game-related fields)', type: 'checkbox', controlsSection: 'pagcor' },
    { name: 'provider', label: 'PAGCOR Provider (optional)', placeholder: 'e.g. FC, JDB, VP', section: 'pagcor' },
    { name: 'gameTitle', label: 'Game Title (optional)', section: 'pagcor' },
    { name: 'gameId', label: 'Game ID (optional)', section: 'pagcor' },
    { name: 'reportType', label: 'Report Type (optional)', type: 'select', allowEmpty: true, options: REPORT_TYPE_OPTIONS.map((v) => ({ value: v, label: v })), section: 'pagcor' },
    { name: 'relatedCaseId', label: 'Related Case (optional)', type: 'select', allowEmpty: true, options: State.lookups.cases.map((c) => ({ value: c.id, label: c.caseNumber + ' - ' + c.title })) },
    { name: 'relatedContractId', label: 'Related Contract (optional)', type: 'select', allowEmpty: true, options: State.lookups.contracts.map((c) => ({ value: c.id, label: c.contractNumber + ' - ' + c.title })) },
  ]);

  // Upload/Edit/Summarize/Delete handlers are identical at both views, so
  // they're wired up once here and called from whichever one actually
  // renders a #btnCreate / row buttons this pass.
  const wireUpload = (prefill) => {
    const btn = content.querySelector('#btnCreate');
    if (!btn) return;
    btn.addEventListener('click', () => {
      showFormModal({
        title: 'Upload Document', fields: fields(), initial: prefill || {}, submitLabel: 'Upload',
        aiAssist: { module: 'documents' },
        onSubmit: async (data) => { await Api.post('/api/documents', data); toast('Document uploaded'); route(); },
      });
    });
  };
  const wireRowActions = (rowDocs) => {
    content.querySelectorAll('.btn-download-doc').forEach((btn) => btn.addEventListener('click', () => {
      downloadAuthedFile(`/api/documents/${btn.dataset.id}/download`, btn.dataset.filename);
    }));
    content.querySelectorAll('.btn-preview-doc').forEach((btn) => btn.addEventListener('click', () => {
      previewAuthedFile(`/api/documents/${btn.dataset.id}/download`);
    }));
    content.querySelectorAll('.btn-edit').forEach((btn) => btn.addEventListener('click', () => {
      const item = rowDocs.find((d) => d.id === btn.dataset.id);
      showFormModal({ title: 'Edit Document', fields: fields().filter((f) => f.name !== 'fileName'), initial: item,
        onSubmit: async (data) => { await Api.put(`/api/documents/${item.id}`, data); toast('Updated'); route(); } });
    }));
    content.querySelectorAll('.btn-del').forEach((btn) => btn.addEventListener('click', async () => {
      if (!(await confirmDialog('Delete this document?'))) return;
      await Api.del(`/api/documents/${btn.dataset.id}`);
      toast('Deleted'); route();
    }));
    // Replace File — uploads a new file for an existing document record.
    // The file it replaces isn't discarded; the server archives it as a
    // numbered entry in that document's version history first (see
    // POST /api/documents/:id/replace-file), viewable via the History button.
    content.querySelectorAll('.btn-replace-doc').forEach((btn) => btn.addEventListener('click', () => {
      const item = rowDocs.find((d) => d.id === btn.dataset.id);
      showFormModal({
        title: `Replace File — ${item.title}`,
        fields: [{ name: 'newFile', label: 'New File', type: 'file', required: true }],
        submitLabel: 'Replace',
        onSubmit: async (data) => {
          await Api.post(`/api/documents/${item.id}/replace-file`, data);
          toast('File replaced — previous version saved to history');
          route();
        },
      });
    }));
    // Version History — lists every file this document used to have before
    // being replaced (see the Replace button above), most recently replaced
    // first, each downloadable on its own.
    content.querySelectorAll('.btn-doc-history').forEach((btn) => btn.addEventListener('click', async () => {
      const item = rowDocs.find((d) => d.id === btn.dataset.id);
      let versions = [];
      try { versions = await Api.get(`/api/documents/${item.id}/versions`); } catch (err) { toast(err.message, 'danger'); return; }
      showInfoModal({
        title: `Version History — ${item.title}`,
        bodyHtml: `
          <div class="list-group list-group-flush">
            <div class="list-group-item d-flex justify-content-between align-items-center px-0">
              <div>
                <div class="fw-semibold">${escapeHtml(item.fileName || 'file')} <span class="badge text-bg-light border">Current</span></div>
                <div class="small text-secondary">${escapeHtml(userName(item.uploadedBy))} · ${fmtDate(item.createdAt)}</div>
              </div>
              <button type="button" class="btn btn-sm btn-outline-secondary btn-download-doc" data-id="${item.id}" data-filename="${escapeHtml(item.fileName || 'file')}">${Icon('download')}</button>
            </div>
            ${versions.map((v) => `
              <div class="list-group-item d-flex justify-content-between align-items-center px-0">
                <div>
                  <div class="fw-semibold">${escapeHtml(v.fileName || 'file')} <span class="text-secondary fw-normal">v${v.versionNo}</span></div>
                  <div class="small text-secondary">${escapeHtml(userName(v.uploadedBy))} · ${fmtDate(v.createdAt)} · replaced by ${escapeHtml(userName(v.replacedBy))}</div>
                </div>
                <button type="button" class="btn btn-sm btn-outline-secondary btn-download-version" data-doc-id="${item.id}" data-version-id="${v.id}" data-filename="${escapeHtml(v.fileName || 'file')}">${Icon('download')}</button>
              </div>`).join('')}
            ${!versions.length ? '<div class="small text-secondary px-0 pt-2">No earlier versions — this file has not been replaced yet.</div>' : ''}
          </div>`,
      });
      // Scoped to the info modal itself (not `content`) — its own fixed
      // #infoModal id, distinct from the underlying table's own
      // .btn-download-doc buttons, which already have their own listener
      // from wireRowActions above and must not be re-bound.
      const historyModalEl = document.getElementById('infoModal');
      historyModalEl.querySelectorAll('.btn-download-doc').forEach((b) => b.addEventListener('click', () => {
        downloadAuthedFile(`/api/documents/${b.dataset.id}/download`, b.dataset.filename);
      }));
      historyModalEl.querySelectorAll('.btn-download-version').forEach((b) => b.addEventListener('click', () => {
        downloadAuthedFile(`/api/documents/${b.dataset.docId}/versions/${b.dataset.versionId}/download`, b.dataset.filename);
      }));
    }));
    // The "AI Summarize" per-document button used to be wired up here —
    // removed 2026-08-18 at Tiffany's request (Document Center should just
    // manage files, no AI on that page). Document Center's AI Smart-Fill on
    // upload was deliberately kept; only this summarize button was removed.
  };

  // Provider/Game Title text doesn't always come out byte-identical —
  // manual typing and AI extraction (especially across different uploads
  // of the same real game) can disagree on casing/spacing ("JDB" vs "jdb",
  // "PARA PO" vs "Para Po"). All grouping/filtering below normalizes
  // (trims, lowercases) before comparing so those don't fracture into
  // separate tabs/rows; a label actually shown on screen is always
  // whichever exact casing appeared most often, never an invented
  // "canonical" spelling.
  const normKey = (v) => String(v || '').trim().toLowerCase();
  // Provider-only variant of normKey() that also folds known abbreviation
  // aliases (see PROVIDER_NAME_ALIASES above, e.g. "OP" -> "Omniplay") onto
  // the same key as their full name, so they group into one tab instead of
  // two. Only used for the provider dimension — gameTitle grouping still
  // uses plain normKey(), since it has no equivalent alias table.
  const normProviderKey = (v) => {
    const k = normKey(v);
    return PROVIDER_NAME_ALIASES[k] ? normKey(PROVIDER_NAME_ALIASES[k]) : k;
  };

  // ---- Game list view: Provider tabs (filter, not navigation) + games ----
  if (!documentsFolderNav.gameTitle) {
    const pickRepresentative = (values) => {
      const counts = {};
      values.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    };
    // Like pickRepresentative() above, but for the provider dimension: if
    // this group's key is a known alias's target (e.g. everything that
    // normalizes to "omniplay", whether the raw value was "OP" or
    // "Omniplay"), always display the full canonical name — never let a
    // short watermark form "win" just because it happened to appear on
    // more documents than the spelled-out name did.
    const pickProviderRepresentative = (key, values) => {
      const aliasTarget = Object.values(PROVIDER_NAME_ALIASES).find((full) => normKey(full) === key);
      return aliasTarget || pickRepresentative(values);
    };
    const providerVariantsByKey = {};
    docs.forEach((d) => {
      if (!d.provider) return;
      const k = normProviderKey(d.provider);
      (providerVariantsByKey[k] = providerVariantsByKey[k] || []).push(d.provider);
    });
    const providers = Object.entries(providerVariantsByKey)
      .map(([k, values]) => pickProviderRepresentative(k, values))
      .sort((a, b) => a.localeCompare(b));
    const hasUncategorized = docs.some((d) => !d.provider);
    const selectedProvider = documentsFolderNav.provider; // null = "All"
    const selectedProviderKey = selectedProvider ? normProviderKey(selectedProvider) : null;
    const filteredDocs = !selectedProvider ? docs
      : selectedProvider === UNCATEGORIZED_PROVIDER ? docs.filter((d) => !d.provider)
      : docs.filter((d) => normProviderKey(d.provider) === selectedProviderKey);

    // Group by normalized provider+gameTitle (not gameTitle alone) so the
    // same game name under two different providers never gets merged
    // together when "All" is selected.
    const gameGroups = {};
    filteredDocs.forEach((d) => {
      const gProvider = d.provider || UNCATEGORIZED_PROVIDER;
      const gTitle = d.gameTitle || UNCATEGORIZED_GAME;
      const key = normProviderKey(gProvider) + '\0' + normKey(gTitle);
      if (!gameGroups[key]) gameGroups[key] = { providerVariants: [], gameTitleVariants: [], docs: [] };
      gameGroups[key].providerVariants.push(gProvider);
      gameGroups[key].gameTitleVariants.push(gTitle);
      gameGroups[key].docs.push(d);
    });
    const gameRows = Object.values(gameGroups).map((g) => ({
      provider: pickProviderRepresentative(normProviderKey(g.providerVariants[0]), g.providerVariants),
      gameTitle: pickRepresentative(g.gameTitleVariants),
      docs: g.docs,
    })).sort((a, b) => {
      if (a.gameTitle === UNCATEGORIZED_GAME) return 1;
      if (b.gameTitle === UNCATEGORIZED_GAME) return -1;
      return a.gameTitle.localeCompare(b.gameTitle);
    });

    const tabKeyAttr = (key) => `data-key="${escapeHtml(key)}"`;
    const tabsHtml = `
      <ul class="nav nav-pills mb-3 flex-wrap gap-1">
        <li class="nav-item"><button type="button" class="btn btn-sm ${!selectedProvider ? 'btn-primary' : 'btn-outline-secondary'} btn-provider-tab" data-key="">All</button></li>
        ${providers.map((p) => `<li class="nav-item"><button type="button" class="btn btn-sm ${selectedProvider === p ? 'btn-primary' : 'btn-outline-secondary'} btn-provider-tab" ${tabKeyAttr(p)}>${escapeHtml(p)}</button></li>`).join('')}
        ${hasUncategorized ? `<li class="nav-item"><button type="button" class="btn btn-sm ${selectedProvider === UNCATEGORIZED_PROVIDER ? 'btn-primary' : 'btn-outline-secondary'} btn-provider-tab" ${tabKeyAttr(UNCATEGORIZED_PROVIDER)}>${UNCATEGORIZED_PROVIDER}</button></li>` : ''}
      </ul>`;

    content.innerHTML = listToolbar({ title: 'Document Center', canCreate }) + tabsHtml + (
      gameRows.length
        ? `<div class="card stat-card">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light"><tr><th>Game Title</th><th>Game ID</th><th>Provider</th><th>Latest Upload</th><th class="text-end">Doc Count</th></tr></thead>
                <tbody>
                  ${gameRows.map((g) => {
                    const latestDate = g.docs.reduce((max, d) => (d.createdAt && (!max || d.createdAt > max)) ? d.createdAt : max, null);
                    const gameId = g.docs.map((d) => d.gameId).find((v) => v);
                    return `
                    <tr class="btn-game-row" style="cursor:pointer" data-provider="${escapeHtml(g.provider)}" data-game="${escapeHtml(g.gameTitle)}">
                      <td>${escapeHtml(g.gameTitle)}</td>
                      <td>${gameId ? escapeHtml(gameId) : '<span class="text-secondary">—</span>'}</td>
                      <td>${escapeHtml(g.provider)}</td>
                      <td class="text-nowrap">${fmtDate(latestDate)}</td>
                      <td class="text-end text-secondary">${g.docs.length}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>`
        : `<div class="card stat-card"><div class="card-body text-center text-secondary py-4">${docs.length ? 'No documents under this provider yet.' : 'No documents yet.'}</div></div>`
    );

    content.querySelectorAll('.btn-provider-tab').forEach((btn) => btn.addEventListener('click', () => {
      documentsFolderNav = { provider: btn.dataset.key || null, gameTitle: null };
      renderDocuments(content);
    }));
    content.querySelectorAll('.btn-game-row').forEach((row) => row.addEventListener('click', () => {
      documentsFolderNav = { provider: row.dataset.provider, gameTitle: row.dataset.game };
      renderDocuments(content);
    }));
    // Note: no need to also set isPagcorDoc here — showFormModal auto-expands
    // the "pagcor" section whenever any section-tagged field (provider here)
    // already has a real value in `initial`, regardless of the checkbox's
    // own initial value (see showFormModal's sectionsToExpand).
    if (canCreate) wireUpload(selectedProvider && selectedProvider !== UNCATEGORIZED_PROVIDER ? { provider: selectedProvider } : {});
    return;
  }

  // ---- Documents within one Provider + Game (drill-down) -----------------
  const gameDocs = docs.filter((d) => normProviderKey(d.provider || UNCATEGORIZED_PROVIDER) === normProviderKey(documentsFolderNav.provider) && normKey(d.gameTitle || UNCATEGORIZED_GAME) === normKey(documentsFolderNav.gameTitle));
  // Document Center is intentionally just a storage/browse view now (per
  // Tiffany: it's "a storage room" — you visit it to find a file, not to do
  // work on it) — the AI Parameter Consistency Check that used to live here
  // was removed at her request; it's still available from the Case detail
  // page, which is where document review/upload work actually happens.
  content.innerHTML = listToolbar({
    title: `Document Center — ${documentsFolderNav.provider} / ${documentsFolderNav.gameTitle}`, canCreate,
  }) + `
    <div class="mb-3"><a href="#" id="btnBackToList" class="small text-decoration-none">&larr; All Documents</a></div>
    <div class="card stat-card">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead class="table-light"><tr><th>Title</th><th>File</th><th>Uploaded By</th><th>Uploaded</th><th></th></tr></thead>
          <tbody>
            ${gameDocs.map((d) => `
              <tr>
                <td>${escapeHtml(d.title)}</td>
                <td>${d.filePath ? `<button type="button" class="btn btn-link btn-sm p-0 text-decoration-none btn-download-doc" data-id="${d.id}" data-filename="${escapeHtml(d.fileName || 'file')}">${Icon('download', 'me-1')}${escapeHtml(d.fileName || 'file')}</button>` : `<span class="text-secondary">${escapeHtml(d.fileName || '—')}</span>`}</td>
                <td>${escapeHtml(userName(d.uploadedBy))}</td>
                <td class="text-nowrap">${fmtDate(d.createdAt)}</td>
                <td class="text-end">
                  ${d.filePath ? `<button class="btn btn-sm btn-outline-secondary btn-preview-doc" data-id="${d.id}" title="Preview">${Icon('eye')}</button>` : ''}
                  ${canEdit ? `<button class="btn btn-sm btn-outline-secondary btn-replace-doc" data-id="${d.id}" title="Replace File">${Icon('upload')}</button>` : ''}
                  ${d.filePath ? `<button class="btn btn-sm btn-outline-secondary btn-doc-history" data-id="${d.id}" title="Version History">${Icon('history')}</button>` : ''}
                  ${canEdit ? `<button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${d.id}">${Icon('edit')}</button>` : ''}
                  ${canDelete ? `<button class="btn btn-sm btn-outline-danger btn-del" data-id="${d.id}">${Icon('trash')}</button>` : ''}
                </td>
              </tr>`).join('') || `<tr><td colspan="5" class="text-center text-secondary py-3">No documents yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
  content.querySelector('#btnBackToList').addEventListener('click', (e) => {
    e.preventDefault(); documentsFolderNav = { ...documentsFolderNav, gameTitle: null }; renderDocuments(content);
  });
  if (canCreate) {
    const prefill = {};
    if (documentsFolderNav.provider !== UNCATEGORIZED_PROVIDER) prefill.provider = documentsFolderNav.provider;
    if (documentsFolderNav.gameTitle !== UNCATEGORIZED_GAME) prefill.gameTitle = documentsFolderNav.gameTitle;
    wireUpload(prefill);
  }
  wireRowActions(gameDocs);
}

// ---------------------------------------------------------------------------
// Page: Task Management
// ---------------------------------------------------------------------------
// A task counts as Overdue when it has a Due Date in the past and isn't
// already Completed — same "overdue" definition the Dashboard's Today's
// To-Dos widget uses. Deliberately a derived bucket, not a real `status`
// value stored on the task — a task that's actually "In Progress" but past
// its due date should still show as In Progress if you clear the Overdue
// filter, not silently change status.
function isTaskOverdue(t) {
  const todayStr = new Date().toISOString().slice(0, 10);
  return t.status !== 'Completed' && t.dueDate && t.dueDate < todayStr;
}

// Mirrors server/routes.js's taskAssigneeIds — reads a task's assignee(s) as
// an array regardless of whether it's a new/edited task (real `assigneeIds`
// list) or an older/auto-created one that only ever had a single
// `assigneeId` (e.g. syncDeadlineFollowUpTask's follow-up task).
function taskAssigneeIdsUi(t) {
  if (Array.isArray(t.assigneeIds)) return t.assigneeIds.filter(Boolean);
  return t.assigneeId ? [t.assigneeId] : [];
}

// The 4 stat tiles above the task table (see renderTasks) — count + tone +
// icon for each bucket, and how to test whether a given task falls into it.
// 'All' isn't included here; it's just "no filter applied" (taskStatusFilter
// === null), same convention as documentsFolderNav's provider filter.
const TASK_STAT_TILES = [
  { key: 'To-Do', label: 'To-Do', tone: 'indigo', icon: 'checklist', test: (t) => t.status === 'To-Do' },
  { key: 'In Progress', label: 'In Progress', tone: 'amber', icon: 'clock', test: (t) => t.status === 'In Progress' },
  { key: 'Completed', label: 'Completed', tone: 'green', icon: 'checkSquare', test: (t) => t.status === 'Completed' },
  { key: 'Overdue', label: 'Overdue', tone: 'rose', icon: 'bell', test: isTaskOverdue },
];

async function renderTasks(content) {
  const tasks = await Api.get('/api/tasks');
  const canCreate = canDo('tasks', 'create');
  const canEdit = canDo('tasks', 'edit');
  const canDelete = canDo('tasks', 'delete');

  const statTilesHtml = `
    <div class="row g-3 mb-3">
      ${TASK_STAT_TILES.map((tile) => {
        const count = tasks.filter(tile.test).length;
        const active = taskStatusFilter === tile.key;
        return `
        <div class="col-6 col-md-3">
          <div class="card stat-card stat-card-clickable${active ? ' stat-card-active' : ''} btn-task-stat" data-key="${tile.key}" role="button" style="cursor:pointer;">
            <div class="card-body">
              <div class="stat-icon tone-${tile.tone}">${Icon(tile.icon)}</div>
              <div class="stat-value">${count}</div>
              <div class="stat-label">${escapeHtml(tile.label)}</div>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  const activeTile = TASK_STAT_TILES.find((tile) => tile.key === taskStatusFilter);
  const filteredTasks = activeTile ? tasks.filter(activeTile.test) : tasks;

  content.innerHTML = listToolbar({ title: 'Task Management', canCreate }) + statTilesHtml + (
    activeTile ? `<div class="mb-2"><button type="button" class="btn btn-sm btn-outline-secondary" id="btnClearTaskFilter">${Icon('x', 'me-1')}Clear filter: ${escapeHtml(activeTile.label)}</button></div>` : ''
  ) + `
    <div class="card stat-card">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead class="table-light"><tr><th>Title</th><th>Type</th><th>Assignee</th><th>Due</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${filteredTasks.map((t) => `
              <tr>
                <td>${escapeHtml(t.title)}${caseName(t.relatedCaseId) ? `<div class="small text-secondary">${escapeHtml(caseName(t.relatedCaseId))}</div>` : ''}</td>
                <td><span class="badge text-bg-light border text-capitalize">${escapeHtml(t.type)}</span></td>
                <td>${escapeHtml((taskAssigneeIdsUi(t).map(userName).join(', ')) || '—')}</td>
                <td class="text-nowrap">${fmtDate(t.dueDate)}</td>
                <td>${badge(t.status)}${isTaskOverdue(t) ? ` ${badge('Overdue')}` : ''}</td>
                <td class="text-end">
                  ${canEdit ? `<button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${t.id}">${Icon('edit')}</button>` : ''}
                  ${canDelete ? `<button class="btn btn-sm btn-outline-danger btn-del" data-id="${t.id}">${Icon('trash')}</button>` : ''}
                </td>
              </tr>`).join('') || `<tr><td colspan="6" class="text-center text-secondary py-3">${activeTile ? `No ${activeTile.label} tasks.` : 'No tasks yet.'}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;

  content.querySelectorAll('.btn-task-stat').forEach((card) => card.addEventListener('click', () => {
    taskStatusFilter = taskStatusFilter === card.dataset.key ? null : card.dataset.key;
    renderTasks(content);
  }));
  const clearFilterBtn = content.querySelector('#btnClearTaskFilter');
  if (clearFilterBtn) clearFilterBtn.addEventListener('click', () => { taskStatusFilter = null; renderTasks(content); });

  const fields = taskFormFields;

  if (canCreate) content.querySelector('#btnCreate').addEventListener('click', () => {
    showFormModal({ title: 'New Task', fields: fields(), initial: { type: 'personal', status: 'To-Do' },
      onSubmit: async (data) => {
        const created = await Api.post('/api/tasks', data);
        if (data.assigneeIds && data.assigneeIds.length) {
          try { await Api.post(`/api/notifications/${created.id}/read`); } catch (e) { /* not applicable */ }
        }
        toast('Task created'); route();
      } });
  });
  content.querySelectorAll('.btn-edit').forEach((btn) => btn.addEventListener('click', () => {
    const item = filteredTasks.find((t) => t.id === btn.dataset.id);
    // The multiselect field needs a real `assigneeIds` array to pre-check
    // the right boxes — older/auto-created tasks only have `assigneeId`,
    // so fall back to wrapping that single value the same way
    // taskAssigneeIdsUi does.
    showFormModal({ title: 'Edit Task', fields: fields(), initial: { ...item, assigneeIds: taskAssigneeIdsUi(item) },
      onSubmit: async (data) => { await Api.put(`/api/tasks/${item.id}`, data); toast('Task updated'); route(); } });
  }));
  content.querySelectorAll('.btn-del').forEach((btn) => btn.addEventListener('click', async () => {
    if (!(await confirmDialog('Delete this task?'))) return;
    await Api.del(`/api/tasks/${btn.dataset.id}`);
    toast('Deleted'); route();
  }));
}

// ---------------------------------------------------------------------------
// Page: Approval Center
// ---------------------------------------------------------------------------
async function renderApprovals(content) {
  const approvals = await Api.get('/api/approvals');
  const canCreate = canDo('approvals', 'create');
  const canApprove = canDo('approvals', 'approve');
  content.innerHTML = listToolbar({ title: 'Approval Center', canCreate }) + `
    <div class="card stat-card">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead class="table-light"><tr><th>Title</th><th>Type</th><th>Requested By</th><th>Reviewer</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${approvals.map((a) => `
              <tr>
                <td>${escapeHtml(a.title)}</td>
                <td><span class="badge text-bg-light border text-capitalize">${escapeHtml(a.type)}</span></td>
                <td>${escapeHtml(userName(a.requestedBy))}</td>
                <td>${escapeHtml(userName(a.reviewerId))}</td>
                <td>${badge(a.status)}</td>
                <td class="text-end">
                  ${canApprove && a.status === 'Pending' && a.reviewerId === State.user.id ? `
                    <button class="btn btn-sm btn-success btn-approve" data-id="${a.id}">${Icon('check')} Approve</button>
                    <button class="btn btn-sm btn-outline-danger btn-reject" data-id="${a.id}">${Icon('x')} Reject</button>
                  ` : `<button class="btn btn-sm btn-outline-secondary btn-view" data-id="${a.id}">View</button>`}
                </td>
              </tr>`).join('') || `<tr><td colspan="6" class="text-center text-secondary py-3">No approval requests yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;

  if (canCreate) content.querySelector('#btnCreate').addEventListener('click', () => {
    showFormModal({
      title: 'Submit Approval Request',
      fields: [
        { name: 'title', label: 'Title', required: true },
        { name: 'type', label: 'Type', type: 'select', options: ['contract', 'document', 'case', 'other'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })), required: true },
        { name: 'reviewerId', label: 'Reviewer', type: 'select', options: State.lookups.users.map((u) => ({ value: u.id, label: u.fullName })), required: true },
      ],
      onSubmit: async (data) => {
        const created = await Api.post('/api/approvals', data);
        notifyReviewer(created);
        toast('Approval request submitted'); route();
      },
    });
  });

  async function notifyReviewer(created) {
    // best-effort; server already stores approval, notification created via a lightweight endpoint is not exposed
    // so we simply rely on dashboard aggregation to surface pending approvals to the reviewer.
  }

  content.querySelectorAll('.btn-approve').forEach((btn) => btn.addEventListener('click', async () => {
    await Api.post(`/api/approvals/${btn.dataset.id}/decide`, { decision: 'approve' });
    toast('Approved'); route();
  }));
  content.querySelectorAll('.btn-reject').forEach((btn) => btn.addEventListener('click', async () => {
    const comment = window.prompt('Reason for rejection (optional):') || '';
    await Api.post(`/api/approvals/${btn.dataset.id}/decide`, { decision: 'reject', comment });
    toast('Rejected'); route();
  }));
  content.querySelectorAll('.btn-view').forEach((btn) => btn.addEventListener('click', () => {
    const item = approvals.find((a) => a.id === btn.dataset.id);
    const commentsHtml = (item.comments || []).map((c) => `<div class="border-bottom py-1"><strong>${escapeHtml(userName(c.by))}:</strong> ${escapeHtml(c.text)} <span class="text-secondary small">(${fmtDateTime(c.at)})</span></div>`).join('') || '<div class="text-secondary">No comments.</div>';
    const modalEl = document.createElement('div');
    modalEl.className = 'modal fade';
    modalEl.innerHTML = `<div class="modal-dialog"><div class="modal-content">
      <div class="modal-header"><h5 class="modal-title">${escapeHtml(item.title)}</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body">
        <p><strong>Status:</strong> ${badge(item.status)}</p>
        <p><strong>Requested by:</strong> ${escapeHtml(userName(item.requestedBy))} &nbsp; <strong>Reviewer:</strong> ${escapeHtml(userName(item.reviewerId))}</p>
        <hr>${commentsHtml}
      </div></div></div>`;
    document.body.appendChild(modalEl);
    new bootstrap.Modal(modalEl).show();
    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
  }));
}

// ---------------------------------------------------------------------------
// Page: Notifications
// ---------------------------------------------------------------------------
async function renderNotifications(content) {
  const list = await Api.get('/api/notifications');
  content.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="mb-0">Notifications</h5>
      <button class="btn btn-sm btn-outline-secondary" id="btnReadAll">Mark all as read</button>
    </div>
    <div class="card stat-card">
      <ul class="list-group list-group-flush">
        ${list.map((n) => `
          <li class="list-group-item d-flex justify-content-between align-items-center ${n.isRead ? '' : 'bg-light'}" data-id="${n.id}">
            <span>${!n.isRead ? '<span class="notif-dot me-2"></span>' : ''}<span class="badge text-bg-light border me-2 text-capitalize">${n.type.replace(/_/g, ' ')}</span>${escapeHtml(n.message)}</span>
            <span class="d-flex align-items-center gap-2">
              <span class="text-secondary small">${fmtDateTime(n.createdAt)}</span>
              ${!n.isRead ? `<button class="btn btn-sm btn-link p-0 btn-mark-read" data-id="${n.id}">Mark read</button>` : ''}
            </span>
          </li>`).join('') || '<li class="list-group-item text-secondary">No notifications.</li>'}
      </ul>
    </div>`;
  content.querySelector('#btnReadAll').addEventListener('click', async () => {
    await Api.post('/api/notifications/read-all');
    refreshNotifBadge();
    route();
  });
  content.querySelectorAll('.btn-mark-read').forEach((btn) => btn.addEventListener('click', async () => {
    await Api.post(`/api/notifications/${btn.dataset.id}/read`);
    refreshNotifBadge();
    route();
  }));
}

// ---------------------------------------------------------------------------
// Page: Knowledge Base
// ---------------------------------------------------------------------------
// A repository of reference material (PAGCOR Guidelines/Circulars, company
// SOPs, application forms, etc.) plus a company-approved FAQ list — see
// server/routes.js's Knowledge Base section for the full rationale. This is
// deliberately just storage/organization (upload or link a source, tag it
// with a category, track version/status) — no AI search over it yet.
const KB_CATEGORY_OPTIONS = [
  'Game Submission', 'Regulatory Framework', 'Application Forms', 'Operational Forms',
  'Game Approval', 'System / Platform', 'Distributor / Reseller',
  'OneDrive / Submission Repository', 'Fees', 'FAQ / Internal SOP',
];
const KB_STATUS_OPTIONS = ['Draft', 'Pending Review', 'Active', 'Archived'];

async function renderKnowledgeBase(content) {
  content.innerHTML = `
    <ul class="nav nav-tabs mb-3" id="kbTabs">
      <li class="nav-item"><button class="nav-link active" data-tab="documents">Documents</button></li>
      <li class="nav-item"><button class="nav-link" data-tab="faqs">FAQ</button></li>
    </ul>
    <div id="kbBody"></div>`;
  const body = content.querySelector('#kbBody');
  async function showTab(tab) {
    content.querySelectorAll('#kbTabs .nav-link').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'documents') return renderKbDocumentsTab(body);
    if (tab === 'faqs') return renderKbFaqsTab(body);
  }
  content.querySelectorAll('#kbTabs .nav-link').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  await showTab('documents');
}

async function renderKbDocumentsTab(body) {
  const docs = await Api.get('/api/kb-documents');
  const canCreate = canDo('knowledgeBase', 'create');
  const canEdit = canDo('knowledgeBase', 'edit');
  const canDelete = canDo('knowledgeBase', 'delete');
  // Newest-updated first, so anything recently added/edited surfaces at the
  // top rather than getting buried under the seeded PAGCOR source pack.
  const sorted = [...docs].sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
  body.innerHTML = listToolbar({ title: 'Knowledge Base — Documents', canCreate }) + `
    <div class="card stat-card">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead class="table-light"><tr><th>Title</th><th>Category</th><th>Type</th><th>Version</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${sorted.map((d) => `
              <tr>
                <td>
                  ${escapeHtml(d.title)}
                  ${d.notes ? `<div class="small text-secondary">${escapeHtml(d.notes)}</div>` : ''}
                </td>
                <td>${escapeHtml(d.category || '—')}</td>
                <td class="text-nowrap">
                  ${d.documentType === 'External Link'
                    ? (d.sourceUrl ? `<a href="${escapeHtml(d.sourceUrl)}" target="_blank" rel="noopener">${Icon('file', 'me-1')}Link</a>` : 'External Link')
                    : (d.filePath ? `<a href="#" class="btn-kb-download" data-id="${d.id}">${Icon('download', 'me-1')}${escapeHtml(d.fileName || 'File')}</a>` : 'Uploaded File')}
                </td>
                <td>${escapeHtml(d.version || '—')}</td>
                <td>${badge(d.status)}</td>
                <td class="text-end">
                  ${canEdit ? `<button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${d.id}">${Icon('edit')}</button>` : ''}
                  ${canDelete ? `<button class="btn btn-sm btn-outline-danger btn-del" data-id="${d.id}">${Icon('trash')}</button>` : ''}
                </td>
              </tr>`).join('') || `<tr><td colspan="6" class="text-center text-secondary py-3">No documents yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;

  const fields = () => ([
    { name: 'title', label: 'Title', required: true },
    { name: 'category', label: 'Category', type: 'select', options: KB_CATEGORY_OPTIONS.map((v) => ({ value: v, label: v })), required: true },
    { name: 'documentType', label: 'Source Type', type: 'select', options: [{ value: 'External Link', label: 'External Link (e.g. a PAGCOR web page/PDF URL)' }, { value: 'Uploaded File', label: 'Uploaded File' }], required: true },
    { name: 'sourceUrl', label: 'Source URL', placeholder: 'https://www.pagcor.ph/...', section: 'externalLink' },
    { name: 'fileName', label: 'File Upload', type: 'file', section: 'uploadedFile' },
    { name: 'version', label: 'Version (optional)', placeholder: 'e.g. Rev. No. 3' },
    { name: 'revisionNumber', label: 'Revision Number (optional)' },
    { name: 'publicationDate', label: 'Publication Date (optional)', type: 'date' },
    { name: 'effectivityDate', label: 'Effectivity Date (optional)', type: 'date' },
    { name: 'status', label: 'Status', type: 'select', options: KB_STATUS_OPTIONS.map((v) => ({ value: v, label: v })), required: true },
    { name: 'supersedesDocumentId', label: 'Supersedes (optional)', type: 'select', allowEmpty: true, options: docs.map((d) => ({ value: d.id, label: d.title })) },
    { name: 'notes', label: 'Notes (optional)', type: 'textarea' },
  ]);

  // documentType drives whether the Source URL or File Upload field is
  // relevant — showFormModal's section/controlsSection mechanism is built
  // for a checkbox toggle, not a 2-way select, so this wires the same
  // show/hide behavior by hand off the select's change event instead.
  function wireSourceTypeToggle(modalRoot, initialType) {
    const select = modalRoot.querySelector('[name="documentType"]');
    if (!select) return;
    const apply = (type) => {
      modalRoot.querySelectorAll('[data-section="externalLink"]').forEach((el) => { el.style.display = type === 'External Link' ? '' : 'none'; });
      modalRoot.querySelectorAll('[data-section="uploadedFile"]').forEach((el) => { el.style.display = type === 'Uploaded File' ? '' : 'none'; });
    };
    apply(initialType || select.value);
    select.addEventListener('change', () => apply(select.value));
  }

  if (canCreate) {
    content.querySelector('#btnCreate').addEventListener('click', () => {
      showFormModal({
        title: 'New Knowledge Base Document', fields: fields(), initial: { documentType: 'External Link', status: 'Draft' },
        onSubmit: async (data) => { await Api.post('/api/kb-documents', data); toast('Document added'); renderKbDocumentsTab(body); },
      });
      setTimeout(() => wireSourceTypeToggle(document.getElementById('formModal'), 'External Link'), 0);
    });
  }
  body.querySelectorAll('.btn-edit').forEach((btn) => btn.addEventListener('click', () => {
    const item = docs.find((d) => d.id === btn.dataset.id);
    showFormModal({
      title: 'Edit Knowledge Base Document', fields: fields(), initial: item,
      onSubmit: async (data) => { await Api.put(`/api/kb-documents/${item.id}`, data); toast('Document updated'); renderKbDocumentsTab(body); },
    });
    setTimeout(() => wireSourceTypeToggle(document.getElementById('formModal'), item.documentType), 0);
  }));
  body.querySelectorAll('.btn-del').forEach((btn) => btn.addEventListener('click', async () => {
    if (!(await confirmDialog('Delete this document?'))) return;
    await Api.del(`/api/kb-documents/${btn.dataset.id}`);
    toast('Document deleted');
    renderKbDocumentsTab(body);
  }));
  body.querySelectorAll('.btn-kb-download').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    downloadAuthedFile(`/api/kb-documents/${a.dataset.id}/download`, docs.find((d) => d.id === a.dataset.id)?.fileName || 'file');
  }));
}

async function renderKbFaqsTab(body) {
  const faqs = await Api.get('/api/kb-faqs');
  const canCreate = canDo('knowledgeBase', 'create');
  const canEdit = canDo('knowledgeBase', 'edit');
  const canDelete = canDo('knowledgeBase', 'delete');
  body.innerHTML = listToolbar({ title: 'Knowledge Base — FAQ', canCreate }) + `
    <div class="card stat-card"><div class="list-group list-group-flush">
      ${faqs.map((f) => `
        <div class="list-group-item">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div>
              <div class="fw-semibold">${escapeHtml(f.question)}</div>
              <div class="small text-secondary mb-1">${escapeHtml(f.category || '—')}</div>
              <div>${escapeHtml(f.answer)}</div>
            </div>
            <div class="text-end text-nowrap">
              ${badge(f.status)}
              <div class="mt-2">
                ${canEdit ? `<button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${f.id}">${Icon('edit')}</button>` : ''}
                ${canDelete ? `<button class="btn btn-sm btn-outline-danger btn-del" data-id="${f.id}">${Icon('trash')}</button>` : ''}
              </div>
            </div>
          </div>
        </div>`).join('') || '<div class="list-group-item text-secondary">No FAQ entries yet.</div>'}
    </div></div>`;

  const fields = () => ([
    { name: 'question', label: 'Question', required: true },
    { name: 'answer', label: 'Answer', type: 'textarea', required: true },
    { name: 'category', label: 'Category', type: 'select', options: KB_CATEGORY_OPTIONS.map((v) => ({ value: v, label: v })), required: true },
    { name: 'status', label: 'Status', type: 'select', options: KB_STATUS_OPTIONS.map((v) => ({ value: v, label: v })), required: true },
  ]);
  if (canCreate) {
    body.querySelector('#btnCreate').addEventListener('click', () => {
      showFormModal({
        title: 'New FAQ Entry', fields: fields(), initial: { status: 'Draft' },
        onSubmit: async (data) => { await Api.post('/api/kb-faqs', data); toast('FAQ added'); renderKbFaqsTab(body); },
      });
    });
  }
  body.querySelectorAll('.btn-edit').forEach((btn) => btn.addEventListener('click', () => {
    const item = faqs.find((f) => f.id === btn.dataset.id);
    showFormModal({
      title: 'Edit FAQ Entry', fields: fields(), initial: item,
      onSubmit: async (data) => { await Api.put(`/api/kb-faqs/${item.id}`, data); toast('FAQ updated'); renderKbFaqsTab(body); },
    });
  }));
  body.querySelectorAll('.btn-del').forEach((btn) => btn.addEventListener('click', async () => {
    if (!(await confirmDialog('Delete this FAQ entry?'))) return;
    await Api.del(`/api/kb-faqs/${btn.dataset.id}`);
    toast('FAQ deleted');
    renderKbFaqsTab(body);
  }));
}

// ---------------------------------------------------------------------------
// Page: Settings (Users / Roles / Departments)
// ---------------------------------------------------------------------------
async function renderSettings(content) {
  content.innerHTML = `
    <ul class="nav nav-tabs mb-3" id="settingsTabs">
      <li class="nav-item"><button class="nav-link active" data-tab="users">Users</button></li>
      <li class="nav-item"><button class="nav-link" data-tab="roles">Roles &amp; Permissions</button></li>
      <li class="nav-item"><button class="nav-link" data-tab="departments">Departments</button></li>
      <li class="nav-item"><button class="nav-link" data-tab="notifications">Notification Settings</button></li>
      <li class="nav-item"><button class="nav-link" data-tab="submission">Submission Settings</button></li>
      <li class="nav-item"><button class="nav-link" data-tab="telegram">Telegram Notifications</button></li>
      <li class="nav-item"><button class="nav-link" data-tab="checklist">Required Document Settings</button></li>
    </ul>
    <div id="settingsBody"></div>`;
  const body = content.querySelector('#settingsBody');
  async function showTab(tab) {
    content.querySelectorAll('#settingsTabs .nav-link').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'users') return renderUsersTab(body);
    if (tab === 'roles') return renderRolesTab(body);
    if (tab === 'departments') return renderDepartmentsTab(body);
    if (tab === 'notifications') return renderNotificationSettingsTab(body);
    if (tab === 'submission') return renderSubmissionSettingsTab(body);
    if (tab === 'telegram') return renderTelegramSettingsTab(body);
    if (tab === 'checklist') return renderChecklistSettingsTab(body);
  }
  content.querySelectorAll('#settingsTabs .nav-link').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  await showTab('users');
}

async function renderUsersTab(body) {
  const [users, roles, depts] = await Promise.all([Api.get('/api/users'), Api.get('/api/roles'), Api.get('/api/departments')]);
  const canCreate = canDo('settings', 'create');
  const canEdit = canDo('settings', 'edit');
  const canDelete = canDo('settings', 'delete');
  body.innerHTML = listToolbar({ title: 'Users', canCreate }) + `
    <div class="card stat-card"><div class="table-responsive"><table class="table table-hover mb-0">
      <thead class="table-light"><tr><th>Username</th><th>Full Name</th><th>Email</th><th>Department</th><th>Role</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${users.map((u) => `<tr>
          <td>${escapeHtml(u.username)}</td><td>${escapeHtml(u.fullName)}</td><td>${escapeHtml(u.email)}</td>
          <td>${escapeHtml((depts.find((d) => d.id === u.departmentId) || {}).name || '—')}</td>
          <td>${escapeHtml((roles.find((r) => r.id === u.roleId) || {}).name || '—')}</td>
          <td><span class="badge ${u.status === 'active' ? 'text-bg-success' : 'text-bg-secondary'}">${escapeHtml(u.status)}</span></td>
          <td class="text-end">
            ${canEdit ? `<button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${u.id}">${Icon('edit')}</button>` : ''}
            ${canDelete ? `<button class="btn btn-sm btn-outline-danger btn-del" data-id="${u.id}">${Icon('trash')}</button>` : ''}
          </td></tr>`).join('')}
      </tbody></table></div></div>`;

  const fields = (isNew) => [
    { name: 'username', label: 'Username', required: true },
    { name: 'fullName', label: 'Full Name', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'departmentId', label: 'Department', type: 'select', options: depts.map((d) => ({ value: d.id, label: d.name })) },
    { name: 'roleId', label: 'Role', type: 'select', options: roles.map((r) => ({ value: r.id, label: r.name })), required: true },
    { name: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
    // Added 2026-08-18 — lets follow-up reminders (see server/routes.js's
    // checkAndSendFollowUpReminders) be delivered to THIS user's own
    // Telegram, instead of everyone sharing one reminder email address.
    // To get this: message the Legal Genie bot on Telegram directly (search
    // for it by the username Tiffany set up with @BotFather), send it any
    // message (e.g. /start), then visit
    // https://api.telegram.org/bot<token>/getUpdates in a browser — look for
    // "chat":{"id": ...} under your own message. A personal chat ID is a
    // plain positive number (unlike a group's, which is negative).
    { name: 'telegramChatId', label: 'Telegram Chat ID (optional — for follow-up reminders; see Settings > Notification Settings for how to get it)' },
    { name: 'password', label: isNew ? 'Temporary Password' : 'Reset Password (leave blank to keep current)' },
  ];
  if (canCreate) body.querySelector('#btnCreate').addEventListener('click', () => {
    showFormModal({ title: 'New User', fields: fields(true), initial: { status: 'active' },
      onSubmit: async (data) => { await Api.post('/api/users', data); toast('User created'); renderUsersTab(body); } });
  });
  body.querySelectorAll('.btn-edit').forEach((btn) => btn.addEventListener('click', () => {
    const item = users.find((u) => u.id === btn.dataset.id);
    showFormModal({ title: 'Edit User', fields: fields(false), initial: item,
      onSubmit: async (data) => { await Api.put(`/api/users/${item.id}`, data); toast('User updated'); renderUsersTab(body); } });
  }));
  body.querySelectorAll('.btn-del').forEach((btn) => btn.addEventListener('click', async () => {
    if (!(await confirmDialog('Delete this user?'))) return;
    await Api.del(`/api/users/${btn.dataset.id}`);
    toast('Deleted'); renderUsersTab(body);
  }));
}

function permissionBadgeHtml(p) {
  const marks = ['view', 'create', 'edit', 'delete', 'approve'].filter((a) => p[a]).map((a) => a[0].toUpperCase()).join('');
  if (!marks) return '<span class="text-secondary">—</span>';
  let tone = 'neutral';
  if (p.delete) tone = 'success';
  else if (p.create || p.edit) tone = 'info';
  else if (p.view) tone = 'neutral';
  return `<span class="badge badge-soft-${tone} perm-badge">${marks}</span>`;
}

async function renderRolesTab(body) {
  const roles = await Api.get('/api/roles');
  const canEdit = canDo('settings', 'edit');
  const modules = [
    { key: 'dashboard', label: 'Dashboard' }, { key: 'cases', label: 'Cases' },
    { key: 'documents', label: 'Documents' },
    { key: 'tasks', label: 'Tasks' }, { key: 'approvals', label: 'Approvals' },
    { key: 'notifications', label: 'Notifications' }, { key: 'knowledgeBase', label: 'Knowledge Base' },
    { key: 'settings', label: 'Settings' },
  ];
  body.innerHTML = `<div class="card stat-card"><div class="table-responsive"><table class="table mb-0 roles-perm-table">
    <thead class="table-light"><tr><th>Role</th>${modules.map((m) => `<th class="text-center">${m.label}</th>`).join('')}</tr></thead>
    <tbody>
      ${roles.map((r) => `<tr>
        <td class="fw-semibold">${escapeHtml(r.name)}</td>
        ${modules.map((m) => {
          const p = r.name === 'Admin' ? { view: true, create: true, edit: true, delete: true, approve: true } : ((r.permissions || {})[m.key] || {});
          return `<td class="text-center">${permissionBadgeHtml(p)}</td>`;
        }).join('')}
      </tr>`).join('')}
    </tbody></table></div>
    <div class="card-footer small text-secondary">
      <span class="badge badge-soft-success perm-badge">VCEDA</span> full access &nbsp;
      <span class="badge badge-soft-info perm-badge">VCE</span> can create/edit &nbsp;
      <span class="badge badge-soft-neutral perm-badge">V</span> view only &nbsp;
      <span class="text-secondary">—</span> no access
      <br>V=View, C=Create, E=Edit, D=Delete, A=Approve. Admin role always has full access.${canEdit ? ' Contact your system administrator to adjust granular permissions.' : ''}
    </div>
    </div>`;
}

async function renderDepartmentsTab(body) {
  const depts = await Api.get('/api/departments');
  const canCreate = canDo('settings', 'create');
  const canEdit = canDo('settings', 'edit');
  const canDelete = canDo('settings', 'delete');
  body.innerHTML = listToolbar({ title: 'Departments', canCreate }) + `
    <div class="card stat-card"><ul class="list-group list-group-flush">
      ${depts.map((d) => `<li class="list-group-item d-flex justify-content-between align-items-center">
        ${escapeHtml(d.name)}
        <span>
          ${canEdit ? `<button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${d.id}">${Icon('edit')}</button>` : ''}
          ${canDelete ? `<button class="btn btn-sm btn-outline-danger btn-del" data-id="${d.id}">${Icon('trash')}</button>` : ''}
        </span></li>`).join('') || '<li class="list-group-item text-secondary">No departments yet.</li>'}
    </ul></div>`;
  if (canCreate) body.querySelector('#btnCreate').addEventListener('click', () => {
    showFormModal({ title: 'New Department', fields: [{ name: 'name', label: 'Name', required: true }],
      onSubmit: async (data) => { await Api.post('/api/departments', data); toast('Created'); renderDepartmentsTab(body); } });
  });
  body.querySelectorAll('.btn-edit').forEach((btn) => btn.addEventListener('click', () => {
    const item = depts.find((d) => d.id === btn.dataset.id);
    showFormModal({ title: 'Edit Department', fields: [{ name: 'name', label: 'Name', required: true }], initial: item,
      onSubmit: async (data) => { await Api.put(`/api/departments/${item.id}`, data); toast('Updated'); renderDepartmentsTab(body); } });
  }));
  body.querySelectorAll('.btn-del').forEach((btn) => btn.addEventListener('click', async () => {
    if (!(await confirmDialog('Delete this department?'))) return;
    await Api.del(`/api/departments/${btn.dataset.id}`);
    toast('Deleted'); renderDepartmentsTab(body);
  }));
}

// Settings > Notification Settings — toggles which in-app notifications the
// system actually sends (see server/routes.js's notifyCaseStageChange /
// notifyTaskAssignee / the approval-decision notify call, all gated by
// these same three keys). All three default to on, matching how the system
// has always behaved.
async function renderNotificationSettingsTab(body) {
  const settings = await Api.get('/api/settings');
  const canEdit = canDo('settings', 'edit');
  const n = settings.notifications || {};
  const rows = [
    { key: 'notifyOnApprovalDecision', label: 'Notify on Approval Decision', hint: 'Notify the requester when their approval request is approved or rejected.' },
    { key: 'notifyOnTaskAssignment', label: 'Notify on Task Assignment', hint: 'Notify a user when they are assigned (or reassigned) to a task.' },
    { key: 'notifyOnCaseStageChange', label: 'Notify on Case Status Change', hint: 'Notify a case\'s Owner when its PAGCOR Stage changes.' },
    { key: 'notifyOnFollowUpDueTelegram', label: 'Telegram Me on Follow-up Due Date', hint: 'Send a Telegram message on the day an auto-created follow-up reminder comes due — sent to the follow-up task\'s Assignee, using the "Telegram Chat ID" set on their own User record (Settings > Users). Setup: message the Legal Genie bot on Telegram, send it any message (e.g. /start), then visit https://api.telegram.org/bot<token>/getUpdates in a browser and look for "chat":{"id": ...} under your own message — enter that number as your Telegram Chat ID.' },
  ];
  body.innerHTML = `
    <div class="card stat-card"><div class="card-body">
      <h6 class="mb-3" style="font-size:1.05rem;">Notification Settings</h6>
      <form id="notificationSettingsForm">
        ${rows.map((r) => `
          <div class="form-check form-switch mb-3">
            <input class="form-check-input" type="checkbox" role="switch" id="chk-${r.key}" ${n[r.key] !== false ? 'checked' : ''} ${canEdit ? '' : 'disabled'}>
            <label class="form-check-label" for="chk-${r.key}">${escapeHtml(r.label)}</label>
            <div class="small text-secondary">${escapeHtml(r.hint)}</div>
          </div>`).join('')}
        ${canEdit ? `<button type="submit" class="btn btn-primary">Save</button>` : '<div class="small text-secondary">You do not have permission to edit settings.</div>'}
      </form>
    </div></div>`;
  if (!canEdit) return;
  body.querySelector('#notificationSettingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const notifications = {};
    rows.forEach((r) => { notifications[r.key] = body.querySelector(`#chk-${r.key}`).checked; });
    try {
      await Api.put('/api/settings', { notifications });
      toast('Notification settings saved');
    } catch (err) {
      toast(err.message, 'danger');
    }
  });
}

// Settings > Submission Settings — the follow-up window used both to
// auto-create each case's "follow up N days later" Task Management
// reminder (see server/routes.js's syncDeadlineFollowUpTask) and to flag
// games stuck in a PAGCOR stage on the Dashboard (see
// /api/dashboard/summary's followUps).
async function renderSubmissionSettingsTab(body) {
  const settings = await Api.get('/api/settings');
  const canEdit = canDo('settings', 'edit');
  body.innerHTML = `
    <div class="card stat-card"><div class="card-body">
      <h6 class="mb-3" style="font-size:1.05rem;">Submission Settings</h6>
      <form id="submissionSettingsForm">
        <div class="mb-3" style="max-width:320px;">
          <label class="form-label">Follow-up window (days)</label>
          <input type="number" min="1" class="form-control" id="followUpDays" value="${settings.followUpDays || 30}" ${canEdit ? '' : 'disabled'}>
          <div class="small text-secondary mt-1">How many PAGCOR business days (Mon-Thu — PAGCOR isn't open Fri/Sat/Sun) after a case's Submit Date to automatically create a follow-up reminder. Also how many calendar days a case can sit in "For Review" / "On Process" before it's flagged on the Dashboard.</div>
        </div>
        ${canEdit ? `<button type="submit" class="btn btn-primary">Save</button>` : '<div class="small text-secondary">You do not have permission to edit settings.</div>'}
      </form>
    </div></div>`;
  if (!canEdit) return;
  body.querySelector('#submissionSettingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const followUpDays = Number(body.querySelector('#followUpDays').value);
    try {
      await Api.put('/api/settings', { followUpDays });
      toast('Submission settings saved');
    } catch (err) {
      toast(err.message, 'danger');
    }
  });
}

// Settings > Telegram Notifications — added 2026-08-12 at Tiffany's
// request. PAGCOR Stage itself has to stay a manual field (it comes from
// actually contacting PAGCOR — nothing in this app can know it
// automatically), but once someone here DOES update it, this lets the
// system post that update straight into the case's Provider's own
// Telegram group automatically, instead of Tiffany typing the same update
// out by hand in Telegram every time. Requires TELEGRAM_BOT_TOKEN to be
// configured server-side and the bot to already be a member of each group
// entered below — see server/telegram.js for the one-time setup steps.
// Provider isn't a fixed lookup table anywhere else in this app (it's a
// free-text field on cases), so the Provider -> chat ID mapping here is
// just a free-form add/remove list rather than a dropdown.
async function renderTelegramSettingsTab(body) {
  const settings = await Api.get('/api/settings');
  const canEdit = canDo('settings', 'edit');
  const n = settings.notifications || {};
  let mappings = Object.entries(settings.providerTelegramChatIds || {}).map(([provider, chatId]) => ({ provider, chatId }));
  if (!mappings.length) mappings = [{ provider: '', chatId: '' }];

  const rowsHtml = () => mappings.map((m, i) => `
    <div class="row g-2 mb-2 tg-mapping-row" data-idx="${i}">
      <div class="col-5"><input class="form-control form-control-sm tg-provider" placeholder="Provider (e.g. FC)" value="${escapeHtml(m.provider)}" ${canEdit ? '' : 'disabled'}></div>
      <div class="col-5"><input class="form-control form-control-sm tg-chatid" placeholder="Telegram group Chat ID (e.g. -1001234567890)" value="${escapeHtml(m.chatId)}" ${canEdit ? '' : 'disabled'}></div>
      <div class="col-2">${canEdit ? `<button type="button" class="btn btn-sm btn-outline-danger btn-remove-tg-row" data-idx="${i}">${Icon('trash')}</button>` : ''}</div>
    </div>`).join('');

  body.innerHTML = `
    <div class="card stat-card"><div class="card-body">
      <h6 class="mb-2" style="font-size:1.05rem;">Telegram Notifications</h6>
      <div class="small text-secondary mb-3">When a case's PAGCOR Stage changes, automatically post an update into that Provider's Telegram group — one row per Provider below. Requires a Telegram Bot to already be set up and added to each group (see README/ask your developer); PAGCOR Stage itself still has to be updated here by hand, since only contacting PAGCOR can confirm it.</div>
      <div class="form-check form-switch mb-3">
        <input class="form-check-input" type="checkbox" role="switch" id="chk-telegramEnabled" ${n.notifyTelegramOnCaseStageChange !== false ? 'checked' : ''} ${canEdit ? '' : 'disabled'}>
        <label class="form-check-label" for="chk-telegramEnabled">Send Telegram message on Case Status Change</label>
      </div>
      <label class="form-label small text-secondary mb-1">Provider &rarr; Telegram group</label>
      <div id="tgMappingRows">${rowsHtml()}</div>
      ${canEdit ? `<button type="button" class="btn btn-sm btn-outline-secondary mb-3" id="btnAddTgRow">${Icon('plus', 'me-1')}Add Provider</button><br>` : ''}
      ${canEdit ? `<button type="button" class="btn btn-primary" id="btnSaveTg">Save</button>` : '<div class="small text-secondary">You do not have permission to edit settings.</div>'}
    </div></div>`;

  if (!canEdit) return;

  function readRowsFromDom() {
    mappings = Array.from(body.querySelectorAll('.tg-mapping-row')).map((rowEl) => ({
      provider: rowEl.querySelector('.tg-provider').value,
      chatId: rowEl.querySelector('.tg-chatid').value,
    }));
  }
  function wireRows() {
    body.querySelectorAll('.btn-remove-tg-row').forEach((btn) => btn.addEventListener('click', () => {
      readRowsFromDom();
      mappings.splice(Number(btn.dataset.idx), 1);
      if (!mappings.length) mappings = [{ provider: '', chatId: '' }];
      body.querySelector('#tgMappingRows').innerHTML = rowsHtml();
      wireRows();
    }));
  }
  wireRows();
  body.querySelector('#btnAddTgRow').addEventListener('click', () => {
    readRowsFromDom();
    mappings.push({ provider: '', chatId: '' });
    body.querySelector('#tgMappingRows').innerHTML = rowsHtml();
    wireRows();
  });
  body.querySelector('#btnSaveTg').addEventListener('click', async () => {
    readRowsFromDom();
    const providerTelegramChatIds = {};
    mappings.forEach((m) => { if (m.provider.trim() && m.chatId.trim()) providerTelegramChatIds[m.provider.trim()] = m.chatId.trim(); });
    const notifications = { ...n, notifyTelegramOnCaseStageChange: body.querySelector('#chk-telegramEnabled').checked };
    try {
      await Api.put('/api/settings', { providerTelegramChatIds, notifications });
      toast('Telegram settings saved');
    } catch (err) {
      toast(err.message, 'danger');
    }
  });
}

// Settings > Required Document Settings — added 2026-08-12 (second round,
// same day as the Telegram Notifications tab above). The PAGCOR Checklist
// itself was brought back earlier that day as a fixed 3-item list (Game
// Manual / Parameter / RTP Certification), with this customization tab
// deliberately deferred since it wasn't asked for yet — now it is, so the
// items themselves are editable here instead of fixed in code. Same
// add/remove-row list pattern as renderTelegramSettingsTab just above,
// except each row is just a single Label — the object key each item saves
// under (case.checklist.<key>) is generated/preserved server-side (see
// slugifyChecklistKey in routes.js) so renaming a label in place doesn't
// orphan already-saved checkbox state under the old key. The Download All
// Documents gate on the case detail page still relies purely on the AI
// Parameter Consistency Check, not this checklist — see server/pagcor.js's
// header comment for the full history.
async function renderChecklistSettingsTab(body) {
  const canEdit = canDo('settings', 'edit');
  // Read straight from the live PAGCOR_CHECKLIST_ITEMS (set at boot from
  // /api/lookups, kept in sync locally after every save below) rather than
  // re-fetching Settings, since this list is exactly that.
  let items = PAGCOR_CHECKLIST_ITEMS.map((i) => ({ key: i.key, label: i.label }));
  if (!items.length) items = [{ key: '', label: '' }];

  const rowsHtml = () => items.map((i, idx) => `
    <div class="row g-2 mb-2 checklist-item-row" data-idx="${idx}" data-key="${escapeHtml(i.key)}">
      <div class="col-9"><input class="form-control form-control-sm ci-label" placeholder="e.g. Game Manual" value="${escapeHtml(i.label)}" ${canEdit ? '' : 'disabled'}></div>
      <div class="col-3">${canEdit ? `<button type="button" class="btn btn-sm btn-outline-danger btn-remove-ci-row" data-idx="${idx}">${Icon('trash')}</button>` : ''}</div>
    </div>`).join('');

  body.innerHTML = `
    <div class="card stat-card"><div class="card-body">
      <h6 class="mb-2" style="font-size:1.05rem;">Required Document Settings</h6>
      <div class="small text-secondary mb-3">The PAGCOR Checklist items tracked on every case with a Provider set (the checklist panel at the bottom of a case's detail page, and the checklist icon on each Case Management row). Add, rename, or remove items as your tracking needs change — Excel/CSV import will automatically match a spreadsheet column against an item's label (e.g. a column named "Game Manual" auto-fills the "Game Manual" item). This does not affect the separate AI Parameter Consistency Check, which always checks its own fixed set of parameters and document types.</div>
      <label class="form-label small text-secondary mb-1">Checklist items</label>
      <div id="ciRows">${rowsHtml()}</div>
      ${canEdit ? `<button type="button" class="btn btn-sm btn-outline-secondary mb-3" id="btnAddCiRow">${Icon('plus', 'me-1')}Add Item</button><br>` : ''}
      ${canEdit ? `<button type="button" class="btn btn-primary" id="btnSaveCi">Save</button>` : '<div class="small text-secondary">You do not have permission to edit settings.</div>'}
    </div></div>`;

  if (!canEdit) return;

  function readRowsFromDom() {
    items = Array.from(body.querySelectorAll('.checklist-item-row')).map((rowEl) => ({
      key: rowEl.dataset.key || '',
      label: rowEl.querySelector('.ci-label').value,
    }));
  }
  function wireRows() {
    body.querySelectorAll('.btn-remove-ci-row').forEach((btn) => btn.addEventListener('click', () => {
      readRowsFromDom();
      items.splice(Number(btn.dataset.idx), 1);
      if (!items.length) items = [{ key: '', label: '' }];
      body.querySelector('#ciRows').innerHTML = rowsHtml();
      wireRows();
    }));
  }
  wireRows();
  body.querySelector('#btnAddCiRow').addEventListener('click', () => {
    readRowsFromDom();
    items.push({ key: '', label: '' });
    body.querySelector('#ciRows').innerHTML = rowsHtml();
    wireRows();
  });
  body.querySelector('#btnSaveCi').addEventListener('click', async () => {
    readRowsFromDom();
    const checklistItems = items.filter((i) => i.label.trim()).map((i) => ({ key: i.key, label: i.label.trim() }));
    try {
      const updated = await Api.put('/api/settings', { checklistItems });
      PAGCOR_CHECKLIST_ITEMS = updated.checklistItems || [];
      toast('Required Document Settings saved');
      renderChecklistSettingsTab(body);
    } catch (err) {
      toast(err.message, 'danger');
    }
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot(skipTokenCheck) {
  if (!Api.token) return renderLogin();
  try {
    if (!State.user || skipTokenCheck) {
      const me = await Api.get('/api/auth/me');
      State.user = me.user;
      State.role = me.role;
    }
    State.lookups = await Api.get('/api/lookups');
    PAGCOR_CHECKLIST_ITEMS = State.lookups.checklistItems || [];
    renderShell();
    await route();
  } catch (err) {
    Api.setToken(null);
    renderLogin();
  }
}

boot();
