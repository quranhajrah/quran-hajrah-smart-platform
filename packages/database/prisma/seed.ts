import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const roles = [
  ['super_admin', 'مدير النظام العام'],
  ['board_chair', 'رئيس مجلس الإدارة'],
  ['executive_director', 'المدير التنفيذي'],
  ['operations_manager', 'مدير العمليات'],
  ['finance_manager', 'المدير المالي'],
  ['education_manager', 'مدير التعليم'],
  ['governance_officer', 'مسؤول الحوكمة'],
  ['employee', 'موظف'],
  ['viewer', 'مشاهد'],
] as const;

const permissions = [
  ['users.view', 'عرض المستخدمين', 'users'],
  ['users.create', 'إنشاء مستخدم', 'users'],
  ['users.update', 'تعديل المستخدمين', 'users'],
  ['users.disable', 'تعطيل المستخدمين', 'users'],
  ['users.assign_roles', 'إسناد الأدوار', 'users'],
  ['roles.view', 'عرض الأدوار', 'roles'],
  ['roles.manage', 'إدارة الأدوار', 'roles'],
  ['dashboard.view', 'عرض الصفحة الرئيسية', 'dashboard'],
  ['audit.view', 'عرض سجل العمليات', 'audit'],
  ['settings.manage', 'إدارة الإعدادات', 'settings'],
  ['documents.view', 'عرض مركز المعرفة', 'documents'],
  ['documents.create', 'إنشاء بيانات مستند', 'documents'],
  ['documents.update', 'تعديل بيانات المستندات', 'documents'],
  ['documents.upload', 'رفع المستندات والإصدارات', 'documents'],
  ['documents.download', 'تنزيل المستندات', 'documents'],
  ['documents.archive', 'أرشفة المستندات واستعادتها', 'documents'],
  ['documents.delete', 'حذف المستندات حذفًا منطقيًا', 'documents'],
  ['documents.audit', 'عرض سجل تدقيق المستندات', 'documents'],
  ['documents.manage_access', 'إدارة الوصول إلى المستندات السرية', 'documents'],
  ['dashboard.configure', 'تهيئة لوحة القيادة التنفيذية', 'dashboard'],
  ['metrics.view', 'عرض المؤشرات المؤسسية', 'metrics'],
  ['metrics.manage', 'إدارة تعريفات المؤشرات المؤسسية', 'metrics'],
  ['metrics.measure', 'تسجيل قياسات المؤشرات المؤسسية', 'metrics'],
  ['strategy.view', 'عرض الأهداف الاستراتيجية', 'strategy'],
  ['strategy.manage', 'إدارة الأهداف الاستراتيجية', 'strategy'],
  ['kpi.view', 'عرض مؤشرات الأداء الاستراتيجية', 'kpi'],
  ['kpi.manage', 'إدارة مؤشرات الأداء الاستراتيجية', 'kpi'],
  ['kpi.measure', 'تسجيل قياسات مؤشرات الأداء', 'kpi'],
  ['initiatives.view', 'عرض المبادرات التشغيلية', 'initiatives'],
  ['initiatives.manage', 'إدارة المبادرات التشغيلية', 'initiatives'],
  ['risks.view', 'عرض سجل المخاطر المؤسسية', 'risks'],
  ['risks.manage', 'إدارة المخاطر ومعالجاتها', 'risks'],
  ['alerts.view', 'عرض مركز التنبيهات التنفيذية', 'alerts'],
  ['alerts.manage', 'إدارة التنبيهات التنفيذية', 'alerts'],
  ['reports.view', 'عرض التقارير التنفيذية', 'reports'],
  ['reports.create', 'إنشاء التقارير التنفيذية', 'reports'],
  ['reports.approve', 'اعتماد التقارير التنفيذية', 'reports'],
  ['executive.query', 'استخدام مساعد البيانات المؤسسية', 'executive'],
] as const;

const categories = [
  ['strategic-plans', 'الخطط الاستراتيجية'],
  ['operational-plans', 'الخطط التشغيلية'],
  ['budgets', 'الموازنات'],
  ['policies-regulations', 'اللوائح والسياسات'],
  ['governance-compliance', 'الحوكمة والامتثال'],
  ['reports', 'التقارير'],
  ['meeting-minutes', 'محاضر الاجتماعات'],
  ['letters-correspondence', 'الخطابات'],
  ['contracts', 'العقود'],
  ['programs-initiatives', 'البرامج والمبادرات'],
  ['education', 'الشؤون التعليمية'],
  ['finance', 'الشؤون المالية'],
  ['human-resources', 'الموارد البشرية'],
  ['media-brand', 'الإعلام'],
  ['endowments-sustainability', 'الأوقاف'],
  ['other', 'ملفات أخرى'],
] as const;

