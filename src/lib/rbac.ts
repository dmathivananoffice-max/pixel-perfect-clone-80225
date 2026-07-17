// Enterprise Roles & Permissions data model — frontend mock store.
// Future-proof: unlimited roles, groups, modules, actions.

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'assign'
  | 'export'
  | 'import'
  | 'manage'
  | 'configure';

export const ACTION_LABEL: Record<PermissionAction, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  approve: 'Approve',
  assign: 'Assign',
  export: 'Export',
  import: 'Import',
  manage: 'Manage',
  configure: 'Configure',
};

export interface Permission {
  key: string; // e.g. "candidates.view"
  label: string;
  actions: PermissionAction[];
}

export interface PermissionGroup {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
}

export interface Role {
  id: string;
  name: string;
  description: string;
  system: boolean; // cannot be deleted
  userCount: number;
  createdBy: string;
  lastModified: string; // ISO
  // Map of permission.key -> selected actions
  grants: Record<string, PermissionAction[]>;
}

export interface AuditEntry {
  id: string;
  roleId: string;
  roleName: string;
  actor: string;
  timestamp: string;
  summary: string;
  before?: string;
  after?: string;
  reason?: string;
}

// ---------- Permission catalog ----------

const A = {
  read: ['view'] as PermissionAction[],
  crud: ['view', 'create', 'edit', 'delete'] as PermissionAction[],
  crudApprove: ['view', 'create', 'edit', 'delete', 'approve'] as PermissionAction[],
  workflow: ['view', 'create', 'edit', 'approve', 'assign'] as PermissionAction[],
  full: [
    'view',
    'create',
    'edit',
    'delete',
    'approve',
    'assign',
    'export',
    'import',
    'manage',
    'configure',
  ] as PermissionAction[],
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Home screens, KPIs and analytics widgets.',
    permissions: [
      { key: 'dashboard.view', label: 'View Dashboard', actions: A.read },
      { key: 'dashboard.kpis', label: 'View KPIs', actions: A.read },
      { key: 'dashboard.analytics', label: 'View Analytics', actions: A.read },
    ],
  },
  {
    id: 'candidates',
    name: 'Candidate Management',
    description: 'Candidate records, bulk operations and assignment.',
    permissions: [
      { key: 'candidates.view', label: 'View Candidates', actions: A.read },
      { key: 'candidates.record', label: 'Candidate Record', actions: A.crud },
      { key: 'candidates.bulk_upload', label: 'Bulk Upload', actions: ['import', 'create'] },
      { key: 'candidates.export', label: 'Export', actions: ['export'] },
      { key: 'candidates.merge', label: 'Merge Duplicates', actions: ['manage'] },
      { key: 'candidates.assign', label: 'Assign Recruiter', actions: ['assign'] },
    ],
  },
  {
    id: 'intake',
    name: 'Candidate Intake',
    description: 'Single and bulk intake, AI parsing and approvals.',
    permissions: [
      { key: 'intake.single', label: 'Single Intake', actions: ['create'] },
      { key: 'intake.bulk', label: 'Bulk Intake', actions: ['create', 'import'] },
      { key: 'intake.ai_parsing', label: 'AI Parsing', actions: ['manage'] },
      { key: 'intake.manual_verify', label: 'Manual Verification', actions: ['view', 'edit'] },
      { key: 'intake.approve', label: 'Candidate Approval', actions: ['approve'] },
      { key: 'intake.reject', label: 'Reject Candidate', actions: ['manage'] },
    ],
  },
  {
    id: 'verification',
    name: 'Verification Studio',
    description: 'Document extraction, verification and escalation flow.',
    permissions: [
      { key: 'verify.view', label: 'View Verification', actions: A.read },
      { key: 'verify.edit', label: 'Edit Extracted Data', actions: ['edit'] },
      { key: 'verify.documents', label: 'Verify Documents', actions: ['approve'] },
      { key: 'verify.approve', label: 'Approve Verification', actions: ['approve'] },
      { key: 'verify.escalate', label: 'Escalate Review', actions: ['manage'] },
      { key: 'verify.return_ai', label: 'Return to AI Queue', actions: ['manage'] },
    ],
  },
  {
    id: 'ai',
    name: 'AI Mission Control',
    description: 'AI issue queue, batch resolution and configuration.',
    permissions: [
      { key: 'ai.issues.view', label: 'View AI Issues', actions: A.read },
      { key: 'ai.issues.resolve', label: 'Resolve Issues', actions: ['manage'] },
      { key: 'ai.issues.batch', label: 'Batch Resolve', actions: ['manage'] },
      { key: 'ai.configure', label: 'AI Configuration', actions: ['configure'] },
    ],
  },
  {
    id: 'selection',
    name: 'Selection Engine',
    description: 'Scoring, gates, products and ranking approvals.',
    permissions: [
      { key: 'selection.scoring', label: 'Configure Scoring', actions: ['configure'] },
      { key: 'selection.gates', label: 'Configure Gates', actions: ['configure'] },
      { key: 'selection.products', label: 'Configure Products', actions: ['configure'] },
      { key: 'selection.rankings', label: 'Approve Rankings', actions: ['approve'] },
    ],
  },
  {
    id: 'speaking',
    name: 'Speaking Assessment',
    description: 'STI-style spoken language evaluation.',
    permissions: [
      { key: 'speaking.assign', label: 'Assign Assessment', actions: ['assign'] },
      { key: 'speaking.results', label: 'View Results', actions: A.read },
      { key: 'speaking.scores', label: 'Edit Scores', actions: ['edit'] },
      { key: 'speaking.approve', label: 'Approve', actions: ['approve'] },
    ],
  },
  {
    id: 'training',
    name: 'Language Academy',
    description: 'Training assignment, attendance and completion.',
    permissions: [
      { key: 'training.assign', label: 'Assign Training', actions: ['assign'] },
      { key: 'training.attendance', label: 'Record Attendance', actions: ['edit'] },
      { key: 'training.scores', label: 'Enter Scores', actions: ['edit'] },
      { key: 'training.complete', label: 'Approve Completion', actions: ['approve'] },
    ],
  },
  {
    id: 'interview',
    name: 'Interview',
    description: 'Interview scheduling and multi-level evaluation.',
    permissions: [
      { key: 'interview.schedule', label: 'Schedule Interview', actions: ['create', 'edit'] },
      { key: 'interview.l1', label: 'Interview Level 1', actions: ['edit'] },
      { key: 'interview.l2', label: 'Interview Level 2', actions: ['edit'] },
      { key: 'interview.employer', label: 'Employer Interview', actions: ['edit'] },
      { key: 'interview.scores', label: 'Record Scores', actions: ['edit'] },
      { key: 'interview.approve', label: 'Approve Interview', actions: ['approve'] },
    ],
  },
  {
    id: 'documents',
    name: 'Document Management',
    description: 'Upload, replace, review and AI review of documents.',
    permissions: [
      { key: 'documents.upload', label: 'Upload', actions: ['create'] },
      { key: 'documents.replace', label: 'Replace', actions: ['edit'] },
      { key: 'documents.rename', label: 'Rename', actions: ['edit'] },
      { key: 'documents.download', label: 'Download', actions: ['export'] },
      { key: 'documents.delete', label: 'Delete', actions: ['delete'] },
      { key: 'documents.ai_review', label: 'AI Review', actions: ['manage'] },
      { key: 'documents.visa_ready', label: 'Visa-Ready Review', actions: ['approve'] },
    ],
  },
  {
    id: 'signature',
    name: 'Signature Workflow',
    description: 'Digital signatures and audit trail.',
    permissions: [
      { key: 'sign.send', label: 'Send for Signature', actions: ['create'] },
      { key: 'sign.candidate', label: 'Candidate Signature', actions: ['approve'] },
      { key: 'sign.school', label: 'School Signature', actions: ['approve'] },
      { key: 'sign.landlord', label: 'Landlord Signature', actions: ['approve'] },
      { key: 'sign.hr', label: 'HR Signature', actions: ['approve'] },
      { key: 'sign.audit', label: 'View Audit Trail', actions: A.read },
    ],
  },
  {
    id: 'recognition',
    name: 'Recognition',
    description: 'Anerkennung and qualification review.',
    permissions: [
      { key: 'recognition.docs', label: 'Recognition Documents', actions: A.crud },
      { key: 'recognition.defizit', label: 'Defizitbescheid', actions: A.workflow },
      { key: 'recognition.anerkennung', label: 'Anerkennung', actions: A.workflow },
      { key: 'recognition.review', label: 'Qualification Review', actions: ['approve'] },
    ],
  },
  {
    id: 'visa',
    name: 'Visa',
    description: 'Visa documents, employer & embassy paperwork.',
    permissions: [
      { key: 'visa.docs', label: 'Visa Documents', actions: A.crud },
      { key: 'visa.employer_docs', label: 'Employer Documents', actions: A.crud },
      { key: 'visa.embassy_docs', label: 'Embassy Documents', actions: A.crud },
      { key: 'visa.track', label: 'Track Visa', actions: ['view', 'edit'] },
    ],
  },
  {
    id: 'employers',
    name: 'Employer Management',
    description: 'Employer accounts, contracts and vacancies.',
    permissions: [
      { key: 'employers.view', label: 'View Employers', actions: A.read },
      { key: 'employers.record', label: 'Employer Record', actions: A.crud },
      { key: 'employers.contracts', label: 'Contracts', actions: A.crudApprove },
      { key: 'employers.vacancies', label: 'Vacancies', actions: A.crud },
    ],
  },
  {
    id: 'recruiter_hub',
    name: 'Recruiter Hub',
    description: 'Recruiter workspace, assignments and performance.',
    permissions: [
      { key: 'hub.view', label: 'View', actions: A.read },
      { key: 'hub.assign', label: 'Assign Candidates', actions: ['assign'] },
      { key: 'hub.performance', label: 'Performance', actions: A.read },
      { key: 'hub.notes', label: 'Notes', actions: ['create', 'edit'] },
    ],
  },
  {
    id: 'email',
    name: 'Communication',
    description: 'Email center, templates and bulk email.',
    permissions: [
      { key: 'email.view', label: 'View', actions: A.read },
      { key: 'email.send', label: 'Send', actions: ['create'] },
      { key: 'email.templates', label: 'Templates', actions: A.crud },
      { key: 'email.ai_draft', label: 'AI Draft', actions: ['manage'] },
      { key: 'email.bulk', label: 'Bulk Email', actions: ['create'] },
    ],
  },
  {
    id: 'reports',
    name: 'Reports',
    description: 'Operational, financial and productivity reporting.',
    permissions: [
      { key: 'reports.view', label: 'View', actions: A.read },
      { key: 'reports.export', label: 'Export', actions: ['export'] },
      { key: 'reports.create', label: 'Create Reports', actions: ['create'] },
      { key: 'reports.financial', label: 'Financial Reports', actions: A.read },
      { key: 'reports.productivity', label: 'Productivity Reports', actions: A.read },
    ],
  },
  {
    id: 'finance',
    name: 'Finance',
    description: 'Invoicing, payments and accounting.',
    permissions: [
      { key: 'finance.view', label: 'View', actions: A.read },
      { key: 'finance.invoice', label: 'Invoice', actions: A.crud },
      { key: 'finance.payments', label: 'Payments', actions: A.workflow },
      { key: 'finance.refunds', label: 'Refunds', actions: ['approve'] },
      { key: 'finance.accounting', label: 'Accounting', actions: ['manage'] },
    ],
  },
  {
    id: 'users',
    name: 'User Management',
    description: 'Internal users and access controls.',
    permissions: [
      { key: 'users.create', label: 'Create User', actions: ['create'] },
      { key: 'users.edit', label: 'Edit User', actions: ['edit'] },
      { key: 'users.disable', label: 'Disable User', actions: ['manage'] },
      { key: 'users.reset', label: 'Reset Password', actions: ['manage'] },
      { key: 'users.assign_roles', label: 'Assign Roles', actions: ['assign'] },
    ],
  },
  {
    id: 'roles',
    name: 'Roles & Permissions',
    description: 'Authorization system. Guarded — Super Admin only.',
    permissions: [
      { key: 'roles.create', label: 'Create Role', actions: ['create'] },
      { key: 'roles.delete', label: 'Delete Role', actions: ['delete'] },
      { key: 'roles.change', label: 'Change Permissions', actions: ['configure'] },
    ],
  },
  {
    id: 'system',
    name: 'System',
    description: 'Reserved for platform-level operations and future modules.',
    permissions: [
      { key: 'system.audit', label: 'Audit Log', actions: A.read },
      { key: 'system.integrations', label: 'Integrations', actions: ['configure'] },
      { key: 'system.future', label: 'Future Modules', actions: ['manage'] },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key)
);

