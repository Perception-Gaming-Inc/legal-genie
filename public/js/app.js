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

// ---------------------------------------------------------------------------
// Global state
// ---------------------------------------------------------------------------
const State = { user: null, role: null, lookups: null, assistant: { turns: [] } };

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'assistant', label: 'AI Assistant', icon: 'sparkle' },
  { key: 'cases', label: 'Case Management', icon: 'briefcase' },
  { key: 'contracts', label: 'Contract Management', icon: 'file' },
  { key: 'documents', label: 'Document Center', icon: 'folder' },
  { key: 'tasks', label: 'Task Management', icon: 'checklist' },
  { key: 'approvals', label: 'Approval Center', icon: 'checkSquare' },
  { key: 'notifications', label: 'Notifications', icon: 'bell' },
  { key: 'settings', label: 'Settings', icon: 'gear' },
];

// ---------------------------------------------------------------------------
// PAGCOR-domain constants (Case Management / Document Center extensions)
// ---------------------------------------------------------------------------
// Mirrors server/pagcor.js exactly — kept as a separate copy here because
// this is plain browser JS with no build step to share a module with the
// server. If you change the wording/keys in server/pagcor.js, update this
// copy too.
const PAGCOR_STAGE_OPTIONS = [
  'Not Started', 'Preparing Documents', 'Submitted to PAGCOR', 'Under PAGCOR Review', 'LOA Approved', 'Rejected',
];
// The normal, linear left-to-right pipeline a game submission moves through.
// 'Rejected' is deliberately excluded here — it's an off-path terminal state
// (a submission can be rejected from any point in the pipeline), not a
// further step along it, so it gets its own distinct visual treatment in
// pagcorStageStepperHtml() below rather than a 6th step on the bar.
const PAGCOR_LINEAR_STAGES = [
  'Not Started', 'Preparing Documents', 'Submitted to PAGCOR', 'Under PAGCOR Review', 'LOA Approved',
];
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
function pagcorStageStepperHtml(stage, canEdit) {
  if (stage === 'Rejected') {
    return `
      <div class="pagcor-stepper pagcor-stepper-rejected d-flex align-items-center gap-2">
        ${Icon('x', 'text-danger')}
        <span class="fw-semibold text-danger">Rejected</span>
        <span class="small text-secondary">This game submission did not pass PAGCOR review.</span>
      </div>`;
  }
  const idx = Math.max(0, PAGCOR_LINEAR_STAGES.indexOf(stage || 'Not Started'));
  return `
    <div class="pagcor-stepper d-flex align-items-start">
      ${PAGCOR_LINEAR_STAGES.map((s, i) => {
        const state = i < idx ? 'done' : (i === idx ? 'current' : 'upcoming');
        const connector = i > 0 ? `<div class="pagcor-step-connector ${i <= idx ? 'done' : ''}"></div>` : '';
        const clickable = canEdit && i !== idx;
        return `${connector}
        <div class="pagcor-step pagcor-step-${state}${clickable ? ' pagcor-step-clickable' : ''}" ${clickable ? `data-stage="${escapeHtml(s)}"` : ''} title="${clickable ? `點擊設為「${escapeHtml(s)}」` : escapeHtml(s)}">
          <div class="pagcor-step-dot">${state === 'done' ? Icon('check') : (i + 1)}</div>
          <div class="pagcor-step-label">${escapeHtml(s)}</div>
        </div>`;
      }).join('')}
    </div>`;
}
const PAGCOR_CHECKLIST_ITEMS = [
  { key: 'gameManual', label: 'Game Manual' },
  { key: 'parameter', label: 'Parameter' },
  { key: 'rtpCertification', label: 'RTP Certification' },
];
const REPORT_TYPE_OPTIONS = [
  'Math Model Report', 'RNG Test Report', 'Game Rules / Paytable', 'PAGCOR Submission Letter', 'Letter of Approval (LOA)', 'Other',
];
const GAME_TYPE_OPTIONS = ['Slots', 'Arcade-Type', 'Table', 'eBingo', 'Other'];
const YES_NO_OPTIONS = ['Yes', 'No'];

