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
] as const;

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

  const superAdmin = await prisma.role.findUniqueOrThrow({ where: { name: 'super_admin' } });
  const allPermissions = await prisma.permission.findMany({ select: { id: true } });
  await prisma.rolePermission.createMany({
    data: allPermissions.map(({ id }) => ({ roleId: superAdmin.id, permissionId: id })),
    skipDuplicates: true,
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
  .then(() => console.log('Identity roles and permissions seeded.'))
  .finally(() => prisma.$disconnect());
