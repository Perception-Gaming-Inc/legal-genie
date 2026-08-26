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
  const fullAccess = {};
  for (const m of ['dashboard', 'cases', 'documents', 'tasks', 'notifications', 'settings', 'knowledgeBase']) {
    fullAccess[m] = perm(true, true, true, true, true);
  }
  const roleAdmin = await store.insert('roles', { name: 'Admin', permissions: fullAccess });

  const roleManager = await store.insert('roles', {
    name: 'Legal Manager',
    permissions: {
      dashboard: perm(true, false, false, false),
      cases: perm(true, true, true, true),
      documents: perm(true, true, true, true),
      tasks: perm(true, true, true, true),
      notifications: perm(true, false, false, false),
      settings: perm(true, false, false, false),
      // A Manager curates the Knowledge Base (approving items into "Active"
      // status is effectively an edit), so full CRUD like the other content
      // modules above.
      knowledgeBase: perm(true, true, true, true),
    },
  });

  const roleStaff = await store.insert('roles', {
    name: 'Legal Staff',
    permissions: {
      dashboard: perm(true, false, false, false),
      cases: perm(true, true, true, false),
      documents: perm(true, true, true, false),
      tasks: perm(true, true, true, false),
      notifications: perm(true, false, false, false),
      settings: perm(false, false, false, false),
      // Staff can browse and contribute (e.g. submit a new FAQ or upload a
      // reference doc as Draft/Pending Review) but not delete or directly
      // publish — same view/create/edit-only shape as their other modules.
      knowledgeBase: perm(true, true, true, false),
    },
  });

  const roleViewer = await store.insert('roles', {
    name: 'Viewer',
    permissions: {
      dashboard: perm(true, false, false, false),
      cases: perm(true, false, false, false),
      documents: perm(true, false, false, false),
      tasks: perm(true, false, false, false),
      notifications: perm(true, false, false, false),
      settings: perm(false, false, false, false),
      knowledgeBase: perm(true, false, false, false),
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
  // filing workflow) — demonstrates the stage-tracking feature.
  const case4 = await store.insert('cases', {
    caseNumber: await store.nextNumber('case', 'CASE'),
    title: 'PAGCOR game submission - Fortune Dragon',
    type: 'Regulatory', ownerId: staff1.id, priority: 'High', status: 'In Progress',
    deadline: daysFromNow(14),
    description: 'Math model and RNG test report received from Provider; preparing PAGCOR submission package.',
    provider: 'FC', gameTitle: 'Fortune Dragon',
    pagcorStage: 'For Review',
  });
  const case5 = await store.insert('cases', {
    caseNumber: await store.nextNumber('case', 'CASE'),
    title: 'PAGCOR game submission - Golden Empire',
    type: 'Regulatory', ownerId: staff2.id, priority: 'Medium', status: 'Closed',
    deadline: daysFromNow(-10),
    description: 'LOA issued for this title; monitoring renewal date.',
    provider: 'JDB', gameTitle: 'Golden Empire',
    pagcorStage: 'Approved',
    loaExpiryDate: daysFromNow(20),
  });

  // ---- Contracts ---------------------------------------------------------
  // Note: the standalone Contract Management module/UI was removed at
  // Tiffany's request (2026-08-11) — there's no longer a nav item, page, or
  // /api/contracts CRUD for these. Still seeded here (on a fresh install
  // only) because Tasks' and Documents' "Related Contract" field reads
  // from this same `contracts` collection via /api/lookups, and existing
  // real contract records were explicitly kept, not deleted.
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

  // ---- Knowledge Base ----------------------------------------------------
  // Seeded from the real "PAGCOR Knowledge Base – Official Sources" pack
  // Tiffany put together (via GPT) as the initial source list for this
  // module — links to PAGCOR's own regulatory pages/PDFs rather than files
  // we host ourselves (documentType 'External Link', sourceUrl set,
  // filePath left null). Deliberately seeded as 'Pending Review', not
  // 'Active' — her source pack explicitly says this list should be
  // reviewed by the Legal Team before anything in it is marked Active for
  // real use, so the system should start in the same not-yet-approved
  // state rather than assuming it.
  await store.insert('kbDocuments', {
    title: 'PAGCOR Electronic Gaming Licensing — main page', category: 'Regulatory Framework',
    documentType: 'External Link', sourceUrl: 'https://www.pagcor.ph/regulatory/cegs.php',
    fileName: null, filePath: null, version: null, revisionNumber: null,
    publicationDate: null, effectivityDate: null, status: 'Pending Review',
    approvedBy: null, supersedesDocumentId: null, uploadedBy: admin.id,
    notes: 'Electronic Gaming Licensing Department scope; regulatory frameworks, application kits, operational request forms, schedule of fees, registered brands/domains.',
  });
  await store.insert('kbDocuments', {
    title: 'PAGCOR E-Games Licensing Department — announcements', category: 'Regulatory Framework',
    documentType: 'External Link', sourceUrl: 'https://www.pagcor.ph/regulatory/announcements-ebld.php',
    fileName: null, filePath: null, version: null, revisionNumber: null,
    publicationDate: null, effectivityDate: null, status: 'Pending Review',
    approvedBy: null, supersedesDocumentId: null, uploadedBy: admin.id,
    notes: 'Latest memoranda/regulatory updates, amendments, OneDrive repository updates, approved-game announcements, EG Form updates, B2B/distributor-related updates.',
  });
  const kbFramework3 = await store.insert('kbDocuments', {
    title: 'Regulatory Framework for Accreditation of Service Providers and Processing of System-Related Requests',
    category: 'Regulatory Framework', documentType: 'External Link',
    sourceUrl: 'https://www.pagcor.ph/regulatory/pdf/GSRM/Regulatory%20Manuals/Regulatory%20Framework%20for%20the%20Accreditation%20of%20Service%20Providers%20and%20Processing%20of%20System-Related%20Requests%20Rev.%20No.%203.pdf',
    fileName: null, filePath: null, version: 'Rev. No. 3', revisionNumber: '3',
    publicationDate: null, effectivityDate: '2025-02-27', status: 'Pending Review',
    approvedBy: null, supersedesDocumentId: null, uploadedBy: admin.id,
    notes: 'Service Provider accreditation, system-related requests, game/system approval processes, documentary requirements, testing/walkthrough and parameter-related requirements.',
  });
  await store.insert('kbDocuments', {
    title: 'PAGCOR Memorandum — Amendments to Existing Regulatory Frameworks for Electronic Gaming Operations',
    category: 'Regulatory Framework', documentType: 'External Link',
    sourceUrl: 'https://www.pagcor.ph/regulatory/pdf/App%20Kits/AMENDMENTS%20TO%20THE%20PROVISIONS%20OF%20EXISTING%20REGULATORY%20FRAMEWORKS%20FOR%20ELECTRONICS%20GAMING%20OPERATIONS.pdf',
    fileName: null, filePath: null, version: null, revisionNumber: null,
    publicationDate: '2025-02-27', effectivityDate: null, status: 'Pending Review',
    approvedBy: null, supersedesDocumentId: kbFramework3.id, uploadedBy: admin.id,
    notes: '2025 amendments; use for cross-checking whether older requirements have been amended.',
  });
  await store.insert('kbDocuments', {
    title: 'PAGCOR Memorandum — Approval of Currently Implemented Games',
    category: 'Game Approval', documentType: 'External Link',
    sourceUrl: 'https://www.pagcor.ph/regulatory/pdf/announcements/Memorandum-on-Approval-of-Currently-Implemented-Games.pdf',
    fileName: null, filePath: null, version: null, revisionNumber: null,
    publicationDate: '2025-06-02', effectivityDate: null, status: 'Pending Review',
    approvedBy: null, supersedesDocumentId: null, uploadedBy: admin.id,
    notes: 'Previously approved games currently allowed to be implemented; notification of implementation; Proposed Game List and Parameters Settings Checklist; progressive jackpot games and EG Form No. 9; minimum bet and RTP compliance.',
  });
  await store.insert('kbDocuments', {
    title: 'PAGCOR Application Kits', category: 'Application Forms',
    documentType: 'External Link', sourceUrl: 'https://www.pagcor.ph/regulatory/application-kit.php',
    fileName: null, filePath: null, version: null, revisionNumber: null,
    publicationDate: null, effectivityDate: null, status: 'Pending Review',
    approvedBy: null, supersedesDocumentId: null, uploadedBy: admin.id,
    notes: 'Official application forms; current form numbers; checking whether a form is an official PAGCOR application form.',
  });
  await store.insert('kbDocuments', {
    title: 'PAGCOR Regulatory Frameworks — index', category: 'Regulatory Framework',
    documentType: 'External Link', sourceUrl: 'https://www.pagcor.ph/regulatory/regulatory-manual-ebld.php',
    fileName: null, filePath: null, version: null, revisionNumber: null,
    publicationDate: null, effectivityDate: null, status: 'Pending Review',
    approvedBy: null, supersedesDocumentId: null, uploadedBy: admin.id,
    notes: 'Current regulatory framework index, amendments and annexes; identifying which framework should be reviewed for a specific question.',
  });
  await store.insert('kbDocuments', {
    title: 'PAGCOR Operational Request Forms', category: 'Operational Forms',
    documentType: 'External Link', sourceUrl: 'https://www.pagcor.ph/regulatory/operational-request-forms.php',
    fileName: null, filePath: null, version: null, revisionNumber: null,
    publicationDate: null, effectivityDate: null, status: 'Pending Review',
    approvedBy: null, supersedesDocumentId: null, uploadedBy: admin.id,
    notes: 'Official operational request forms; cross-checking form names/numbers.',
  });
  await store.insert('kbDocuments', {
    title: 'PAGCOR Regulatory Contact', category: 'Regulatory Framework',
    documentType: 'External Link', sourceUrl: 'https://www.pagcor.ph/regulatory/contact.php',
    fileName: null, filePath: null, version: null, revisionNumber: null,
    publicationDate: null, effectivityDate: null, status: 'Pending Review',
    approvedBy: null, supersedesDocumentId: null, uploadedBy: admin.id,
    notes: 'Official regulatory department contact information; escalation when the knowledge base cannot answer a question.',
  });

  // The announcements page above (kbDocuments #2) lists several specific
  // named memoranda/updates as bullet points rather than as their own
  // linked PDFs — broken out here into their own entries (at Tiffany's
  // request) so each is individually findable/filterable by category and
  // date instead of buried inside one general page. All point back to the
  // same announcements page URL since PAGCOR didn't give these their own
  // direct link in the source pack.
  const ANNOUNCEMENTS_URL = 'https://www.pagcor.ph/regulatory/announcements-ebld.php';
  await store.insert('kbDocuments', {
    title: 'Clarification on the Scope of the Unified Gaming License and Form 57 Requirements',
    category: 'System / Platform', documentType: 'External Link', sourceUrl: ANNOUNCEMENTS_URL,
    fileName: null, filePath: null, version: null, revisionNumber: null,
    publicationDate: '2026-07-16', effectivityDate: null, status: 'Pending Review',
    approvedBy: null, supersedesDocumentId: null, uploadedBy: admin.id,
    notes: 'Listed on the E-Games Licensing announcements page (no separate PDF link given). Clarifies Unified Gaming License scope and EG Form No. 57 requirements.',
  });
  await store.insert('kbDocuments', {
    title: 'Post-Operational Activities for GSAs and B2B Providers',
    category: 'Distributor / Reseller', documentType: 'External Link', sourceUrl: ANNOUNCEMENTS_URL,
    fileName: null, filePath: null, version: null, revisionNumber: null,
    publicationDate: '2026-07-13', effectivityDate: null, status: 'Pending Review',
    approvedBy: null, supersedesDocumentId: null, uploadedBy: admin.id,
    notes: 'Listed on the E-Games Licensing announcements page (no separate PDF link given).',
  });
  await store.insert('kbDocuments', {
    title: 'Unified Gaming License',
    category: 'System / Platform', documentType: 'External Link', sourceUrl: ANNOUNCEMENTS_URL,
    fileName: null, filePath: null, version: null, revisionNumber: null,
    publicationDate: '2026-07-06', effectivityDate: null, status: 'Pending Review',
    approvedBy: null, supersedesDocumentId: null, uploadedBy: admin.id,
    notes: 'Listed on the E-Games Licensing announcements page (no separate PDF link given).',
  });
  await store.insert('kbDocuments', {
    title: 'Implementation of EG Form No. 57 — Appointment as Exclusive Distributor/Reseller Declaration Form',
    category: 'Distributor / Reseller', documentType: 'External Link', sourceUrl: ANNOUNCEMENTS_URL,
    fileName: null, filePath: null, version: null, revisionNumber: null,
    publicationDate: '2026-07-06', effectivityDate: null, status: 'Pending Review',
    approvedBy: null, supersedesDocumentId: null, uploadedBy: admin.id,
    notes: 'Listed on the E-Games Licensing announcements page (no separate PDF link given).',
  });
  await store.insert('kbDocuments', {
    title: 'Migration to New OneDrive Repository for Game-Related Applications and Game Deployment of Currently Implemented Games',
    category: 'OneDrive / Submission Repository', documentType: 'External Link', sourceUrl: ANNOUNCEMENTS_URL,
    fileName: null, filePath: null, version: null, revisionNumber: null,
    publicationDate: '2026-02-09', effectivityDate: null, status: 'Pending Review',
    approvedBy: null, supersedesDocumentId: null, uploadedBy: admin.id,
    notes: 'Listed on the E-Games Licensing announcements page (no separate PDF link given).',
  });

  // ---- Knowledge Base FAQ --------------------------------------------------
  await store.insert('kbFaqs', {
    question: 'Where do I find the current official PAGCOR application forms?',
    answer: 'See the PAGCOR Application Kits page in this Knowledge Base — it links to the current official forms and form numbers directly from PAGCOR\'s site.',
    category: 'Application Forms', status: 'Pending Review', createdBy: admin.id,
  });
  await store.insert('kbFaqs', {
    question: 'How long after Submission Date should we follow up with PAGCOR?',
    answer: 'The system automatically creates a follow-up reminder 30 days after a case\'s Submit Date by default (configurable in Settings > Submission Settings).',
    category: 'Game Submission', status: 'Pending Review', createdBy: admin.id,
  });

  // ---- Tasks -----------------------------------------------------------
  await store.insert('tasks', {
    title: 'Draft response to Nevada Gaming Commission', description: 'Prepare formal response letter',
    assigneeId: manager.id, type: 'personal', status: 'In Progress', dueDate: daysFromNow(5),
    relatedCaseId: case1.id, relatedContractId: null, createdBy: admin.id,
  });
  await store.insert('tasks', {
    title: 'Collect delivery logs from supplier', description: 'For breach of contract evidence',
    assigneeId: staff1.id, type: 'team', status: 'To-Do', dueDate: daysFromNow(7),
    relatedCaseId: case2.id, relatedContractId: contract2.id, createdBy: manager.id,
  });
  await store.insert('tasks', {
    title: 'Renew Nevada gaming license filing', description: 'Submit annual renewal paperwork',
    assigneeId: manager.id, type: 'personal', status: 'To-Do', dueDate: daysFromNow(10),
    relatedCaseId: null, relatedContractId: null, createdBy: admin.id,
  });
  await store.insert('tasks', {
    title: 'Archive closed IP case documents', description: 'Move to long-term storage',
    assigneeId: staff2.id, type: 'personal', status: 'Completed', dueDate: daysFromNow(-2),
    relatedCaseId: case3.id, relatedContractId: null, createdBy: staff2.id,
  });

  // (The "Approvals" seed block that used to live here was removed
  // 2026-08-26 along with the Approval Center feature itself — see
  // server/routes.js and server/auth.js for the matching removal.)

  // ---- Notifications -------------------------------------------------
  await store.insert('notifications', {
    userId: manager.id, type: 'contract_expiry', message: 'PlayCloud License Agreement expires in 15 days', relatedId: contract1.id, relatedType: 'contract', isRead: false,
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