// ---------- Role templates ----------

function full(): Record<string, PermissionAction[]> {
  const map: Record<string, PermissionAction[]> = {};
  for (const g of PERMISSION_GROUPS) {
    for (const p of g.permissions) map[p.key] = [...p.actions];
  }
  return map;
}

function only(
  groupIds: string[],
  extras: Record<string, PermissionAction[]> = {}
): Record<string, PermissionAction[]> {
  const map: Record<string, PermissionAction[]> = {};
  for (const g of PERMISSION_GROUPS) {
    if (!groupIds.includes(g.id)) continue;
    for (const p of g.permissions) map[p.key] = [...p.actions];
  }
  return { ...map, ...extras };
}

function readOnly(): Record<string, PermissionAction[]> {
  const map: Record<string, PermissionAction[]> = {};
  for (const g of PERMISSION_GROUPS) {
    for (const p of g.permissions) {
      if (p.actions.includes('view')) map[p.key] = ['view'];
    }
  }
  return map;
}

export const ROLE_TEMPLATES: Role[] = [
  {
    id: 'role-super-admin',
    name: 'Super Administrator',
    description: 'Unrestricted access to every module, including roles and system settings.',
    system: true,
    userCount: 2,
    createdBy: 'System',
    lastModified: '2025-11-02T10:15:00Z',
    grants: full(),
  },
  {
    id: 'role-managing-director',
    name: 'Managing Director',
    description: 'Business-wide access. Cannot modify system architecture or roles.',
    system: true,
    userCount: 1,
    createdBy: 'System',
    lastModified: '2025-10-28T09:00:00Z',
    grants: (() => {
      const g = full();
      delete g['roles.create'];
      delete g['roles.delete'];
      delete g['roles.change'];
      delete g['system.integrations'];
      delete g['system.future'];
      return g;
    })(),
  },
  {
    id: 'role-operations-manager',
    name: 'Operations Manager',
    description: 'End-to-end candidate operations across intake, verification and placement.',
    system: false,
    userCount: 3,
    createdBy: 'Deeban',
    lastModified: '2025-10-24T14:20:00Z',
    grants: only([
      'dashboard', 'candidates', 'intake', 'verification', 'ai',
      'training', 'interview', 'documents', 'reports', 'recruiter_hub', 'email',
    ]),
  },
  {
    id: 'role-senior-recruiter',
    name: 'Senior Recruiter',
    description: 'Full recruitment permissions including bulk operations and approvals.',
    system: false,
    userCount: 4,
    createdBy: 'Deeban',
    lastModified: '2025-10-20T11:05:00Z',
    grants: only([
      'dashboard', 'candidates', 'intake', 'verification',
      'training', 'interview', 'documents', 'email', 'recruiter_hub',
    ]),
  },
  {
    id: 'role-recruiter',
    name: 'Recruiter',
    description: 'Daily recruitment operations. No bulk delete, no configuration.',
    system: true,
    userCount: 12,
    createdBy: 'System',
    lastModified: '2025-10-18T08:40:00Z',
    grants: (() => {
      const map: Record<string, PermissionAction[]> = {};
      const allowed = ['dashboard', 'candidates', 'intake', 'training', 'interview', 'documents', 'email', 'recruiter_hub'];
      for (const g of PERMISSION_GROUPS) {
        if (!allowed.includes(g.id)) continue;
        for (const p of g.permissions) {
          map[p.key] = p.actions.filter((a) => a !== 'delete' && a !== 'configure');
        }
      }
      return map;
    })(),
  },
  {
    id: 'role-speaking',
    name: 'Speaking Assessment Team',
    description: 'Restricted to the speaking assessment workflow.',
    system: false,
    userCount: 2,
    createdBy: 'Deeban',
    lastModified: '2025-10-15T12:00:00Z',
    grants: only(['speaking'], { 'candidates.view': ['view'], 'dashboard.view': ['view'] }),
  },
  {
    id: 'role-training-coordinator',
    name: 'Training Coordinator',
    description: 'Language Academy — attendance, scoring and completion approvals.',
    system: false,
    userCount: 2,
    createdBy: 'Deeban',
    lastModified: '2025-10-14T09:30:00Z',
    grants: only(['training'], { 'candidates.view': ['view'], 'dashboard.view': ['view'] }),
  },
  {
    id: 'role-interview',
    name: 'Interview Coordinator',
    description: 'Owns interview scheduling and multi-level evaluations only.',
    system: false,
    userCount: 2,
    createdBy: 'Deeban',
    lastModified: '2025-10-12T15:45:00Z',
    grants: only(['interview'], { 'candidates.view': ['view'], 'dashboard.view': ['view'] }),
  },
  {
    id: 'role-doc-officer',
    name: 'Documentation Officer',
    description: 'Documents, verification and visa preparation.',
    system: true,
    userCount: 3,
    createdBy: 'System',
    lastModified: '2025-10-10T13:20:00Z',
    grants: only(['documents', 'verification', 'visa', 'signature'], { 'candidates.view': ['view'], 'dashboard.view': ['view'] }),
  },
  {
    id: 'role-visa',
    name: 'Visa Officer',
    description: 'Visa processing only — track, prepare and submit.',
    system: false,
    userCount: 2,
    createdBy: 'Deeban',
    lastModified: '2025-10-08T10:10:00Z',
    grants: only(['visa'], { 'candidates.view': ['view'], 'documents.download': ['export'] }),
  },
  {
    id: 'role-recognition',
    name: 'Recognition Officer',
    description: 'Anerkennung, Defizitbescheid and qualification review workflow.',
    system: false,
    userCount: 1,
    createdBy: 'Deeban',
    lastModified: '2025-10-06T09:00:00Z',
    grants: only(['recognition'], { 'candidates.view': ['view'], 'documents.download': ['export'] }),
  },
  {
    id: 'role-employer-relations',
    name: 'Employer Relations',
    description: 'Employer accounts, contracts and vacancy management.',
    system: false,
    userCount: 2,
    createdBy: 'Deeban',
    lastModified: '2025-10-04T14:00:00Z',
    grants: only(['employers'], { 'dashboard.view': ['view'], 'reports.view': ['view'] }),
  },
  {
    id: 'role-language-academy',
    name: 'Language Academy',
    description: 'Language school management including training and speaking assessment.',
    system: false,
    userCount: 3,
    createdBy: 'Deeban',
    lastModified: '2025-10-02T11:15:00Z',
    grants: only(['training', 'speaking'], { 'candidates.view': ['view'] }),
  },
  {
    id: 'role-finance',
    name: 'Finance',
    description: 'Invoicing, payments and financial reporting.',
    system: false,
    userCount: 2,
    createdBy: 'Deeban',
    lastModified: '2025-09-30T16:40:00Z',
    grants: only(['finance'], { 'reports.financial': ['view'], 'reports.view': ['view'] }),
  },
  {
    id: 'role-hr',
    name: 'HR',
    description: 'Internal user administration.',
    system: false,
    userCount: 1,
    createdBy: 'Deeban',
    lastModified: '2025-09-28T09:00:00Z',
    grants: only(['users'], { 'dashboard.view': ['view'] }),
  },
  {
    id: 'role-marketing',
    name: 'Marketing',
    description: 'Marketing operations. Read-only across candidate data.',
    system: false,
    userCount: 2,
    createdBy: 'Deeban',
    lastModified: '2025-09-26T14:30:00Z',
    grants: {
      'dashboard.view': ['view'],
      'candidates.view': ['view'],
      'email.templates': ['view', 'create', 'edit'],
      'email.bulk': ['create'],
      'reports.view': ['view'],
    },
  },
  {
    id: 'role-sales-exec',
    name: 'Sales Executive',
    description: 'Lead management and employer prospecting.',
    system: false,
    userCount: 4,
    createdBy: 'Deeban',
    lastModified: '2025-09-24T12:00:00Z',
    grants: {
      'dashboard.view': ['view'],
      'employers.view': ['view'],
      'employers.record': ['view', 'create', 'edit'],
      'employers.vacancies': ['view', 'create', 'edit'],
      'email.send': ['create'],
    },
  },
  {
    id: 'role-sales-mgr',
    name: 'Sales Manager',
    description: 'Lead management plus reporting and team oversight.',
    system: false,
    userCount: 1,
    createdBy: 'Deeban',
    lastModified: '2025-09-22T10:00:00Z',
    grants: {
      'dashboard.view': ['view'],
      'dashboard.kpis': ['view'],
      'employers.view': ['view'],
      'employers.record': ['view', 'create', 'edit', 'delete'],
      'employers.vacancies': ['view', 'create', 'edit', 'delete'],
      'reports.view': ['view'],
      'reports.export': ['export'],
    },
  },
  {
    id: 'role-viewer',
    name: 'Viewer',
    description: 'Read-only observer across permitted modules.',
    system: true,
    userCount: 5,
    createdBy: 'System',
    lastModified: '2025-09-20T09:00:00Z',
    grants: readOnly(),
  },
];

