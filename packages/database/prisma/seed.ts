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
] as const;

const categories = [
  ['strategic-plans', 'الخطط الاستراتيجية'],
  ['operational-plans', 'الخطط التشغيلية'],
  ['budgets', 'الموازنات'],
  ['policies-regulations', 'اللوائح والسياسات'],
  ['governance-compliance', 'الحوكمة والامتثال'],
  ['reports', 'التقارير'],
  ['meeting-minutes', 'محاضر الاجتماعات'],
  ['letters-correspondence', 'الخطابات والمراسلات'],
  ['contracts', 'العقود'],
  ['programs-initiatives', 'البرامج والمبادرات'],
  ['education', 'الشؤون التعليمية'],
  ['finance', 'الشؤون المالية'],
  ['human-resources', 'الموارد البشرية'],
  ['media-brand', 'الإعلام والهوية'],
  ['endowments-sustainability', 'الأوقاف والاستدامة المالية'],
  ['other', 'ملفات أخرى'],
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
  finance_manager: ['documents.view', 'documents.create', 'documents.update', 'documents.upload', 'documents.download'],
  education_manager: ['documents.view', 'documents.create', 'documents.update', 'documents.upload', 'documents.download'],
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
  .then(() => console.log('Identity, document permissions, and document categories seeded.'))
  .finally(() => prisma.$disconnect());
