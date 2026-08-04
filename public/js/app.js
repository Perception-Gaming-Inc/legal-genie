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
  { key: 'compliance', label: 'Compliance', icon: 'shield' },
  { key: 'documents', label: 'Document Center', icon: 'folder' },
  { key: 'tasks', label: 'Task Management', icon: 'checklist' },
  { key: 'approvals', label: 'Approval Center', icon: 'checkSquare' },
  { key: 'notifications', label: 'Notifications', icon: 'bell' },
  { key: 'settings', label: 'Settings', icon: 'gear' },
];

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
  if (f.type === 'select') {
    const opts = f.options.map((o) => `<option value="${escapeHtml(o.value)}" ${String(o.value) === String(val) ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('');
    return `<select class="form-select" name="${f.name}" ${req}>${f.allowEmpty ? '<option value="">— None —</option>' : ''}${opts}</select>`;
  }
  if (f.type === 'textarea') {
    return `<textarea class="form-control" name="${f.name}" rows="${f.rows || 3}" ${req}>${escapeHtml(val)}</textarea>`;
  }
  if (f.type === 'checkbox') {
    return `<div class="form-check pt-2"><input type="checkbox" class="form-check-input" name="${f.name}" ${val ? 'checked' : ''}></div>`;
  }
  if (f.type === 'file') {
    return `<input type="file" class="form-control" name="${f.name}">`;
  }
  return `<input type="${f.type || 'text'}" class="form-control" name="${f.name}" value="${escapeHtml(val)}" ${req}>`;
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
  compliance: renderCompliance,
  documents: renderDocuments,
  tasks: renderTasks,
  approvals: renderApprovals,
  notifications: renderNotifications,
  settings: renderSettings,
};

async function route() {
  if (!State.user) return;
  const hash = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const key = hash.split('/')[0];
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
    const renderer = ROUTES[key] || renderDashboard;
    await renderer(content);
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
      <div class="col-md-3"><div class="card stat-card"><div class="card-body">
        <div class="stat-icon tone-indigo">${Icon('checklist')}</div>
        <div class="stat-value">${s.pendingTasksCount}</div>
        <div class="stat-label">My Pending Tasks</div>
      </div></div></div>
      <div class="col-md-3"><div class="card stat-card"><div class="card-body">
        <div class="stat-icon tone-amber">${Icon('checkSquare')}</div>
        <div class="stat-value">${s.pendingApprovalsCount}</div>
        <div class="stat-label">Pending Approvals (mine to review)</div>
      </div></div></div>
      <div class="col-md-3"><div class="card stat-card"><div class="card-body">
        <div class="stat-icon tone-rose">${Icon('bell')}</div>
        <div class="stat-value">${s.unreadNotificationsCount}</div>
        <div class="stat-label">Unread Notifications</div>
      </div></div></div>
      <div class="col-md-3"><div class="card stat-card"><div class="card-body">
        <div class="stat-icon tone-rose">${Icon('shield')}</div>
        <div class="stat-value">${s.counts.complianceOverdue}</div>
        <div class="stat-label">Overdue Compliance Items</div>
      </div></div></div>
    </div>
    <div class="row g-3">
      <div class="col-md-6">
        <div class="card stat-card h-100">
          <div class="card-header bg-white">Upcoming Deadlines (next 14 days)</div>
          <ul class="list-group list-group-flush">
            ${s.upcomingDeadlines.length ? s.upcomingDeadlines.map((d) => `
              <li class="list-group-item d-flex justify-content-between">
                <span><span class="badge text-bg-light border me-2">${d.type}</span>${escapeHtml(d.title)}</span>
                <span class="text-secondary">${fmtDate(d.date)}</span>
              </li>`).join('') : '<li class="list-group-item text-secondary">No upcoming deadlines.</li>'}
          </ul>
        </div>
      </div>
      <div class="col-md-6">
        <div class="card stat-card h-100">
          <div class="card-header bg-white">Recent Notifications</div>
          <ul class="list-group list-group-flush">
            ${s.recentNotifications.length ? s.recentNotifications.map((n) => `
              <li class="list-group-item d-flex justify-content-between">
                <span>${!n.isRead ? '<span class="notif-dot me-2"></span>' : ''}${escapeHtml(n.message)}</span>
                <span class="text-secondary small">${fmtDateTime(n.createdAt)}</span>
              </li>`).join('') : '<li class="list-group-item text-secondary">No notifications yet.</li>'}
          </ul>
        </div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Generic list page builder
// ---------------------------------------------------------------------------
function listToolbar({ title, canCreate, onCreate }) {
  return `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="mb-0">${escapeHtml(title)}</h5>
      ${canCreate ? `<button class="btn btn-primary btn-sm" id="btnCreate">${Icon('plus', 'me-1')}New</button>` : ''}
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
async function renderCases(content) {
  const [cases] = await Promise.all([Api.get('/api/cases')]);
  const canCreate = canDo('cases', 'create');
  const canEdit = canDo('cases', 'edit');
  const canDelete = canDo('cases', 'delete');
  content.innerHTML = listToolbar({ title: 'Case Management', canCreate }) + `
    <div class="card stat-card">
      <div class="table-responsive">
        <table class="table table-hover mb-0 table-clickable">
          <thead class="table-light"><tr><th>Case #</th><th>Title</th><th>Type</th><th>Owner</th><th>Priority</th><th>Status</th><th>Deadline</th><th></th></tr></thead>
          <tbody>
            ${cases.map((c) => `
              <tr data-id="${c.id}">
                <td>${escapeHtml(c.caseNumber)}</td>
                <td>${escapeHtml(c.title)}</td>
                <td>${escapeHtml(c.type)}</td>
                <td>${escapeHtml(userName(c.ownerId))}</td>
                <td>${priorityBadge(c.priority)}</td>
                <td>${badge(c.status)}</td>
                <td class="text-nowrap">${fmtDate(c.deadline)}</td>
                <td class="text-end">
                  ${canEdit ? `<button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${c.id}">${Icon('edit')}</button>` : ''}
                  ${canDelete ? `<button class="btn btn-sm btn-outline-danger btn-del" data-id="${c.id}">${Icon('trash')}</button>` : ''}
                </td>
              </tr>`).join('') || `<tr><td colspan="8" class="text-center text-secondary py-3">No cases yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;

  const fields = () => ([
    { name: 'title', label: 'Title', required: true },
    { name: 'type', label: 'Type', type: 'select', options: ['Regulatory', 'Commercial', 'IP', 'Litigation', 'Employment', 'Other'].map((v) => ({ value: v, label: v })), required: true },
    { name: 'ownerId', label: 'Owner', type: 'select', options: State.lookups.users.map((u) => ({ value: u.id, label: u.fullName })), required: true },
    { name: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'].map((v) => ({ value: v, label: v })), required: true },
    { name: 'status', label: 'Status', type: 'select', options: ['Open', 'In Progress', 'Closed'].map((v) => ({ value: v, label: v })), required: true },
    { name: 'deadline', label: 'Deadline', type: 'date' },
    { name: 'description', label: 'Description', type: 'textarea' },
  ]);

  if (canCreate) {
    content.querySelector('#btnCreate').addEventListener('click', () => {
      showFormModal({
        title: 'New Case', fields: fields(), initial: { status: 'Open', priority: 'Medium' },
        aiAssist: { module: 'cases' },
        onSubmit: async (data) => { await Api.post('/api/cases', data); toast('Case created'); route(); },
      });
    });
  }
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
// Page: Compliance
// ---------------------------------------------------------------------------
async function renderCompliance(content) {
  const rows = await Api.get('/api/compliance');
  const canCreate = canDo('compliance', 'create');
  const canEdit = canDo('compliance', 'edit');
  const canDelete = canDo('compliance', 'delete');
  content.innerHTML = listToolbar({ title: 'Compliance', canCreate }) + `
    <div class="card stat-card">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead class="table-light"><tr><th>Country</th><th>Regulation</th><th>Requirement</th><th>Owner</th><th>Due Date</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${rows.map((c) => `
              <tr>
                <td>${escapeHtml(c.country)}</td>
                <td>${escapeHtml(c.regulation)}</td>
                <td>${escapeHtml(c.requirement)}</td>
                <td>${escapeHtml(userName(c.ownerId))}</td>
                <td class="text-nowrap">${fmtDate(c.dueDate)}</td>
                <td>${badge(c.status)}</td>
                <td class="text-end">
                  ${canEdit ? `<button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${c.id}">${Icon('edit')}</button>` : ''}
                  ${canDelete ? `<button class="btn btn-sm btn-outline-danger btn-del" data-id="${c.id}">${Icon('trash')}</button>` : ''}
                </td>
              </tr>`).join('') || `<tr><td colspan="7" class="text-center text-secondary py-3">No compliance items yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;

  const fields = () => ([
    { name: 'country', label: 'Country / Jurisdiction', required: true },
    { name: 'regulation', label: 'Regulation', required: true },
    { name: 'requirement', label: 'Requirement', type: 'textarea', required: true },
    { name: 'ownerId', label: 'Owner', type: 'select', options: State.lookups.users.map((u) => ({ value: u.id, label: u.fullName })), required: true },
    { name: 'dueDate', label: 'Due Date', type: 'date' },
    { name: 'status', label: 'Status', type: 'select', options: ['Compliant', 'Due Soon', 'Overdue'].map((v) => ({ value: v, label: v })), required: true },
  ]);

  if (canCreate) content.querySelector('#btnCreate').addEventListener('click', () => {
    showFormModal({ title: 'New Compliance Item', fields: fields(), initial: { status: 'Compliant' },
      aiAssist: { module: 'compliance' },
      onSubmit: async (data) => { await Api.post('/api/compliance', data); toast('Compliance item created'); route(); } });
  });
  content.querySelectorAll('.btn-edit').forEach((btn) => btn.addEventListener('click', () => {
    const item = rows.find((c) => c.id === btn.dataset.id);
    showFormModal({ title: 'Edit Compliance Item', fields: fields(), initial: item,
      onSubmit: async (data) => { await Api.put(`/api/compliance/${item.id}`, data); toast('Updated'); route(); } });
  }));
  content.querySelectorAll('.btn-del').forEach((btn) => btn.addEventListener('click', async () => {
    if (!(await confirmDialog('Delete this compliance item?'))) return;
    await Api.del(`/api/compliance/${btn.dataset.id}`);
    toast('Deleted'); route();
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
          <thead class="table-light"><tr><th>Title</th><th>Category</th><th>File</th><th>Uploaded By</th><th>Uploaded</th><th></th></tr></thead>
          <tbody>
            ${docs.map((d) => `
              <tr>
                <td>${escapeHtml(d.title)}</td>
                <td><span class="badge text-bg-light border">${escapeHtml(d.category)}</span></td>
                <td>${d.filePath ? `<a href="/api/documents/${d.id}/download" class="text-decoration-none">${Icon('download', 'me-1')}${escapeHtml(d.fileName || 'file')}</a>` : `<span class="text-secondary">${escapeHtml(d.fileName || '—')}</span>`}</td>
                <td>${escapeHtml(userName(d.uploadedBy))}</td>
                <td class="text-nowrap">${fmtDate(d.createdAt)}</td>
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
    { name: 'category', label: 'Category', type: 'select', options: ['Templates', 'Policies', 'Agreements', 'Certificates', 'Other'].map((v) => ({ value: v, label: v })), required: true },
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
    <thead class="table-light"><tr><th>Role</th>${['Dashboard', 'Cases', 'Contracts', 'Compliance', 'Documents', 'Tasks', 'Approvals', 'Notifications', 'Settings'].map((m) => `<th class="text-center">${m}</th>`).join('')}</tr></thead>
    <tbody>
      ${roles.map((r) => `<tr>
        <td class="fw-semibold">${escapeHtml(r.name)}</td>
        ${['dashboard', 'cases', 'contracts', 'compliance', 'documents', 'tasks', 'approvals', 'notifications', 'settings'].map((m) => {
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
