'use strict';
const { Router, sendJson } = require('./router');
const store = require('./store');
const auth = require('./auth');
const storage = require('./storage');
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
// Dashboard
// ---------------------------------------------------------------------------
router.get('/api/dashboard/summary', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const today = new Date();
  const in14 = new Date(today.getTime() + 14 * 86400000);

  const [tasks, cases, contracts, compliance, notifications, approvals] = await Promise.all([
    store.all('tasks'), store.all('cases'), store.all('contracts'),
    store.all('compliance'), store.all('notifications'), store.all('approvals'),
  ]);

  const myTasks = tasks.filter((t) => t.assigneeId === user.id && t.status !== 'Completed');
  const allPendingTasks = tasks.filter((t) => t.status !== 'Completed');

  const upcomingDeadlines = [];
  cases.forEach((c) => {
    if (c.deadline && c.status !== 'Closed' && new Date(c.deadline) <= in14) {
      upcomingDeadlines.push({ type: 'Case', id: c.id, title: c.title, date: c.deadline });
    }
  });
  contracts.forEach((c) => {
    if (c.expiryDate && new Date(c.expiryDate) <= in14) {
      upcomingDeadlines.push({ type: 'Contract', id: c.id, title: c.title, date: c.expiryDate });
    }
  });
  compliance.forEach((c) => {
    if (c.dueDate && new Date(c.dueDate) <= in14) {
      upcomingDeadlines.push({ type: 'Compliance', id: c.id, title: c.requirement, date: c.dueDate });
    }
  });
  upcomingDeadlines.sort((a, b) => new Date(a.date) - new Date(b.date));

  const myNotifications = notifications
    .filter((n) => n.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10);

  const pendingApprovals = approvals.filter((a) => a.status === 'Pending' && a.reviewerId === user.id);

  sendJson(res, 200, {
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
      complianceOverdue: compliance.filter((c) => c.status === 'Overdue').length,
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
  onCreate: async (body) => ({ ...body, caseNumber: body.caseNumber || await store.nextNumber('case', 'CASE') }),
});

router.get('/api/cases/:id/notes', async (req, res, params) => {
  const user = await requirePerm(req, res, 'cases', 'view');
  if (!user) return;
  sendJson(res, 200, (await store.all('caseNotes')).filter((n) => n.caseId === params.id));
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

// Compliance ----------------------------------------------------------------
crudRoutes({ base: '/api/compliance', moduleName: 'compliance', collection: 'compliance' });

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