function canView(moduleKey) {
  // AI Assistant is a cross-cutting utility, not a data module with its own
  // row in the roles table (existing, already-seeded roles predate this
  // feature and have no 'assistant' permission entry at all) — so it's
  // always visible to any signed-in user. The write actions it can propose
  // (create_case/create_contract/create_task) are still individually
  // permission-checked server-side against the real module, same as the
  // normal forms — this bypass only affects whether the nav link shows up.
  if (moduleKey === 'assistant') return true;
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
function fmtDate(iso) {
  if (!iso) return '—';
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
  Overdue: 'danger', Rejected: 'danger', 'Due Soon': 'warning', 'Not Started': 'neutral',
  Expired: 'neutral', Terminated: 'neutral', Draft: 'neutral',
  'Preparing Documents': 'neutral', 'Submitted to PAGCOR': 'info', 'Under PAGCOR Review': 'warning', 'LOA Approved': 'success',
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
function contractName(id) {
  const c = (State.lookups.contracts || []).find((x) => x.id === id);
  return c ? `${c.contractNumber} – ${c.title}` : null;
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

function aiAssistHtml() {
  return `
    <div class="ai-assist border rounded p-3 mb-3 bg-light">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <strong class="d-flex align-items-center gap-1">${sparkleMark()} AI 智慧填寫</strong>
        <span class="small text-secondary">選填 — 可貼文字，也可上傳檔案</span>
      </div>
      <textarea class="form-control form-control-sm mb-2" id="aiAssistText" rows="3" placeholder="貼上 email、案件說明、合約內容…（選填）"></textarea>
      <div class="d-flex align-items-center gap-2">
        <input type="file" class="form-control form-control-sm" id="aiAssistFile" accept=".pdf,image/*,.txt">
        <button type="button" class="btn btn-sm btn-outline-primary text-nowrap" id="aiAssistBtn">AI 幫我填</button>
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
  modalEl.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">${escapeHtml(title)}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <form id="modalForm">
          <div class="modal-body">
            ${aiAssist ? aiAssistHtml() : ''}
            ${fields.map((f) => `
              <div class="mb-3">
                <label class="form-label">${escapeHtml(f.label)}</label>
                ${fieldInputHtml(f, initial[f.name])}
              </div>`).join('')}
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

  if (aiAssist) {
    modalEl.querySelector('#aiAssistBtn').addEventListener('click', async () => {
      const btn = modalEl.querySelector('#aiAssistBtn');
      const msgEl = modalEl.querySelector('#aiAssistMsg');
      const textVal = modalEl.querySelector('#aiAssistText').value;
      const fileEl = modalEl.querySelector('#aiAssistFile');
      const payload = { text: textVal };
      if (fileEl.files && fileEl.files[0]) {
        payload.fileName = fileEl.files[0].name;
        payload.fileContentBase64 = await fileToBase64(fileEl.files[0]);
      }
      btn.disabled = true;
      const originalLabel = btn.textContent;
      btn.textContent = '處理中…';
      msgEl.className = 'small mt-2 text-secondary';
      msgEl.textContent = '';
      try {
        const { fields: extracted } = await Api.post(`/api/ai/extract/${aiAssist.module}`, payload);
        const form = modalEl.querySelector('#modalForm');
        let filledCount = 0;
        for (const f of fields) {
          if (extracted[f.name] === undefined || extracted[f.name] === null || extracted[f.name] === '') continue;
          const el = form.elements[f.name];
          if (!el) continue;
          el.value = extracted[f.name];
          filledCount++;
        }
        msgEl.className = 'small mt-2 text-success';
        msgEl.textContent = filledCount > 0
          ? `已由 AI 自動填入 ${filledCount} 個欄位，請檢查無誤後再送出。`
          : 'AI 沒有從這份內容抓到可以填入的欄位，請確認貼上的內容或改用貼上文字/上傳檔案。';
      } catch (err) {
        msgEl.className = 'small mt-2 text-danger';
        msgEl.textContent = err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    });
  }

  modalEl.querySelector('#modalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {};
    for (const f of fields) {
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
    try {
      await onSubmit(data);
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
// button) — used by the Document Center's "AI 幫我抓重點" summary result,
// and reusable for any other simple "show some content" popup later instead
// of every caller building its own one-off modal markup.
function showInfoModal({ title, bodyHtml }) {
  const modalId = 'infoModal';
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
        <div class="brand"><span class="brand-mark">${sparkleMark()}</span>Legal Genie</div>
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
  assistant: renderAssistant,
  cases: renderCases,
  contracts: renderContracts,
  documents: renderDocuments,
  tasks: renderTasks,
  approvals: renderApprovals,
  notifications: renderNotifications,
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
      <div class="card-body p-4">
        <div class="text-center mb-3">
          <div class="login-logo-mark">${sparkleMark()}</div>
          <h5 class="mt-2 mb-0">Legal Genie</h5>
          <div class="text-secondary small">Gaming Machine &amp; Online Gaming Manufacturer</div>
        </div>
        ${message ? `<div class="alert alert-warning py-2 small">${escapeHtml(message)}</div>` : ''}
        <form id="loginForm">
          <div class="mb-3">
            <label class="form-label">Username</label>
            <input class="form-control" name="username" autofocus required>
          </div>
          <div class="mb-3">
            <label class="form-label">Password</label>
            <input class="form-control" type="password" name="password" required>
          </div>
          <div id="loginError" class="text-danger small mb-2"></div>
          <button class="btn btn-primary w-100" type="submit">Sign In</button>
        </form>
        <div class="text-secondary small mt-3">
          Demo accounts: <code>admin/admin123</code>, <code>jchen/password123</code>, <code>mtan/password123</code>, <code>viewer/password123</code>
        </div>
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
  State.assistant = { turns: [] }; // don't leak one user's chat into the next login
  renderLogin();
}

// ---------------------------------------------------------------------------
// Page: Dashboard
// ---------------------------------------------------------------------------
async function renderDashboard(content) {
  const s = await Api.get('/api/dashboard/summary');
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
        <div class="stat-icon tone-rose">${Icon('bell')}</div>
        <div class="stat-value">${s.unreadNotificationsCount}</div>
        <div class="stat-label">Unread Notifications</div>
      </div></div></div>
    </div>
    ${pagcorBoardHtml(s.pagcorBoard)}`;
}

// PAGCOR submission pipeline overview — one horizontal bar per PAGCOR Stage,
// bar length proportional to that stage's share of the largest stage, count
// shown alongside. Clicking a row jumps to Case Management pre-filtered to
// that Stage (see /api/dashboard/summary's pagcorBoard for the per-stage
// counts computed server-side). Skipped entirely if there are no PAGCOR
// cases yet (nothing to show). Deliberately just counts, not individual
// game cards — a stage like "Under PAGCOR Review" can hold hundreds of
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
// Page: AI Assistant
// ---------------------------------------------------------------------------
// Chat with the AI Assistant (server/assistant.js). Read-only lookups
// (search) answer directly; anything that would create a record comes back
// as a "pending action" card the user must confirm before it's written.
const ASSISTANT_EXAMPLES = [
  '幫我建立一個日本客戶的 NDA',
  '幫我找去年所有菲律賓客戶的授權合約',
  '幫我開一個高優先度的商務案件，負責人是我自己',
  '幫我起草一封 PAGCOR 送審公文，Provider 是 FC，遊戲是 Fortune Dragon',
];

function assistantActionCardHtml(turnIdx, actionIdx, action, state) {
  const stateHtml = {
    pending: `
      <button class="btn btn-sm btn-success btn-confirm-action" data-turn="${turnIdx}" data-action="${actionIdx}">確認執行</button>
      <button class="btn btn-sm btn-outline-secondary btn-cancel-action" data-turn="${turnIdx}" data-action="${actionIdx}">取消</button>`,
    confirming: `<span class="small text-secondary"><span class="spinner-border spinner-border-sm me-1"></span>執行中…</span>`,
    confirmed: `<span class="small text-success">${Icon('check', 'me-1')}已建立</span>`,
    cancelled: `<span class="small text-secondary">已取消</span>`,
    error: `<span class="small text-danger">執行失敗，請重試</span>`,
  }[state] || '';
  return `
    <div class="border rounded p-2 mb-2 bg-light" style="max-width:520px;">
      <div class="small mb-2">${escapeHtml(action.summary)}</div>
      ${stateHtml}
    </div>`;
}

function renderAssistantLog() {
  const log = document.getElementById('assistantLog');
  if (!log) return;
  const turns = State.assistant.turns;
  if (turns.length === 0) {
    log.innerHTML = `
      <div class="text-secondary">
        <p>你好，我是 Legal Genie 的 AI 助理。你可以請我幫忙搜尋現有的案件/合約/文件，或請我建立新的案件、合約、待辦事項。</p>
        <p class="mb-1">可以試試看：</p>
        <ul>${ASSISTANT_EXAMPLES.map((ex) => `<li><a href="#" class="assistant-example">${escapeHtml(ex)}</a></li>`).join('')}</ul>
      </div>`;
    log.querySelectorAll('.assistant-example').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const input = document.getElementById('assistantInput');
      if (input) { input.value = a.textContent; input.focus(); }
    }));
    return;
  }
  log.innerHTML = turns.map((t, i) => {
    if (t.role === 'user') {
      return `<div class="mb-3 text-end"><span class="badge bg-primary-subtle text-dark p-2 fw-normal" style="white-space:normal;">${escapeHtml(t.text)}</span></div>`;
    }
    const actions = (t.pendingActions || []).map((a, ai) => assistantActionCardHtml(i, ai, a, (t.actionStates || [])[ai] || 'pending')).join('');
    return `
      <div class="mb-3">
        <div class="d-flex align-items-start gap-2">
          <div class="mt-1">${sparkleMark('text-primary')}</div>
          <div style="max-width:600px;">
            ${t.text ? `<div class="mb-2">${escapeHtml(t.text).replace(/\n/g, '<br>')}</div>` : ''}
            ${actions}
          </div>
        </div>
      </div>`;
  }).join('');
  log.scrollTop = log.scrollHeight;
  log.querySelectorAll('.btn-confirm-action').forEach((btn) => btn.addEventListener('click', () => confirmAssistantAction(Number(btn.dataset.turn), Number(btn.dataset.action))));
  log.querySelectorAll('.btn-cancel-action').forEach((btn) => btn.addEventListener('click', () => cancelAssistantAction(Number(btn.dataset.turn), Number(btn.dataset.action))));
}

