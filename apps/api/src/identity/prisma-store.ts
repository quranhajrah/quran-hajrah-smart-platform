import type { Prisma } from '@prisma/client';
import { database } from '@quran-hajrah/database';
import type { IdentityStore, UserQuery } from './store.js';
import type { AuditEntry, IdentityUser, PublicRole, RefreshSession } from './types.js';

const userInclude = {
  roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
} satisfies Prisma.UserInclude;

type UserRecord = Prisma.UserGetPayload<{ include: typeof userInclude }>;
type RoleRecord = Prisma.RoleGetPayload<{
  include: { permissions: { include: { permission: true } } };
}>;

const mapRole = (role: RoleRecord): PublicRole => ({
  id: role.id,
  name: role.name,
  displayName: role.displayName,
  description: role.description,
  isSystem: role.isSystem,
  permissions: role.permissions.map(({ permission }) => permission.code),
});

const mapUser = (user: UserRecord): IdentityUser => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  passwordHash: user.passwordHash,
  phone: user.phone,
  jobTitle: user.jobTitle,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  roles: user.roles.map(({ role }) => mapRole(role)),
});

export class PrismaIdentityStore implements IdentityStore {
  async findUserByEmail(email: string) {
    const user = await database.user.findUnique({ where: { email }, include: userInclude });
    return user ? mapUser(user) : null;
  }

  async findUserById(id: string) {
    const user = await database.user.findUnique({ where: { id }, include: userInclude });
    return user ? mapUser(user) : null;
  }

  async touchLastLogin(id: string) {
    await database.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }

  async createSession(input: Omit<RefreshSession, 'id'>) {
    return database.refreshToken.create({ data: input });
  }

  async findSession(tokenHash: string) {
    return database.refreshToken.findUnique({ where: { tokenHash } });
  }

  async revokeSession(id: string) {
    await database.refreshToken.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeUserSessions(userId: string) {
    await database.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async listUsers(query: UserQuery) {
    const where: Prisma.UserWhereInput = {
      ...(query.search
        ? { OR: [{ fullName: { contains: query.search, mode: 'insensitive' } }, { email: { contains: query.search, mode: 'insensitive' } }] }
        : {}),
      ...(query.status ? { isActive: query.status === 'active' } : {}),
      ...(query.role ? { roles: { some: { role: { name: query.role } } } } : {}),
    };
    const [items, total] = await database.$transaction([
      database.user.findMany({ where, include: userInclude, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      database.user.count({ where }),
    ]);
    return { items: items.map(mapUser), total };
  }

  async createUser(input: Parameters<IdentityStore['createUser']>[0]) {
    return mapUser(await database.user.create({ data: input, include: userInclude }));
  }

  async updateUser(id: string, input: Parameters<IdentityStore['updateUser']>[1]) {
    return mapUser(await database.user.update({ where: { id }, data: input, include: userInclude }));
  }

  async setUserRoles(userId: string, roleIds: string[], assignedBy: string) {
    await database.$transaction([
      database.userRole.deleteMany({ where: { userId } }),
      database.userRole.createMany({ data: roleIds.map((roleId) => ({ userId, roleId, assignedBy })) }),
    ]);
    const user = await this.findUserById(userId);
    if (!user) throw new Error('User not found after role update.');
    return user;
  }

  countActiveSuperAdmins() {
    return database.user.count({ where: { isActive: true, roles: { some: { role: { name: 'super_admin' } } } } });
  }

  async listRoles() {
    return (await database.role.findMany({ include: { permissions: { include: { permission: true } } }, orderBy: { name: 'asc' } })).map(mapRole);
  }

  listPermissions() {
    return database.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] });
  }

  async createRole(input: Parameters<IdentityStore['createRole']>[0]) {
    return mapRole(await database.role.create({ data: input, include: { permissions: { include: { permission: true } } } }));
  }

  async updateRole(id: string, input: Parameters<IdentityStore['updateRole']>[1]) {
    return mapRole(await database.role.update({ where: { id }, data: input, include: { permissions: { include: { permission: true } } } }));
  }

  async setRolePermissions(id: string, permissionIds: string[]) {
    const role = await database.role.findUniqueOrThrow({ where: { id } });
    if (role.name === 'super_admin') throw new Error('The super_admin permission set cannot be reduced.');
    await database.$transaction([
      database.rolePermission.deleteMany({ where: { roleId: id } }),
      database.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })) }),
    ]);
    return mapRole(await database.role.findUniqueOrThrow({ where: { id }, include: { permissions: { include: { permission: true } } } }));
  }

  async createAudit(entry: AuditEntry) {
    await database.auditLog.create({ data: { ...entry, metadata: entry.metadata as Prisma.InputJsonValue | undefined } });
  }

  async listAudit(page: number, pageSize: number) {
    const [items, total] = await database.$transaction([
      database.auditLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { user: { select: { id: true, fullName: true, email: true } } } }),
      database.auditLog.count(),
    ]);
    return { items, total };
  }
}
