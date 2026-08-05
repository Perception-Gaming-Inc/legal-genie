'use strict';
const store = require('./store');
const { hashPassword } = require('./auth');
const pagcor = require('./pagcor');

function perm(view, create, edit, del, approve = false) {
  return { view, create, edit, delete: del, approve };
}

// store.js is async on this deployment path (Supabase, over the network),
// so seed() is async too, with `await` before every insert. Safe to call
// on every cold start: the guard below checks the real database for
// existing users and returns immediately once it's already been seeded.
async function seed() {
  const existingUsers = await store.all('users');
  if (existingUsers.length > 0) return; // already seeded

  // ---- Departments ----------------------------------------------------
  const deptLegal = await store.insert('departments', { name: 'Legal Affairs' });
  const deptCompliance = await store.insert('departments', { name: 'Regulatory Compliance' });
  const deptIP = await store.insert('departments', { name: 'IP & Licensing' });

  // ---- Roles & permissions ---------------------------------------------
  // Note: 'assistant' (the AI Assistant chat) is deliberately NOT one of
  // these gated modules — see canView() in public/js/app.js. It's always
  // visible to any signed-in user regardless of role, since it's a
  // cross-cutting shortcut for using the app rather than its own data
  // module; any write action it proposes is still checked against the
  // *real* underlying module's own permission (cases/contracts/tasks)
  // below at execute-time.
  const fullAccess = {};
  for (const m of ['dashboard', 'cases', 'contracts', 'documents', 'tasks', 'approvals', 'notifications', 'settings']) {
    fullAccess[m] = perm(true, true, true, true, true);
  }
  const roleAdmin = await store.insert('roles', { name: 'Admin', permissions: fullAccess });

  const roleManager = await store.insert('roles', {
    name: 'Legal Manager',
    permissions: {
      dashboard: perm(true, false, false, false),
      cases: perm(true, true, true, true),
      contracts: perm(true, true, true, true),
      documents: perm(true, true, true, true),
      tasks: perm(true, true, true, true),
      approvals: perm(true, true, true, false, true),
      notifications: perm(true, false, false, false),
      settings: perm(true, false, false, false),
    },
  });

  const roleStaff = await store.insert('roles', {
    name: 'Legal Staff',
    permissions: {
      dashboard: perm(true, false, false, false),
      cases: perm(true, true, true, false),
      contracts: perm(true, true, true, false),
      documents: perm(true, true, true, false),
      tasks: perm(true, true, true, false),
      approvals: perm(true, true, false, false, false),
      notifications: perm(true, false, false, false),
      settings: perm(false, false, false, false),
    },
  });

  const roleViewer = await store.insert('roles', {
    name: 'Viewer',
    permissions: {
      dashboard: perm(true, false, false, false),
      cases: perm(true, false, false, false),
      contracts: perm(true, false, false, false),
      documents: perm(true, false, false, false),
      tasks: perm(true, false, false, false),
      approvals: perm(true, false, false, false),
      notifications: perm(true, false, false, false),
      settings: perm(false, false, false, false),
    },
  });

  // ---- Users -------------------------------------------------------------
  const admin = await store.insert('users', {
    username: 'admin', fullName: 'System Administrator', email: 'admin@company.com',
    departmentId: deptLegal.id, roleId: roleAdmin.id, status: 'active',
    passwordHash: hashPassword('admin123'),
  });
  const manager = await store.insert('users', {
    username: 'jchen', fullName: 'Jennifer Chen', email: 'jennifer.chen@company.com',
    departmentId: deptLegal.id, roleId: roleManager.id, status: 'active',
    passwordHash: hashPassword('password123'),
  });
  const staff1 = await store.insert('users', {
    username: 'mtan', fullName: 'Marcus Tan', email: 'marcus.tan@company.com',
    departmentId: deptCompliance.id, roleId: roleStaff.id, status: 'active',
    passwordHash: hashPassword('password123'),
  });
  const staff2 = await store.insert('users', {
    username: 'lwong', fullName: 'Linda Wong', email: 'linda.wong@company.com',
    departmentId: deptIP.id, roleId: roleStaff.id, status: 'active',
    passwordHash: hashPassword('password123'),
  });
  const viewer = await store.insert('users', {
    username: 'viewer', fullName: 'Executive Viewer', email: 'exec@company.com',
    departmentId: deptLegal.id, roleId: roleViewer.id, status: 'active',
    passwordHash: hashPassword('password123'),
  });

  const today = new Date();
  const daysFromNow = (n) => new Date(today.getTime() + n * 86400000).toISOString().slice(0, 10);

  // ---- Cases ---------------------------------------------------------
  const case1 = await store.insert('cases', {
    caseNumber: await store.nextNumber('case', 'CASE'),
    title: 'Gaming license dispute - Nevada Gaming Commission',
    type: 'Regulatory', ownerId: manager.id, priority: 'High', status: 'Open',
    deadline: daysFromNow(10), description: 'Response required regarding license renewal inquiry.',
  });
  const case2 = await store.insert('cases', {
    caseNumber: await store.nextNumber('case', 'CASE'),
    title: 'Vendor contract breach - slot machine parts supplier',
    type: 'Commercial', ownerId: staff1.id, priority: 'Medium', status: 'In Progress',
    deadline: daysFromNow(21), description: 'Supplier failed to meet delivery SLA in Q2 contract.',
  });
  const case3 = await store.insert('cases', {
    caseNumber: await store.nextNumber('case', 'CASE'),
    title: 'Employee IP assignment review',
    type: 'IP', ownerId: staff2.id, priority: 'Low', status: 'Closed',
    deadline: daysFromNow(-5), description: 'Completed review of invention assignment agreements.',
  });

  // ---- PAGCOR game-submission cases (Provider math model / RNG report /
  // filing workflow) — demonstrates the checklist + stage tracking feature.
  const case4 = await store.insert('cases', {
    caseNumber: await store.nextNumber('case', 'CASE'),
    title: 'PAGCOR game submission - Fortune Dragon',
    type: 'Regulatory', ownerId: staff1.id, priority: 'High', status: 'In Progress',
    deadline: daysFromNow(14),
    description: 'Math model and RNG test report received from Provider; preparing PAGCOR submission package.',
    provider: 'FC', gameTitle: 'Fortune Dragon',
    pagcorStage: 'Submitted to PAGCOR',
    pagcorChecklist: pagcor.PAGCOR_CHECKLIST_ITEMS.map((item, idx) => ({ ...item, done: idx < 2 })),
  });
  const case5 = await store.insert('cases', {
    caseNumber: await store.nextNumber('case', 'CASE'),
    title: 'PAGCOR game submission - Golden Empire',
    type: 'Regulatory', ownerId: staff2.id, priority: 'Medium', status: 'Closed',
    deadline: daysFromNow(-10),
    description: 'LOA issued for this title; monitoring renewal date.',
    provider: 'JDB', gameTitle: 'Golden Empire',
    pagcorStage: 'LOA Approved',
    pagcorChecklist: pagcor.PAGCOR_CHECKLIST_ITEMS.map((item) => ({ ...item, done: true })),
    loaExpiryDate: daysFromNow(20),
  });

  // ---- Contracts -------------------------------------------------------
  const contract1 = await store.insert('contracts', {
    contractNumber: await store.nextNumber('contract', 'CTR'),
    title: 'Online Gaming Platform License Agreement', counterparty: 'PlayCloud Technologies Ltd.',
    type: 'License', ownerId: manager.id, effectiveDate: daysFromNow(-200), expiryDate: daysFromNow(15),
    status: 'Active', caseId: null,
  });
  const contract2 = await store.insert('contracts', {
    contractNumber: await store.nextNumber('contract', 'CTR'),
    title: 'Slot Machine Component Supply Agreement', counterparty: 'MetroParts Manufacturing Inc.',
    type: 'Supply', ownerId: staff1.id, effectiveDate: daysFromNow(-400), expiryDate: daysFromNow(45),
    status: 'Active', caseId: case2.id,
  });
  const contract3 = await store.insert('contracts', {
    contractNumber: await store.nextNumber('contract', 'CTR'),
    title: 'Cloud Hosting Master Services Agreement', counterparty: 'NimbusHost Data Centers',
    type: 'Services', ownerId: staff2.id, effectiveDate: daysFromNow(-30), expiryDate: daysFromNow(700),
    status: 'Active', caseId: null,
  });
  await store.insert('contractVersions', {
    contractId: contract1.id, versionNo: 1, uploadedBy: manager.id, fileName: 'PlayCloud_License_v1.pdf', filePath: null, notes: 'Initial signed version',
  });
  await store.insert('contractVersions', {
    contractId: contract1.id, versionNo: 2, uploadedBy: manager.id, fileName: 'PlayCloud_License_v2_amendment.pdf', filePath: null, notes: 'Amendment: territory expansion',
  });

  // ---- Documents -----------------------------------------------------
  await store.insert('documents', {
    title: 'Standard NDA Template', category: 'Templates', uploadedBy: admin.id,
    fileName: 'NDA_Template_v3.docx', filePath: null, relatedCaseId: null, relatedContractId: null, tags: ['template', 'nda'],
  });
  await store.insert('documents', {
    title: 'Anti-Money Laundering Policy', category: 'Policies', uploadedBy: manager.id,
    fileName: 'AML_Policy_2026.pdf', filePath: null, relatedCaseId: null, relatedContractId: null, tags: ['policy', 'compliance'],
  });
  await store.insert('documents', {
    title: 'PlayCloud License Agreement (Signed)', category: 'Agreements', uploadedBy: manager.id,
    fileName: 'PlayCloud_License_Signed.pdf', filePath: null, relatedCaseId: null, relatedContractId: contract1.id, tags: ['agreement'],
  });
  await store.insert('documents', {
    title: 'Nevada Gaming License Certificate', category: 'Certificates', uploadedBy: manager.id,
    fileName: 'NV_Gaming_Cert_2026.pdf', filePath: null, relatedCaseId: case1.id, relatedContractId: null, tags: ['certificate', 'nevada'],
  });
  await store.insert('documents', {
    title: 'Fortune Dragon RNG Test Report', category: 'Certificates', uploadedBy: staff1.id,
    fileName: 'FortuneDragon_RNG_Report.pdf', filePath: null, relatedCaseId: case4.id, relatedContractId: null, tags: ['rng', 'pagcor'],
    provider: 'FC', gameTitle: 'Fortune Dragon', reportType: 'RNG Test Report',
  });
  await store.insert('documents', {
    title: 'Golden Empire Letter of Approval', category: 'Certificates', uploadedBy: staff2.id,
    fileName: 'GoldenEmpire_LOA.pdf', filePath: null, relatedCaseId: case5.id, relatedContractId: null, tags: ['loa', 'pagcor'],
    provider: 'JDB', gameTitle: 'Golden Empire', reportType: 'Letter of Approval (LOA)',
  });

  // ---- Tasks -----------------------------------------------------------
  await store.insert('tasks', {
    title: 'Draft response to Nevada Gaming Commission', description: 'Prepare formal response letter',
    assigneeId: manager.id, type: 'personal', status: 'In Progress', dueDate: daysFromNow(5),
    relatedCaseId: case1.id, relatedContractId: null, createdBy: admin.id,
  });
  await store.insert('tasks', {
    title: 'Collect delivery logs from supplier', description: 'For breach of contract evidence',
    assigneeId: staff1.id, type: 'team', status: 'Not Started', dueDate: daysFromNow(7),
    relatedCaseId: case2.id, relatedContractId: contract2.id, createdBy: manager.id,
  });
  await store.insert('tasks', {
    title: 'Renew Nevada gaming license filing', description: 'Submit annual renewal paperwork',
    assigneeId: manager.id, type: 'personal', status: 'Not Started', dueDate: daysFromNow(10),
    relatedCaseId: null, relatedContractId: null, createdBy: admin.id,
  });
  await store.insert('tasks', {
    title: 'Archive closed IP case documents', description: 'Move to long-term storage',
    assigneeId: staff2.id, type: 'personal', status: 'Completed', dueDate: daysFromNow(-2),
    relatedCaseId: case3.id, relatedContractId: null, createdBy: staff2.id,
  });

  // ---- Approvals ---------------------------------------------------------
  await store.insert('approvals', {
    title: 'Approve PlayCloud amendment execution', type: 'contract', requestedBy: manager.id,
    reviewerId: admin.id, status: 'Pending', comments: [], relatedId: contract1.id, relatedType: 'contract',
  });
  await store.insert('approvals', {
    title: 'Approve new AML policy publication', type: 'document', requestedBy: staff1.id,
    reviewerId: manager.id, status: 'Approved', comments: [{ by: manager.id, text: 'Looks good, approved.', at: new Date().toISOString() }],
    relatedId: null, relatedType: 'document',
  });
  await store.insert('approvals', {
    title: 'Approve MetroParts breach escalation to litigation', type: 'case', requestedBy: staff1.id,
    reviewerId: manager.id, status: 'Rejected', comments: [{ by: manager.id, text: 'Try negotiation first before litigation.', at: new Date().toISOString() }],
    relatedId: case2.id, relatedType: 'case',
  });

  // ---- Notifications -------------------------------------------------
  await store.insert('notifications', {
    userId: manager.id, type: 'contract_expiry', message: 'PlayCloud License Agreement expires in 15 days', relatedId: contract1.id, relatedType: 'contract', isRead: false,
  });
  await store.insert('notifications', {
    userId: admin.id, type: 'approval_pending', message: 'PlayCloud amendment execution is awaiting your approval', relatedId: null, relatedType: 'approval', isRead: false,
  });
  await store.insert('notifications', {
    userId: staff1.id, type: 'task_assigned', message: 'You were assigned: Collect delivery logs from supplier', relatedId: null, relatedType: 'task', isRead: true,
  });

  console.log('Database seeded with demo data.');
  console.log('Login accounts (username / password):');
  console.log('  admin / admin123        (Admin - full access)');
  console.log('  jchen / password123     (Legal Manager)');
  console.log('  mtan  / password123     (Legal Staff)');
  console.log('  lwong / password123     (Legal Staff)');
  console.log('  viewer/ password123     (Viewer - read-only)');
}

module.exports = { seed };