const owningDepartments = [
  ['executive-management', 'الإدارة التنفيذية'],
  ['education-affairs', 'الشؤون التعليمية'],
  ['finance-affairs', 'الشؤون المالية'],
  ['resource-development', 'تنمية الموارد'],
  ['governance', 'الحوكمة'],
  ['media', 'الإعلام'],
  ['human-resources', 'الموارد البشرية'],
  ['board-of-directors', 'مجلس الإدارة'],
] as const;

const documentPermissionsByRole: Record<string, string[]> = {
  board_chair: [
    'documents.view',
    'documents.create',
    'documents.update',
    'documents.upload',
    'documents.download',
    'documents.archive',
    'documents.audit',
    'documents.manage_access',
  ],
  executive_director: [
    'documents.view',
    'documents.create',
    'documents.update',
    'documents.upload',
    'documents.download',
    'documents.archive',
    'documents.audit',
    'documents.manage_access',
  ],
  operations_manager: [
    'documents.view',
    'documents.create',
    'documents.update',
    'documents.upload',
    'documents.download',
    'documents.archive',
    'documents.audit',
  ],
  finance_manager: [
    'documents.view',
    'documents.create',
    'documents.update',
    'documents.upload',
    'documents.download',
  ],
  education_manager: [
    'documents.view',
    'documents.create',
    'documents.update',
    'documents.upload',
    'documents.download',
  ],
  governance_officer: [
    'documents.view',
    'documents.create',
    'documents.update',
    'documents.upload',
    'documents.download',
    'documents.archive',
    'documents.audit',
  ],
  employee: ['documents.view', 'documents.create', 'documents.upload', 'documents.download'],
  viewer: ['documents.view', 'documents.download'],
};

const executivePermissionsByRole: Record<string, string[]> = {
  board_chair: [
    'dashboard.view',
    'dashboard.configure',
    'metrics.view',
    'metrics.manage',
    'metrics.measure',
    'strategy.view',
    'strategy.manage',
    'kpi.view',
    'kpi.manage',
    'kpi.measure',
    'initiatives.view',
    'initiatives.manage',
    'risks.view',
    'risks.manage',
    'alerts.view',
    'alerts.manage',
    'reports.view',
    'reports.create',
    'reports.approve',
    'executive.query',
  ],
  executive_director: [
    'dashboard.view',
    'dashboard.configure',
    'metrics.view',
    'metrics.manage',
    'metrics.measure',
    'strategy.view',
    'strategy.manage',
    'kpi.view',
    'kpi.manage',
    'kpi.measure',
    'initiatives.view',
    'initiatives.manage',
    'risks.view',
    'risks.manage',
    'alerts.view',
    'alerts.manage',
    'reports.view',
    'reports.create',
    'reports.approve',
    'executive.query',
  ],
  viewer: [
    'dashboard.view',
    'metrics.view',
    'strategy.view',
    'kpi.view',
    'initiatives.view',
    'risks.view',
    'alerts.view',
    'reports.view',
  ],
};

const metricDefinitions = [
  ['beneficiaries_total', 'إجمالي المستفيدين', 'NUMBER', 'MONTHLY', 'مستفيد'],
  ['students_male', 'الطلاب', 'NUMBER', 'MONTHLY', 'طالب'],
  ['students_female', 'الطالبات', 'NUMBER', 'MONTHLY', 'طالبة'],
  ['teachers_male', 'المعلمون', 'NUMBER', 'MONTHLY', 'معلم'],
  ['teachers_female', 'المعلمات', 'NUMBER', 'MONTHLY', 'معلمة'],
  ['circles_in_person', 'الحلقات الحضورية', 'NUMBER', 'MONTHLY', 'حلقة'],
  ['circles_remote', 'الحلقات عن بعد', 'NUMBER', 'MONTHLY', 'حلقة'],
  ['memorized_pages_weekly', 'الصفحات المحفوظة أسبوعيًا', 'NUMBER', 'WEEKLY', 'صفحة'],
  ['memorized_pages_monthly', 'الصفحات المحفوظة شهريًا', 'NUMBER', 'MONTHLY', 'صفحة'],
  ['completed_parts', 'الأجزاء المكتملة', 'NUMBER', 'MONTHLY', 'جزء'],
  ['attendance_rate', 'نسبة الحضور', 'PERCENTAGE', 'MONTHLY', '%'],
  ['retention_rate', 'نسبة الاستمرار', 'PERCENTAGE', 'MONTHLY', '%'],
  ['governance_score', 'درجة الحوكمة', 'PERCENTAGE', 'QUARTERLY', '%'],
  ['strategic_plan_progress', 'تقدم الخطة الاستراتيجية', 'PERCENTAGE', 'MONTHLY', '%'],
  ['operational_plan_progress', 'تقدم الخطة التشغيلية', 'PERCENTAGE', 'MONTHLY', '%'],
  ['budget_execution_rate', 'نسبة تنفيذ الموازنة', 'PERCENTAGE', 'MONTHLY', '%'],
  ['active_initiatives', 'المبادرات النشطة', 'NUMBER', 'MONTHLY', 'مبادرة'],
  ['delayed_initiatives', 'المبادرات المتأخرة', 'NUMBER', 'MONTHLY', 'مبادرة'],
  ['open_risks', 'المخاطر المفتوحة', 'NUMBER', 'MONTHLY', 'خطر'],
  ['critical_risks', 'المخاطر الحرجة', 'NUMBER', 'MONTHLY', 'خطر'],
] as const;