// ---------- Mock user assignments ----------

export interface RoleUser {
  id: string;
  name: string;
  email: string;
  department: string;
}

export const MOCK_USERS_BY_ROLE: Record<string, RoleUser[]> = {
  'role-super-admin': [
    { id: 'u-1', name: 'Deeban', email: 'deeban@workforce-europe.com', department: 'Management' },
    { id: 'u-2', name: 'Anika Weber', email: 'anika@workforce-europe.com', department: 'Management' },
  ],
  'role-managing-director': [
    { id: 'u-3', name: 'Klaus Berger', email: 'klaus.berger@workforce-europe.com', department: 'Management' },
  ],
  'role-recruiter': [
    { id: 'u-4', name: 'Lisa Anderson', email: 'lisa@workforce-europe.com', department: 'Recruitment' },
    { id: 'u-5', name: 'Priya Nair', email: 'priya@workforce-europe.com', department: 'Recruitment' },
  ],
};

export const INITIAL_AUDIT: AuditEntry[] = [
  {
    id: 'a-1',
    roleId: 'role-recruiter',
    roleName: 'Recruiter',
    actor: 'Deeban',
    timestamp: '2025-10-18T08:40:00Z',
    summary: 'Enabled Export on Candidates',
    before: 'view, create, edit',
    after: 'view, create, edit, export',
    reason: 'Recruiters requested CSV export for weekly reviews.',
  },
  {
    id: 'a-2',
    roleId: 'role-visa',
    roleName: 'Visa Officer',
    actor: 'Deeban',
    timestamp: '2025-10-08T10:10:00Z',
    summary: 'Created role from template',
    reason: 'Split visa work out of Documentation Officer scope.',
  },
];