function assistantHistoryForApi() {
  // Plain {role, text} pairs only — see server/assistant.js for why raw
  // tool-call details are deliberately not threaded across turns.
  return State.assistant.turns.map((t) => ({
    role: t.role,
    text: t.text || (t.pendingActions && t.pendingActions.length ? '（建議了一個動作）' : ''),
  }));
}

async function sendAssistantMessage(text) {
  const historyForApi = assistantHistoryForApi();
  State.assistant.turns.push({ role: 'user', text });
  renderAssistantLog();
  try {
    const resp = await Api.post('/api/assistant/message', { history: historyForApi, text });
    State.assistant.turns.push({
      role: 'assistant',
      text: resp.reply,
      pendingActions: resp.pendingActions || [],
      actionStates: (resp.pendingActions || []).map(() => 'pending'),
    });
  } catch (err) {
    State.assistant.turns.push({ role: 'assistant', text: `發生錯誤：${err.message}` });
  }
  renderAssistantLog();
}

async function confirmAssistantAction(turnIdx, actionIdx) {
  const turn = State.assistant.turns[turnIdx];
  const action = turn.pendingActions[actionIdx];
  turn.actionStates[actionIdx] = 'confirming';
  renderAssistantLog();
  try {
    await Api.post('/api/assistant/confirm', { type: action.type, input: action.input });
    turn.actionStates[actionIdx] = 'confirmed';
    toast('已建立');
  } catch (err) {
    turn.actionStates[actionIdx] = 'error';
    toast(err.message, 'danger');
  }
  renderAssistantLog();
}

function cancelAssistantAction(turnIdx, actionIdx) {
  const turn = State.assistant.turns[turnIdx];
  turn.actionStates[actionIdx] = 'cancelled';
  renderAssistantLog();
}

