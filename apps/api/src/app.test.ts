import { randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import type { AppConfig } from './config.js';
import type { IdentityStore, UserQuery } from './identity/store.js';
import type { AuditEntry, IdentityUser, PublicRole, RefreshSession } from './identity/types.js';

const config: AppConfig = {
  nodeEnv: 'test', corsOrigins: ['http://localhost:5173'], accessTokenSecret: 'test-only-secret-that-is-longer-than-32-characters', accessTokenMinutes: 15, refreshTokenDays: 7, cookieName: 'test_refresh', bcryptRounds: 4,
};

class MemoryIdentityStore implements IdentityStore {
  users: IdentityUser[] = [];
  sessions: RefreshSession[] = [];
  audits: AuditEntry[] = [];
  permissions = [
    { id: randomUUID(), code: 'users.view', displayName: 'عرض المستخدمين', module: 'users' },
    { id: randomUUID(), code: 'users.create', displayName: 'إنشاء مستخدم', module: 'users' },
    { id: randomUUID(), code: 'users.disable', displayName: 'تعطيل مستخدم', module: 'users' },
  ];
  roles: PublicRole[] = [
    { id: randomUUID(), name: 'super_admin', displayName: 'مدير النظام العام', isSystem: true, permissions: ['users.view', 'users.create', 'users.disable', 'roles.view', 'roles.manage', 'audit.view'] },
    { id: randomUUID(), name: 'viewer', displayName: 'مشاهد', isSystem: true, permissions: ['dashboard.view'] },
  ];
  findUserByEmail = async (email: string) => this.users.find((user) => user.email === email) ?? null;
  findUserById = async (id: string) => this.users.find((user) => user.id === id) ?? null;
  touchLastLogin = async (id: string) => { const user = await this.findUserById(id); if (user) user.lastLoginAt = new Date(); };
  createSession = async (input: Omit<RefreshSession, 'id'>) => { const session = { id: randomUUID(), ...input }; this.sessions.push(session); return session; };
  findSession = async (tokenHash: string) => this.sessions.find((session) => session.tokenHash === tokenHash) ?? null;
  revokeSession = async (id: string) => { const session = this.sessions.find((item) => item.id === id); if (session) session.revokedAt = new Date(); };
  revokeUserSessions = async (userId: string) => { this.sessions.filter((item) => item.userId === userId && !item.revokedAt).forEach((item) => { item.revokedAt = new Date(); }); };
  listUsers = async (query: UserQuery) => { void query; return { items: this.users, total: this.users.length }; };
  createUser = async (input: Parameters<IdentityStore['createUser']>[0]) => { const now = new Date(); const user: IdentityUser = { id: randomUUID(), ...input, isActive: true, createdAt: now, updatedAt: now, roles: [] }; this.users.push(user); return user; };
  updateUser = async (id: string, input: Parameters<IdentityStore['updateUser']>[1]) => { const user = await this.findUserById(id); if (!user) throw new Error('Not found'); Object.assign(user, input, { updatedAt: new Date() }); return user; };
  setUserRoles = async (userId: string, roleIds: string[]) => { const user = await this.findUserById(userId); if (!user) throw new Error('Not found'); user.roles = this.roles.filter((role) => roleIds.includes(role.id)); return user; };
  countActiveSuperAdmins = async () => this.users.filter((user) => user.isActive && user.roles.some((role) => role.name === 'super_admin')).length;
  listRoles = async () => this.roles;
  listPermissions = async () => this.permissions;
  createRole = async (input: Parameters<IdentityStore['createRole']>[0]) => { const role = { id: randomUUID(), ...input, isSystem: false, permissions: [] }; this.roles.push(role); return role; };
  updateRole = async (id: string, input: Parameters<IdentityStore['updateRole']>[1]) => { const role = this.roles.find((item) => item.id === id); if (!role) throw new Error('Not found'); Object.assign(role, input); return role; };
  setRolePermissions = async (id: string, permissionIds: string[]) => { const role = this.roles.find((item) => item.id === id); if (!role) throw new Error('Not found'); role.permissions = this.permissions.filter((permission) => permissionIds.includes(permission.id)).map((permission) => permission.code); return role; };
  createAudit = async (entry: AuditEntry) => { this.audits.push(entry); };
  listAudit = async () => ({ items: this.audits, total: this.audits.length });
}

describe('identity and RBAC API', () => {
  let store: MemoryIdentityStore;
  let app: ReturnType<typeof createApp>;
  const adminPassword = 'ValidPassword123';
  const viewerPassword = 'ViewerPassword123';

  beforeEach(async () => {
    store = new MemoryIdentityStore();
    const now = new Date();
    store.users.push(
      { id: randomUUID(), fullName: 'مدير النظام', email: 'admin@example.test', passwordHash: await hash(adminPassword, 4), isActive: true, createdAt: now, updatedAt: now, roles: [store.roles[0]!] },
      { id: randomUUID(), fullName: 'مستخدم مشاهد', email: 'viewer@example.test', passwordHash: await hash(viewerPassword, 4), isActive: true, createdAt: now, updatedAt: now, roles: [store.roles[1]!] },
      { id: randomUUID(), fullName: 'مستخدم معطل', email: 'disabled@example.test', passwordHash: await hash(adminPassword, 4), isActive: false, createdAt: now, updatedAt: now, roles: [] },
    );
    app = createApp({ store, config });
  });

  const login = async (email = 'admin@example.test', password = adminPassword) => request(app).post('/api/auth/login').send({ email, password });

  it('logs in with valid credentials without exposing passwordHash', async () => {
    const response = await login();
    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBeTypeOf('string');
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
  });

  it('rejects an incorrect password with a generic error', async () => {
    const response = await login('admin@example.test', 'incorrect');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects a disabled user with the same generic error', async () => {
    const response = await login('disabled@example.test', adminPassword);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rotates a refresh token', async () => {
    const agent = request.agent(app);
    expect((await agent.post('/api/auth/login').send({ email: 'admin@example.test', password: adminPassword })).status).toBe(200);
    const firstSession = store.sessions[0]!;
    const refreshed = await agent.post('/api/auth/refresh');
    expect(refreshed.status).toBe(200);
    expect(firstSession.revokedAt).toBeInstanceOf(Date);
    expect(store.sessions).toHaveLength(2);
  });

  it('revokes the session on logout', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'admin@example.test', password: adminPassword });
    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect(store.sessions[0]?.revokedAt).toBeInstanceOf(Date);
    expect((await agent.post('/api/auth/refresh')).status).toBe(401);
  });

  it('rejects protected access without authentication', async () => {
    expect((await request(app).get('/api/users')).status).toBe(401);
  });

  it('rejects authenticated access without the required permission', async () => {
    const auth = await login('viewer@example.test', viewerPassword);
    expect((await request(app).get('/api/users').set('Authorization', `Bearer ${auth.body.accessToken}`)).status).toBe(403);
  });

  it('allows access with the required permission', async () => {
    const auth = await login();
    expect((await request(app).get('/api/users').set('Authorization', `Bearer ${auth.body.accessToken}`)).status).toBe(200);
  });

  it('creates a user, omits passwordHash, and records an audit log', async () => {
    const auth = await login();
    const response = await request(app).post('/api/users').set('Authorization', `Bearer ${auth.body.accessToken}`).send({ fullName: 'موظف جديد', email: 'new@example.test', password: 'NewPassword123' });
    expect(response.status).toBe(201);
    expect(response.body.passwordHash).toBeUndefined();
    expect(store.audits.some((entry) => entry.action === 'users.create' && entry.entityId === response.body.id)).toBe(true);
  });

  it('prevents the final active super administrator from disabling itself', async () => {
    const auth = await login();
    const response = await request(app).post(`/api/users/${store.users[0]!.id}/disable`).set('Authorization', `Bearer ${auth.body.accessToken}`);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('LAST_SUPER_ADMIN');
  });
});