const defaultHealthWeights = {
  governance: 20,
  strategic: 20,
  operational: 20,
  financial: 15,
  risk: 15,
  knowledge: 10,
};

async function main() {
  for (const [name, displayName] of roles) {
    await prisma.role.upsert({
      where: { name },
      update: { displayName, isSystem: true },
      create: { name, displayName, isSystem: true },
    });
  }

  for (const [code, displayName, module] of permissions) {
    await prisma.permission.upsert({
      where: { code },
      update: { displayName, module },
      create: { code, displayName, module },
    });
  }

  for (const [sortOrder, [slug, name]] of categories.entries()) {
    await prisma.documentCategory.upsert({
      where: { slug },
      update: { name, sortOrder, isActive: true },
      create: { slug, name, sortOrder, isActive: true },
    });
  }

  for (const [sortOrder, [slug, name]] of owningDepartments.entries()) {
    await prisma.owningDepartment.upsert({
      where: { slug },
      update: { name, sortOrder, isActive: true },
      create: { slug, name, sortOrder, isActive: true },
    });
  }

  const superAdmin = await prisma.role.findUniqueOrThrow({ where: { name: 'super_admin' } });
  const allPermissions = await prisma.permission.findMany({ select: { id: true } });
  await prisma.rolePermission.createMany({
    data: allPermissions.map(({ id }) => ({ roleId: superAdmin.id, permissionId: id })),
    skipDuplicates: true,
  });

  for (const [roleName, permissionCodes] of Object.entries(documentPermissionsByRole)) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    const rolePermissions = await prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
      select: { id: true },
    });
    await prisma.rolePermission.createMany({
      data: rolePermissions.map(({ id }) => ({ roleId: role.id, permissionId: id })),
      skipDuplicates: true,
    });
  }

  for (const [roleName, permissionCodes] of Object.entries(executivePermissionsByRole)) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    const rolePermissions = await prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
      select: { id: true },
    });
    await prisma.rolePermission.createMany({
      data: rolePermissions.map(({ id }) => ({ roleId: role.id, permissionId: id })),
      skipDuplicates: true,
    });
  }

  for (const [key, nameAr, dataType, frequency, unit] of metricDefinitions) {
    const higherIsBetter = !['delayed_initiatives', 'open_risks', 'critical_risks'].includes(key);
    await prisma.institutionalMetric.upsert({
      where: { key },
      update: {
        nameAr,
        dataType,
        frequency,
        unit,
        higherIsBetter,
        isActive: true,
        deletedAt: null,
      },
      create: { key, nameAr, dataType, frequency, unit, higherIsBetter, isActive: true },
    });
  }

  await prisma.executiveDashboardPreference.upsert({
    where: { key: 'institutional-default' },
    update: {
      healthWeights: defaultHealthWeights,
      isDefault: true,
      deletedAt: null,
    },
    create: {
      key: 'institutional-default',
      healthWeights: defaultHealthWeights,
      isDefault: true,
      quickActions: [
        'upload_document',
        'add_kpi',
        'add_initiative',
        'add_risk',
        'add_alert',
        'create_report',
        'knowledge_center',
        'manage_users',
      ],
    },
  });

  const viewer = await prisma.role.findUniqueOrThrow({ where: { name: 'viewer' } });
  const dashboardPermission = await prisma.permission.findUniqueOrThrow({
    where: { code: 'dashboard.view' },
  });
  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: viewer.id, permissionId: dashboardPermission.id } },
    update: {},
    create: { roleId: viewer.id, permissionId: dashboardPermission.id },
  });
}

main()
  .then(() =>
    console.log(
      'Identity, document, and executive permissions, document lookups, metric definitions, and dashboard defaults seeded.',
    ),
  )
  .finally(() => prisma.$disconnect());