async function renderAssistant(content) {
  content.innerHTML = `
    <div class="card stat-card d-flex flex-column p-0" style="height: calc(100vh - 170px);">
      <div class="flex-grow-1 overflow-auto p-3" id="assistantLog"></div>
      <form id="assistantForm" class="d-flex gap-2 p-3 border-top">
        <input type="text" class="form-control" id="assistantInput" autocomplete="off"
          placeholder="用一般文字描述你要做的事，例如：幫我找去年所有菲律賓客戶的授權合約">
        <button type="submit" class="btn btn-primary text-nowrap">送出</button>
      </form>
    </div>`;
  renderAssistantLog();
  content.querySelector('#assistantForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = content.querySelector('#assistantInput');
    const text = input.value.trim();
    if (!text) return;
    const btn = content.querySelector('button[type="submit"]');
    input.value = '';
    input.disabled = true;
    btn.disabled = true;
    try {
      await sendAssistantMessage(text);
    } finally {
      input.disabled = false;
      btn.disabled = false;
      input.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// Page: Case Management
// ---------------------------------------------------------------------------
function pagcorChecklistLabel(item) {
  const list = item.pagcorChecklist || [];
  if (!list.length) return item.provider ? 'Checklist' : null;
  const done = list.filter((i) => i.done).length;
  return `${done}/${list.length}`;
}

function showPagcorChecklistModal(item) {
  const canEditCase = canDo('cases', 'edit');
  const checklist = PAGCOR_CHECKLIST_ITEMS.map((tpl) => {
    const existing = (item.pagcorChecklist || []).find((i) => i.key === tpl.key);
    return { key: tpl.key, label: tpl.label, done: existing ? !!existing.done : false };
  });
  const modalEl = document.createElement('div');
  modalEl.className = 'modal fade';
  modalEl.innerHTML = `
    <div class="modal-dialog"><div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">PAGCOR Checklist — ${escapeHtml(item.caseNumber)}</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <div class="mb-3">
          <div class="fw-semibold">${escapeHtml(item.title)}</div>
          ${(item.provider || item.gameTitle) ? `<div class="small text-secondary">${escapeHtml(item.provider || '—')}${item.gameTitle ? ` — ${escapeHtml(item.gameTitle)}` : ''}</div>` : ''}
        </div>
        <div class="list-group">
          ${checklist.map((c) => `
            <label class="list-group-item d-flex align-items-center gap-2">
              <input type="checkbox" class="form-check-input mt-0 chk-item" data-key="${c.key}" ${c.done ? 'checked' : ''} ${canEditCase ? '' : 'disabled'}>
              <span>${escapeHtml(c.label)}</span>
            </label>`).join('')}
        </div>
        ${!canEditCase ? '<div class="small text-secondary mt-2">You do not have permission to edit cases, so this checklist is read-only.</div>' : ''}
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button></div>
    </div></div>`;
  document.body.appendChild(modalEl);
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
  let dirty = false;
  modalEl.querySelectorAll('.chk-item').forEach((chk) => chk.addEventListener('change', async () => {
    const key = chk.dataset.key;
    const updated = checklist.map((c) => (c.key === key ? { ...c, done: chk.checked } : c));
    checklist.splice(0, checklist.length, ...updated);
    try {
      await Api.put(`/api/cases/${item.id}`, { pagcorChecklist: updated });
      item.pagcorChecklist = updated;
      dirty = true;
    } catch (err) {
      chk.checked = !chk.checked;
      toast(err.message, 'danger');
    }
  }));
  modalEl.addEventListener('hidden.bs.modal', () => { modalEl.remove(); if (dirty) route(); });
}

// ---------------------------------------------------------------------------
// Import Excel/CSV -> bulk-create Cases (see server/import.js). Two-step:
// pick a file -> server parses + shows a per-sheet preview/settings -> user
// reviews/adjusts Provider & PAGCOR Stage per sheet -> confirm actually
// creates the records. Nothing is written until "確認匯入" is clicked.
// ---------------------------------------------------------------------------
function importSheetSettingsHtml(sheet) {
  const needsProvider = !sheet.hasProviderColumn;
  const needsStage = !sheet.hasStatusColumn;
  const sampleNames = sheet.sampleRows.map((r) => escapeHtml(r.title)).join('、');
  return `
    <div class="border rounded p-2 mb-2 import-sheet-row" data-sheet="${escapeHtml(sheet.name)}">
      <div class="d-flex align-items-start gap-2">
        <input type="checkbox" class="form-check-input mt-1 sheet-include" ${sheet.rowCount > 0 ? 'checked' : ''} ${sheet.rowCount === 0 ? 'disabled' : ''}>
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-center">
            <strong>${escapeHtml(sheet.name.trim() || '(未命名工作表)')}</strong>
            <span class="badge text-bg-light border">${sheet.rowCount} 筆</span>
          </div>
          <div class="small text-secondary mt-1">${sampleNames ? `例如：${sampleNames}${sheet.rowCount > sheet.sampleRows.length ? '…' : ''}` : '(沒有偵測到可匯入的資料列)'}</div>
          <div class="d-flex flex-wrap gap-3 mt-2 align-items-end">
            ${needsProvider ? `
              <div>
                <label class="form-label small mb-1">Provider</label>
                <input type="text" class="form-control form-control-sm sheet-provider" value="${escapeHtml(sheet.suggestedProvider || '')}" style="width:160px;">
              </div>` : `<div class="small text-secondary">已偵測到 Provider 欄位，會使用每列各自的值。</div>`}
            ${needsStage ? `
              <div>
                <label class="form-label small mb-1">PAGCOR Stage</label>
                <select class="form-select form-select-sm sheet-stage" style="width:200px;">
                  ${PAGCOR_STAGE_OPTIONS.map((s) => `<option value="${escapeHtml(s)}" ${s === 'Preparing Documents' ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
                </select>
              </div>` : `<div class="small text-secondary">已偵測到 Status 欄位，會依每列自動判斷階段。</div>`}
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
          <h5 class="modal-title">匯入 Excel / CSV</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label class="form-label">選擇檔案（.xlsx 或 .csv）—— 每個工作表(分頁)會分開偵測</label>
            <input type="file" class="form-control" id="importFile" accept=".xlsx,.csv">
          </div>
          <div id="importAnalyzeMsg" class="small text-secondary mb-2"></div>
          <div id="importSheets"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
          <button type="button" class="btn btn-primary" id="importConfirmBtn" style="display:none;">確認匯入</button>
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
    msgEl.textContent = '分析中…';
    sheetsEl.innerHTML = '';
    confirmBtn.style.display = 'none';
    try {
      const resp = await Api.post('/api/cases/import/preview', { fileName, fileContentBase64 });
      const sheets = resp.sheets || [];
      const totalRows = sheets.reduce((sum, s) => sum + s.rowCount, 0);
      msgEl.textContent = totalRows > 0
        ? `偵測到 ${sheets.length} 個工作表，共 ${totalRows} 筆資料。請確認下面每個工作表的設定後再匯入。`
        : '沒有偵測到任何資料列，請確認檔案內容。';
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
    btn.textContent = '匯入中…';
    try {
      const result = await Api.post('/api/cases/import/commit', { fileName, fileContentBase64, sheets });
      modal.hide();
      const skippedMsg = result.skipped ? `，${result.skipped} 筆已存在（Provider + 遊戲名稱相同）故跳過` : '';
      const errorMsg = result.errors && result.errors.length ? `，${result.errors.length} 筆發生錯誤（請查看瀏覽器 console）` : '';
      const conflictMsg = result.gameIdConflicts && result.gameIdConflicts.length
        ? `；⚠️ ${result.gameIdConflicts.length} 組 Game ID 相同但名稱看起來是不同遊戲，未自動合併，請查看瀏覽器 console` : '';
      toast(`已建立 ${result.created} 筆案件${skippedMsg}${errorMsg}${conflictMsg}`);
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
function caseFormFields() {
  return [
    { name: 'title', label: 'Title', required: true },
    { name: 'type', label: 'Type', type: 'select', options: ['Regulatory', 'Commercial', 'IP', 'Litigation', 'Employment', 'Other'].map((v) => ({ value: v, label: v })), required: true },
    { name: 'ownerId', label: 'Owner', type: 'select', options: State.lookups.users.map((u) => ({ value: u.id, label: u.fullName })), required: true },
    { name: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'].map((v) => ({ value: v, label: v })), required: true },
    { name: 'status', label: 'Status', type: 'select', options: ['Open', 'In Progress', 'Closed'].map((v) => ({ value: v, label: v })), required: true },
    { name: 'deadline', label: 'Deadline', type: 'date' },
    { name: 'provider', label: 'PAGCOR Provider (optional)', placeholder: 'e.g. FC, JDB, VP' },
    { name: 'gameTitle', label: 'Game Title (optional)' },
    { name: 'gameType', label: 'Game Type (optional)', type: 'select', allowEmpty: true, options: GAME_TYPE_OPTIONS.map((v) => ({ value: v, label: v })) },
    { name: 'gameId', label: 'Game ID (optional)' },
    { name: 'gameVersion', label: 'Game Version (optional)' },
    { name: 'withJackpot', label: 'With Jackpot? (optional)', type: 'select', allowEmpty: true, options: YES_NO_OPTIONS.map((v) => ({ value: v, label: v })) },
    { name: 'pagcorStage', label: 'PAGCOR Stage (optional)', type: 'select', allowEmpty: true, options: PAGCOR_STAGE_OPTIONS.map((v) => ({ value: v, label: v })) },
    { name: 'loaExpiryDate', label: 'LOA Expiry Date (optional)', type: 'date' },
    { name: 'description', label: 'Description', type: 'textarea' },
  ];
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
  const field = (label, value) => `
    <div class="col-6 col-md-3 mb-3">
      <div class="small text-secondary">${escapeHtml(label)}</div>
      <div class="fw-semibold">${value === undefined || value === null || value === '' ? '<span class="text-secondary">—</span>' : escapeHtml(String(value))}</div>
    </div>`;
  content.innerHTML = `
    <div class="mb-3"><a href="#/cases" class="small text-decoration-none">&larr; Back to Case Management</a></div>
    <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
      <div>
        <h4 class="mb-0">${escapeHtml(item.caseNumber)}</h4>
        <div class="text-secondary">${escapeHtml(item.title)}</div>
      </div>
      <div class="d-flex gap-2">
        ${canEdit ? `<button class="btn btn-outline-secondary btn-sm" id="btnEditCase">${Icon('edit', 'me-1')}Edit</button>` : ''}
        ${canDelete ? `<button class="btn btn-outline-danger btn-sm" id="btnDeleteCase">${Icon('trash', 'me-1')}Delete</button>` : ''}
      </div>
    </div>
    <div class="card mb-3"><div class="card-body">
      <div class="small text-secondary mb-2">PAGCOR Review Progress${canEdit && item.pagcorStage !== 'Rejected' ? ' — 點擊階段可直接切換' : ''}</div>
      ${pagcorStageStepperHtml(item.pagcorStage, canEdit)}
    </div></div>
    <div class="card mb-3"><div class="card-body">
      <div class="row">
        ${field('Game ID', item.gameId)}
        ${field('Game Title', item.gameTitle)}
        ${field('Game Type', item.gameType)}
        ${field('Game Version', item.gameVersion)}
        ${field('With Jackpot', item.withJackpot)}
        ${field('Provider', item.provider)}
        ${field('Type', item.type)}
        ${field('Owner', userName(item.ownerId))}
        ${field('Priority', item.priority)}
        ${field('Status', item.status)}
        ${field('Deadline', fmtDate(item.deadline))}
        ${field('LOA Expiry Date', fmtDate(item.loaExpiryDate))}
      </div>
      ${item.description ? `<div class="mt-2"><div class="small text-secondary">Description</div><div>${escapeHtml(item.description)}</div></div>` : ''}
    </div></div>
    <div class="card"><div class="card-body">
      <h6 class="mb-2">PAGCOR Checklist</h6>
      <div class="list-group">
        ${PAGCOR_CHECKLIST_ITEMS.map((tpl) => {
          const existing = (item.pagcorChecklist || []).find((i) => i.key === tpl.key);
          return `
          <label class="list-group-item d-flex align-items-center gap-2">
            <input type="checkbox" class="form-check-input mt-0 chk-item" data-key="${tpl.key}" ${existing && existing.done ? 'checked' : ''} ${canEdit ? '' : 'disabled'}>
            <span>${escapeHtml(tpl.label)}</span>
          </label>`;
        }).join('')}
      </div>
      ${!canEdit ? '<div class="small text-secondary mt-2">You do not have permission to edit cases, so this checklist is read-only.</div>' : ''}
    </div></div>`;

  content.querySelectorAll('.chk-item').forEach((chk) => chk.addEventListener('change', async () => {
    const updatedChecklist = Array.from(content.querySelectorAll('.chk-item')).map((el) => ({ key: el.dataset.key, done: el.checked }));
    try {
      await Api.put(`/api/cases/${item.id}`, { pagcorChecklist: updatedChecklist });
      item.pagcorChecklist = updatedChecklist;
    } catch (err) {
      chk.checked = !chk.checked;
      toast(err.message, 'danger');
    }
  }));

  // Clicking a step on the PAGCOR Review Progress stepper jumps straight to
  // that stage — no need to open the Edit form just to change one field.
  // Only rendered on steps other than the current one (see
  // pagcorStageStepperHtml()), so every click is a real change. Re-renders
  // the whole detail page afterward so the stepper, and anything else that
  // depends on pagcorStage, stays in sync.
  content.querySelectorAll('.pagcor-step-clickable').forEach((stepEl) => stepEl.addEventListener('click', async () => {
    const newStage = stepEl.dataset.stage;
    try {
      await Api.put(`/api/cases/${item.id}`, { pagcorStage: newStage });
      toast(`PAGCOR Stage 已更新為「${newStage}」`);
      await renderCaseDetail(content, id);
    } catch (err) {
      toast(err.message, 'danger');
    }
  }));

  const editBtn = content.querySelector('#btnEditCase');
  if (editBtn) editBtn.addEventListener('click', () => {
    showFormModal({
      title: 'Edit Case', fields: caseFormFields(), initial: item,
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
      ${canCreate ? `<button class="btn btn-outline-secondary btn-sm" id="btnImportCases">${Icon('download', 'me-1')}Import Excel/CSV</button>` : ''}
      ${canEdit ? `<button class="btn btn-outline-secondary btn-sm" id="btnImportApprovalNotice">${Icon('upload', 'me-1')}上傳核准通知信</button>` : ''}`,
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
            <th class="sortable-th case-col" data-sort="caseNumber">Case # <span class="sort-indicator"></span></th>
            <th class="sortable-th" data-sort="gameId">Game ID <span class="sort-indicator"></span></th>
            <th class="sortable-th" data-sort="title">Title <span class="sort-indicator"></span></th>
            <th class="sortable-th" data-sort="type">Type <span class="sort-indicator"></span></th>
            <th class="sortable-th" data-sort="provider">Provider <span class="sort-indicator"></span></th>
            <th class="sortable-th" data-sort="pagcorStage">PAGCOR Stage <span class="sort-indicator"></span></th>
            <th class="sortable-th" data-sort="owner">Owner <span class="sort-indicator"></span></th>
            <th class="sortable-th" data-sort="priority">Priority <span class="sort-indicator"></span></th>
            <th class="sortable-th" data-sort="status">Status <span class="sort-indicator"></span></th>
            <th class="sortable-th" data-sort="deadline">Deadline <span class="sort-indicator"></span></th>
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

  function rowHtml(c) {
    const checklistLabel = pagcorChecklistLabel(c);
    return `
      <tr data-id="${c.id}">
        <td><input type="checkbox" class="row-checkbox" data-id="${c.id}" ${selectedIds.has(c.id) ? 'checked' : ''}></td>
        <td class="text-nowrap case-col" title="${escapeHtml(c.caseNumber)}">${escapeHtml((c.caseNumber || '').replace(/^CASE-/i, ''))}</td>
        <td class="text-nowrap">${escapeHtml(c.gameId || '—')}</td>
        <td>${escapeHtml(c.title)}</td>
        <td>${escapeHtml(c.type)}</td>
        <td>${escapeHtml(c.provider || '—')}</td>
        <td>${c.pagcorStage ? badge(c.pagcorStage) : '<span class="text-secondary">—</span>'}</td>
        <td>${escapeHtml(userName(c.ownerId))}</td>
        <td>${priorityBadge(c.priority)}</td>
        <td>${badge(c.status)}</td>
        <td class="text-nowrap">${fmtDate(c.deadline)}</td>
        <td class="text-end text-nowrap">
          ${checklistLabel ? `<button class="btn btn-sm btn-outline-secondary btn-checklist" data-id="${c.id}" title="PAGCOR Checklist">${Icon('checkSquare')} ${checklistLabel}</button>` : ''}
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
      showFormModal({
        title: 'Edit Case', fields: fields(), initial: item,
        onSubmit: async (data) => { await Api.put(`/api/cases/${item.id}`, data); toast('Case updated'); route(); },
      });
    }));
    content.querySelectorAll('.btn-del').forEach((btn) => btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!(await confirmDialog('Delete this case?'))) return;
      await Api.del(`/api/cases/${btn.dataset.id}`);
      toast('Case deleted');
      route();
    }));
    content.querySelectorAll('.btn-checklist').forEach((btn) => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = cases.find((c) => c.id === btn.dataset.id);
      showPagcorChecklistModal(item);
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
      <span class="fw-semibold small">已選取 ${selectedIds.size} 筆</span>
      ${canEdit ? `<button class="btn btn-sm btn-primary" id="btnBulkStage">${Icon('checkSquare', 'me-1')}批次更新 PAGCOR Stage</button>` : ''}
      <button class="btn btn-sm btn-outline-secondary" id="btnBulkClear">清除選取</button>`;
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
    modalEl.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">批次更新 PAGCOR Stage（${selectedIds.size} 筆案件）</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <label class="form-label">將選取的案件全部設定為：</label>
            <select class="form-select" id="bulkStageSelect">
              ${PAGCOR_STAGE_OPTIONS.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
            </select>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
            <button type="button" class="btn btn-primary" id="bulkStageConfirmBtn">確認更新</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modalEl);
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    modalEl.querySelector('#bulkStageConfirmBtn').addEventListener('click', async () => {
      const btn = modalEl.querySelector('#bulkStageConfirmBtn');
      const pagcorStage = modalEl.querySelector('#bulkStageSelect').value;
      btn.disabled = true;
      const originalLabel = btn.textContent;
      btn.textContent = '更新中…';
      try {
        const result = await Api.post('/api/cases/bulk-update-stage', { ids: Array.from(selectedIds), pagcorStage });
        modal.hide();
        toast(`已更新 ${result.updated} 筆案件的 PAGCOR Stage${result.errors && result.errors.length ? `，${result.errors.length} 筆發生錯誤` : ''}`);
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

  // Sort value per column — pagcorStage sorts by pipeline order (Not Started
  // → ... → Rejected), not alphabetically; priority sorts High/Medium/Low
  // rather than alphabetically; everything else is a case-insensitive string
  // (or numeric epoch for Deadline, with no-deadline sorting last).
  function sortValue(c, col) {
    switch (col) {
      case 'caseNumber': return c.caseNumber || '';
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
      'PAGCOR Stage', 'Game Manual', 'Parameter', 'RTP Certification', 'Owner', 'Priority', 'Status', 'Deadline', 'LOA Expiry Date', 'Description'];
    const lines = [header.map(csvEscape).join(',')];
    sortedFilteredCases().forEach((c) => {
      const cl = Object.fromEntries((c.pagcorChecklist || []).map((i) => [i.key, i.done ? 'Yes' : 'No']));
      lines.push([
        c.caseNumber, c.title, c.type, c.provider || '', c.gameTitle || '', c.gameType || '', c.gameId || '', c.gameVersion || '', c.withJackpot || '',
        c.pagcorStage || '', cl.gameManual || '', cl.parameter || '', cl.rtpCertification || '',
        userName(c.ownerId), c.priority, c.status, c.deadline || '', c.loaExpiryDate || '', c.description || '',
      ].map(csvEscape).join(','));
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
      && (!stage || c.pagcorStage === stage)
      && (!q || (c.title || '').toLowerCase().includes(q) || (c.gameTitle || '').toLowerCase().includes(q) || (c.gameId || '').toLowerCase().includes(q)));
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
    // the Dashboard's PAGCOR Submission Pipeline board's "還有 N 筆 →" links)
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

  const importNoticeBtn = content.querySelector('#btnImportApprovalNotice');
  if (importNoticeBtn) importNoticeBtn.addEventListener('click', showImportApprovalNoticeModal);

  applyFilters();

  if (canCreate) {
    content.querySelector('#btnCreate').addEventListener('click', () => {
      showFormModal({
        title: 'New Case', fields: fields(), initial: { status: 'Open', priority: 'Medium' },
        aiAssist: { module: 'cases' },
        onSubmit: async (data) => { await Api.post('/api/cases', data); toast('Case created'); route(); },
      });
    });
    content.querySelector('#btnImportCases').addEventListener('click', showImportCasesModal);
  }
}

// Upload a real PAGCOR "Notice of Approval" letter (often a scanned image
// with no text layer — pdf-parse can't read those, which is why "檢查
// PAGCOR 核准清單" alone isn't enough for approvals PAGCOR hasn't folded
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
          <h5 class="modal-title">上傳核准通知信</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body" id="approvalNoticeModalBody">
          <div class="small text-secondary mb-2">
            上傳 PAGCOR 寄給你的核准通知信（PDF 或圖片皆可，掃描檔也沒問題）。
            AI 會讀取內容、找出信裡核准的遊戲，並自動比對你系統裡對應的案件，
            把符合的案件改成「LOA Approved」。如果比對不到、或同時符合多筆案件，
            會列出來讓你自己確認，不會用猜的。
          </div>
          <input type="file" class="form-control" id="approvalNoticeFile" accept="application/pdf,image/*">
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
          <button type="button" class="btn btn-primary" id="approvalNoticeSubmitBtn">上傳並比對</button>
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
    if (!file) { toast('請先選擇一個檔案', 'danger'); return; }
    const btn = modalEl.querySelector('#approvalNoticeSubmitBtn');
    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = 'AI 判讀中…';
    try {
      const fileContentBase64 = await fileToBase64(file);
      const result = await Api.post('/api/cases/import-approval-notice', { fileName: file.name, fileContentBase64 });
      if (result.updatedCases.length) didUpdateAnything = true;
      const body = modalEl.querySelector('#approvalNoticeModalBody');
      const section = (title, items, renderItem) => items && items.length
        ? `<div class="mb-3"><div class="fw-semibold small mb-1">${escapeHtml(title)}</div><ul class="small mb-0">${items.map(renderItem).join('')}</ul></div>`
        : '';
      body.innerHTML = `
        ${result.noticeReference || result.approvalDate ? `<div class="small text-secondary mb-2">${result.noticeReference ? `文號：${escapeHtml(result.noticeReference)}　` : ''}${result.approvalDate ? `日期：${escapeHtml(result.approvalDate)}` : ''}</div>` : ''}
        ${section('已自動核准', result.updatedCases, (c) => `<li>${escapeHtml(c.caseNumber)} — ${escapeHtml(c.title)}（${escapeHtml(c.oldStage)} → LOA Approved）</li>`)}
        ${section('本來就已經是 LOA Approved', result.alreadyApproved, (c) => `<li>${escapeHtml(c.caseNumber)} — ${escapeHtml(c.title)}</li>`)}
        ${section('案件狀態是 Rejected，未自動變更', result.skippedRejected, (c) => `<li>${escapeHtml(c.caseNumber)} — ${escapeHtml(c.title)}</li>`)}
        ${section('⚠️ 找不到對應的案件（需要手動確認）', result.unmatched, (g) => `<li>${escapeHtml(g.gameTitle || '(未命名)')}${g.gameId ? ` — Game ID: ${escapeHtml(g.gameId)}` : ''}${g.provider ? ` — ${escapeHtml(g.provider)}` : ''}</li>`)}
        ${section('⚠️ 同時符合多筆案件，未自動變更（需要手動確認）', result.ambiguous, (g) => `<li>${escapeHtml(g.gameTitle || '(未命名)')}${g.gameId ? ` — Game ID: ${escapeHtml(g.gameId)}` : ''} — 符合：${g.matchedCaseNumbers.map(escapeHtml).join('、')}</li>`)}
        ${!result.updatedCases.length && !result.alreadyApproved.length && !result.skippedRejected.length && !result.unmatched.length && !result.ambiguous.length ? '<div class="small text-secondary">AI 沒有從這份文件裡讀到任何遊戲資訊。</div>' : ''}`;
      modalEl.querySelector('.modal-footer').innerHTML = `<button type="button" class="btn btn-primary" data-bs-dismiss="modal">完成</button>`;
      toast(`已自動核准 ${result.updatedCases.length} 筆案件`, (result.unmatched.length || result.ambiguous.length) ? 'warning' : 'success');
    } catch (err) {
      toast(err.message, 'danger');
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });
}

// ---------------------------------------------------------------------------
// Page: Contract Management
// ---------------------------------------------------------------------------
async function renderContracts(content) {
  const contracts = await Api.get('/api/contracts');
  const canCreate = canDo('contracts', 'create');
  const canEdit = canDo('contracts', 'edit');
  const canDelete = canDo('contracts', 'delete');
  content.innerHTML = listToolbar({ title: 'Contract Management', canCreate }) + `
    <div class="card stat-card">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead class="table-light"><tr><th>Contract #</th><th>Title</th><th>Counterparty</th><th>Type</th><th>Owner</th><th>Expiry</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${contracts.map((c) => `
              <tr>
                <td>${escapeHtml(c.contractNumber)}</td>
                <td>${escapeHtml(c.title)}</td>
                <td>${escapeHtml(c.counterparty)}</td>
                <td>${escapeHtml(c.type)}</td>
                <td>${escapeHtml(userName(c.ownerId))}</td>
                <td class="text-nowrap">${fmtDate(c.expiryDate)}</td>
                <td>${badge(c.status)}</td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-secondary btn-versions" data-id="${c.id}">${Icon('clock')}</button>
                  ${canEdit ? `<button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${c.id}">${Icon('edit')}</button>` : ''}
                  ${canDelete ? `<button class="btn btn-sm btn-outline-danger btn-del" data-id="${c.id}">${Icon('trash')}</button>` : ''}
                </td>
              </tr>`).join('') || `<tr><td colspan="8" class="text-center text-secondary py-3">No contracts yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;

  const fields = () => ([
    { name: 'title', label: 'Title', required: true },
    { name: 'counterparty', label: 'Counterparty', required: true },
    { name: 'type', label: 'Type', type: 'select', options: ['License', 'Supply', 'Services', 'Employment', 'NDA', 'Other'].map((v) => ({ value: v, label: v })), required: true },
    { name: 'ownerId', label: 'Owner', type: 'select', options: State.lookups.users.map((u) => ({ value: u.id, label: u.fullName })), required: true },
    { name: 'effectiveDate', label: 'Effective Date', type: 'date' },
    { name: 'expiryDate', label: 'Expiry Date', type: 'date' },
    { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Expired', 'Terminated', 'Draft'].map((v) => ({ value: v, label: v })), required: true },
  ]);

  if (canCreate) {
    content.querySelector('#btnCreate').addEventListener('click', () => {
      showFormModal({
        title: 'New Contract', fields: fields(), initial: { status: 'Active' },
        aiAssist: { module: 'contracts' },
        onSubmit: async (data) => { await Api.post('/api/contracts', data); toast('Contract created'); route(); },
      });
    });
  }
  content.querySelectorAll('.btn-edit').forEach((btn) => btn.addEventListener('click', () => {
    const item = contracts.find((c) => c.id === btn.dataset.id);
    showFormModal({
      title: 'Edit Contract', fields: fields(), initial: item,
      onSubmit: async (data) => { await Api.put(`/api/contracts/${item.id}`, data); toast('Contract updated'); route(); },
    });
  }));
  content.querySelectorAll('.btn-del').forEach((btn) => btn.addEventListener('click', async () => {
    if (!(await confirmDialog('Delete this contract?'))) return;
    await Api.del(`/api/contracts/${btn.dataset.id}`);
    toast('Contract deleted');
    route();
  }));
  content.querySelectorAll('.btn-versions').forEach((btn) => btn.addEventListener('click', async () => {
    const item = contracts.find((c) => c.id === btn.dataset.id);
    const versions = await Api.get(`/api/contracts/${item.id}/versions`);
    showFormModal({
      title: `Upload New Version – ${item.title}`,
      fields: [
        { name: 'fileName', label: 'File (optional upload)', type: 'file' },
        { name: 'notes', label: 'Version notes', type: 'textarea' },
      ],
      submitLabel: 'Upload Version',
      onSubmit: async (data) => {
        await Api.post(`/api/contracts/${item.id}/versions`, data);
        toast('Version uploaded');
        route();
      },
    });
    setTimeout(() => {
      const list = document.createElement('div');
      list.className = 'small text-secondary px-3 pb-2';
      list.innerHTML = versions.length
        ? `<strong>Existing versions:</strong><ul class="mb-0">${versions.map((v) => `<li>v${v.versionNo} – ${escapeHtml(v.fileName || 'no file')} (${escapeHtml(v.notes || '')})</li>`).join('')}</ul>`
        : 'No versions uploaded yet.';
      const body = document.querySelector('#formModal .modal-body');
      if (body) body.prepend(list);
    }, 0);
  }));
}

// ---------------------------------------------------------------------------
// Page: Document Center
// ---------------------------------------------------------------------------
async function renderDocuments(content) {
  const docs = await Api.get('/api/documents');
  const canCreate = canDo('documents', 'create');
  const canEdit = canDo('documents', 'edit');
  const canDelete = canDo('documents', 'delete');
  content.innerHTML = listToolbar({ title: 'Document Center', canCreate }) + `
    <div class="card stat-card">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead class="table-light"><tr><th>Title</th><th>Category</th><th>Provider</th><th>Game</th><th>Report Type</th><th>File</th><th>Uploaded By</th><th>Uploaded</th><th></th></tr></thead>
          <tbody>
            ${docs.map((d) => `
              <tr>
                <td>${escapeHtml(d.title)}</td>
                <td><span class="badge text-bg-light border">${escapeHtml(d.category)}</span></td>
                <td>${escapeHtml(d.provider || '—')}</td>
                <td>${escapeHtml(d.gameTitle || '—')}</td>
                <td>${d.reportType ? `<span class="badge text-bg-light border">${escapeHtml(d.reportType)}</span>` : '<span class="text-secondary">—</span>'}</td>
                <td>${d.filePath ? `<a href="/api/documents/${d.id}/download" class="text-decoration-none">${Icon('download', 'me-1')}${escapeHtml(d.fileName || 'file')}</a>` : `<span class="text-secondary">${escapeHtml(d.fileName || '—')}</span>`}</td>
                <td>${escapeHtml(userName(d.uploadedBy))}</td>
                <td class="text-nowrap">${fmtDate(d.createdAt)}</td>
                <td class="text-end">
                  ${d.filePath ? `<button class="btn btn-sm btn-outline-primary btn-summarize" data-id="${d.id}" title="AI 幫我抓重點">${Icon('sparkle')}</button>` : ''}
                  ${canEdit ? `<button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${d.id}">${Icon('edit')}</button>` : ''}
                  ${canDelete ? `<button class="btn btn-sm btn-outline-danger btn-del" data-id="${d.id}">${Icon('trash')}</button>` : ''}
                </td>
              </tr>`).join('') || `<tr><td colspan="9" class="text-center text-secondary py-3">No documents yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;

  const fields = () => ([
    { name: 'title', label: 'Title', required: true },
    { name: 'category', label: 'Category', type: 'select', options: ['Templates', 'Policies', 'Agreements', 'Certificates', 'Other'].map((v) => ({ value: v, label: v })), required: true },
    { name: 'provider', label: 'PAGCOR Provider (optional)', placeholder: 'e.g. FC, JDB, VP' },
    { name: 'gameTitle', label: 'Game Title (optional)' },
    { name: 'reportType', label: 'Report Type (optional)', type: 'select', allowEmpty: true, options: REPORT_TYPE_OPTIONS.map((v) => ({ value: v, label: v })) },
    { name: 'relatedCaseId', label: 'Related Case (optional)', type: 'select', allowEmpty: true, options: State.lookups.cases.map((c) => ({ value: c.id, label: c.caseNumber + ' - ' + c.title })) },
    { name: 'relatedContractId', label: 'Related Contract (optional)', type: 'select', allowEmpty: true, options: State.lookups.contracts.map((c) => ({ value: c.id, label: c.contractNumber + ' - ' + c.title })) },
    { name: 'fileName', label: 'File Upload', type: 'file' },
  ]);

  if (canCreate) content.querySelector('#btnCreate').addEventListener('click', () => {
    showFormModal({ title: 'Upload Document', fields: fields(), submitLabel: 'Upload',
      aiAssist: { module: 'documents' },
      onSubmit: async (data) => { await Api.post('/api/documents', data); toast('Document uploaded'); route(); } });
  });
  content.querySelectorAll('.btn-edit').forEach((btn) => btn.addEventListener('click', () => {
    const item = docs.find((d) => d.id === btn.dataset.id);
    showFormModal({ title: 'Edit Document', fields: fields().filter((f) => f.name !== 'fileName'), initial: item,
      onSubmit: async (data) => { await Api.put(`/api/documents/${item.id}`, data); toast('Updated'); route(); } });
  }));
  content.querySelectorAll('.btn-del').forEach((btn) => btn.addEventListener('click', async () => {
    if (!(await confirmDialog('Delete this document?'))) return;
    await Api.del(`/api/documents/${btn.dataset.id}`);
    toast('Deleted'); route();
  }));
  content.querySelectorAll('.btn-summarize').forEach((btn) => btn.addEventListener('click', async () => {
    const item = docs.find((d) => d.id === btn.dataset.id);
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '…';
    try {
      const result = await Api.post(`/api/documents/${item.id}/summarize`, {});
      showInfoModal({
        title: `AI 重點摘要 – ${item.title}`,
        bodyHtml: `
          <p>${escapeHtml(result.summary || '')}</p>
          ${(result.keyPoints || []).length
            ? `<ul class="mb-0">${result.keyPoints.map((k) => `<li>${escapeHtml(k)}</li>`).join('')}</ul>`
            : ''}
          <p class="small text-secondary mt-3 mb-0">這是 AI 根據文件內容整理的重點摘要,僅供快速參考,實際內容仍以原文件為準。</p>
        `,
      });
    } catch (err) {
      toast(err.message, 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }));
}

// ---------------------------------------------------------------------------
// Page: Task Management
// ---------------------------------------------------------------------------
async function renderTasks(content) {
  const tasks = await Api.get('/api/tasks');
  const canCreate = canDo('tasks', 'create');
  const canEdit = canDo('tasks', 'edit');
  const canDelete = canDo('tasks', 'delete');
  content.innerHTML = listToolbar({ title: 'Task Management', canCreate }) + `
    <div class="card stat-card">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead class="table-light"><tr><th>Title</th><th>Type</th><th>Assignee</th><th>Due</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${tasks.map((t) => `
              <tr>
                <td>${escapeHtml(t.title)}${caseName(t.relatedCaseId) ? `<div class="small text-secondary">${escapeHtml(caseName(t.relatedCaseId))}</div>` : ''}</td>
                <td><span class="badge text-bg-light border text-capitalize">${escapeHtml(t.type)}</span></td>
                <td>${escapeHtml(userName(t.assigneeId))}</td>
                <td class="text-nowrap">${fmtDate(t.dueDate)}</td>
                <td>${badge(t.status)}</td>
                <td class="text-end">
                  ${canEdit ? `<button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${t.id}">${Icon('edit')}</button>` : ''}
                  ${canDelete ? `<button class="btn btn-sm btn-outline-danger btn-del" data-id="${t.id}">${Icon('trash')}</button>` : ''}
                </td>
              </tr>`).join('') || `<tr><td colspan="6" class="text-center text-secondary py-3">No tasks yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;

  const fields = () => ([
    { name: 'title', label: 'Title', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'assigneeId', label: 'Assignee', type: 'select', options: State.lookups.users.map((u) => ({ value: u.id, label: u.fullName })), required: true },
    { name: 'type', label: 'Type', type: 'select', options: [{ value: 'personal', label: 'Personal' }, { value: 'team', label: 'Team' }], required: true },
    { name: 'status', label: 'Status', type: 'select', options: ['Not Started', 'In Progress', 'Completed'].map((v) => ({ value: v, label: v })), required: true },
    { name: 'dueDate', label: 'Due Date', type: 'date' },
    { name: 'relatedCaseId', label: 'Related Case (optional)', type: 'select', allowEmpty: true, options: State.lookups.cases.map((c) => ({ value: c.id, label: c.caseNumber + ' - ' + c.title })) },
    { name: 'relatedContractId', label: 'Related Contract (optional)', type: 'select', allowEmpty: true, options: State.lookups.contracts.map((c) => ({ value: c.id, label: c.contractNumber + ' - ' + c.title })) },
  ]);

  if (canCreate) content.querySelector('#btnCreate').addEventListener('click', () => {
    showFormModal({ title: 'New Task', fields: fields(), initial: { type: 'personal', status: 'Not Started' },
      onSubmit: async (data) => {
        const created = await Api.post('/api/tasks', data);
        if (data.assigneeId) {
          try { await Api.post(`/api/notifications/${created.id}/read`); } catch (e) { /* not applicable */ }
        }
        toast('Task created'); route();
      } });
  });
  content.querySelectorAll('.btn-edit').forEach((btn) => btn.addEventListener('click', () => {
    const item = tasks.find((t) => t.id === btn.dataset.id);
    showFormModal({ title: 'Edit Task', fields: fields(), initial: item,
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
// Page: Settings (Users / Roles / Departments)
// ---------------------------------------------------------------------------
async function renderSettings(content) {
  content.innerHTML = `
    <ul class="nav nav-tabs mb-3" id="settingsTabs">
      <li class="nav-item"><button class="nav-link active" data-tab="users">Users</button></li>
      <li class="nav-item"><button class="nav-link" data-tab="roles">Roles &amp; Permissions</button></li>
      <li class="nav-item"><button class="nav-link" data-tab="departments">Departments</button></li>
    </ul>
    <div id="settingsBody"></div>`;
  const body = content.querySelector('#settingsBody');
  async function showTab(tab) {
    content.querySelectorAll('#settingsTabs .nav-link').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'users') return renderUsersTab(body);
    if (tab === 'roles') return renderRolesTab(body);
    if (tab === 'departments') return renderDepartmentsTab(body);
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

async function renderRolesTab(body) {
  const roles = await Api.get('/api/roles');
  const canEdit = canDo('settings', 'edit');
  body.innerHTML = `<div class="card stat-card"><div class="table-responsive"><table class="table mb-0">
    <thead class="table-light"><tr><th>Role</th>${['Dashboard', 'Cases', 'Contracts', 'Documents', 'Tasks', 'Approvals', 'Notifications', 'Settings'].map((m) => `<th class="text-center">${m}</th>`).join('')}</tr></thead>
    <tbody>
      ${roles.map((r) => `<tr>
        <td class="fw-semibold">${escapeHtml(r.name)}</td>
        ${['dashboard', 'cases', 'contracts', 'documents', 'tasks', 'approvals', 'notifications', 'settings'].map((m) => {
          const p = r.name === 'Admin' ? { view: true, create: true, edit: true, delete: true, approve: true } : ((r.permissions || {})[m] || {});
          const marks = ['view', 'create', 'edit', 'delete', 'approve'].filter((a) => p[a]).map((a) => a[0].toUpperCase()).join('');
          return `<td class="text-center small">${marks || '—'}</td>`;
        }).join('')}
      </tr>`).join('')}
    </tbody></table></div>
    <div class="card-footer small text-secondary">Legend: V=View, C=Create, E=Edit, D=Delete, A=Approve. Admin role always has full access.${canEdit ? ' Contact your system administrator to adjust granular permissions.' : ''}</div>
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
    renderShell();
    await route();
  } catch (err) {
    Api.setToken(null);
    renderLogin();
  }
}

boot();
