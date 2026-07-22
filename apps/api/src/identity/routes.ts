import { Router, type CookieOptions } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { AppError, asyncRoute, requireAuth, requirePermission, validate } from '../http.js';
import type { IdentityStore } from './store.js';
import {
  createRefreshToken,
  hashPassword,
  hashToken,
  passwordSchema,
  signAccessToken,
  verifyPassword,
} from './security.js';
import { permissionCodes, toPublicUser } from './types.js';

const email = z.string().trim().email().transform((value) => value.toLowerCase());
const idParams = z.object({ id: z.string().uuid() });
const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();
const userFields = z.object({
  fullName: z.string().trim().min(2).max(120),
  email,
  phone: z.string().trim().min(5).max(30).optional(),
  jobTitle: z.string().trim().min(2).max(120).optional(),
});
const createUserSchema = userFields.extend({ password: passwordSchema }).strict();
const updateUserSchema = userFields.partial().strict();
const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }).strict();
const resetPasswordSchema = z.object({ newPassword: passwordSchema }).strict();
const rolesSchema = z.object({ roleIds: z.array(z.string().uuid()).min(1).max(20) }).strict();
const roleCreateSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]{2,49}$/),
  displayName: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
}).strict();
const roleUpdateSchema = z.object({ displayName: z.string().trim().min(2).max(100).optional(), description: z.string().trim().max(500).nullable().optional() }).strict();
const permissionsSchema = z.object({ permissionIds: z.array(z.string().uuid()).max(200) }).strict();
const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  role: z.string().trim().max(50).optional(),
});
const paginationSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) });

const cookieOptions = (config: AppConfig): CookieOptions => ({
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'strict',
  path: '/api/auth',
  maxAge: config.refreshTokenDays * 24 * 60 * 60 * 1000,
});
const clearCookieOptions = (config: AppConfig): CookieOptions => {
  const options = cookieOptions(config);
  delete options.maxAge;
  return options;
};

export const createIdentityRouter = (store: IdentityStore, config: AppConfig) => {
  const router = Router();
  const authenticated = requireAuth(store, config);
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

  const issueSession = async (userId: string, context: { ipAddress?: string; userAgent?: string }) => {
    const refreshToken = createRefreshToken();
    await store.createSession({
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + config.refreshTokenDays * 86_400_000),
      revokedAt: null,
      ...context,
    });
    return { refreshToken, accessToken: await signAccessToken(userId, config) };
  };

  router.post('/auth/login', loginLimiter, validate(loginSchema), asyncRoute(async (request, response) => {
    const user = await store.findUserByEmail(request.body.email);
    if (!user || !user.isActive || !(await verifyPassword(request.body.password, user.passwordHash))) {
      throw new AppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
    }
    const tokens = await issueSession(user.id, request.context);
    await store.touchLastLogin(user.id);
    await store.createAudit({ userId: user.id, action: 'auth.login', description: 'User signed in.', ...request.context });
    response.cookie(config.cookieName, tokens.refreshToken, cookieOptions(config));
    response.json({ accessToken: tokens.accessToken, user: toPublicUser(user), permissions: permissionCodes(user) });
  }));

  router.post('/auth/refresh', asyncRoute(async (request, response) => {
    const rawToken = request.cookies?.[config.cookieName] as string | undefined;
    if (!rawToken) throw new AppError(401, 'Authentication required.', 'INVALID_SESSION');
    const session = await store.findSession(hashToken(rawToken));
    if (!session || session.revokedAt || session.expiresAt <= new Date()) throw new AppError(401, 'Authentication required.', 'INVALID_SESSION');
    const user = await store.findUserById(session.userId);
    if (!user?.isActive) throw new AppError(401, 'Authentication required.', 'INVALID_SESSION');
    await store.revokeSession(session.id);
    const tokens = await issueSession(user.id, request.context);
    response.cookie(config.cookieName, tokens.refreshToken, cookieOptions(config));
    response.json({ accessToken: tokens.accessToken, user: toPublicUser(user), permissions: permissionCodes(user) });
  }));

  router.post('/auth/logout', asyncRoute(async (request, response) => {
    const rawToken = request.cookies?.[config.cookieName] as string | undefined;
    if (rawToken) {
      const session = await store.findSession(hashToken(rawToken));
      if (session) {
        await store.revokeSession(session.id);
        await store.createAudit({ userId: session.userId, action: 'auth.logout', description: 'User signed out.', ...request.context });
      }
    }
    response.clearCookie(config.cookieName, clearCookieOptions(config));
    response.status(204).end();
  }));

  router.get('/auth/me', authenticated, (request, response) => {
    response.json({ user: toPublicUser(request.identity!), permissions: permissionCodes(request.identity!) });
  });

  router.post('/auth/change-password', authenticated, validate(changePasswordSchema), asyncRoute(async (request, response) => {
    if (!(await verifyPassword(request.body.currentPassword, request.identity!.passwordHash))) throw new AppError(400, 'Unable to change password.', 'PASSWORD_CHANGE_FAILED');
    const passwordHash = await hashPassword(request.body.newPassword, config.bcryptRounds);
    await store.updateUser(request.identity!.id, { passwordHash });
    await store.revokeUserSessions(request.identity!.id);
    await store.createAudit({ userId: request.identity!.id, action: 'auth.password_changed', description: 'User changed their password.', ...request.context });
    response.clearCookie(config.cookieName, clearCookieOptions(config));
    response.status(204).end();
  }));

  router.get('/users', authenticated, requirePermission('users.view'), validate(listUsersSchema, 'query'), asyncRoute(async (request, response) => {
    const result = await store.listUsers(request.query as never);
    response.json({ ...result, items: result.items.map(toPublicUser) });
  }));

  router.get('/users/:id', authenticated, requirePermission('users.view'), validate(idParams, 'params'), asyncRoute(async (request, response) => {
    const user = await store.findUserById(String(request.params.id));
    if (!user) throw new AppError(404, 'User not found.', 'NOT_FOUND');
    response.json(toPublicUser(user));
  }));

  router.post('/users', authenticated, requirePermission('users.create'), validate(createUserSchema), asyncRoute(async (request, response) => {
    const { password, ...fields } = request.body;
    const user = await store.createUser({ ...fields, passwordHash: await hashPassword(password, config.bcryptRounds) });
    await store.createAudit({ userId: request.identity!.id, action: 'users.create', entityType: 'User', entityId: user.id, description: 'User created.', ...request.context });
    response.status(201).json(toPublicUser(user));
  }));

  router.patch('/users/:id', authenticated, requirePermission('users.update'), validate(idParams, 'params'), validate(updateUserSchema), asyncRoute(async (request, response) => {
    const user = await store.updateUser(String(request.params.id), request.body);
    await store.createAudit({ userId: request.identity!.id, action: 'users.update', entityType: 'User', entityId: user.id, description: 'User updated.', ...request.context });
    response.json(toPublicUser(user));
  }));

  router.post('/users/:id/roles', authenticated, requirePermission('users.assign_roles'), validate(idParams, 'params'), validate(rolesSchema), asyncRoute(async (request, response) => {
    const target = await store.findUserById(String(request.params.id));
    if (!target) throw new AppError(404, 'User not found.', 'NOT_FOUND');
    const roles = await store.listRoles();
    const superAdminId = roles.find((role) => role.name === 'super_admin')?.id;
    if (target.roles.some((role) => role.name === 'super_admin') && !request.body.roleIds.includes(superAdminId) && (await store.countActiveSuperAdmins()) <= 1) {
      throw new AppError(409, 'The final active super administrator must be retained.', 'LAST_SUPER_ADMIN');
    }
    const user = await store.setUserRoles(target.id, request.body.roleIds, request.identity!.id);
    await store.createAudit({ userId: request.identity!.id, action: 'users.assign_roles', entityType: 'User', entityId: user.id, description: 'User roles updated.', metadata: { roleIds: request.body.roleIds }, ...request.context });
    response.json(toPublicUser(user));
  }));

  const setActive = (isActive: boolean) => asyncRoute(async (request, response) => {
    const target = await store.findUserById(String(request.params.id));
    if (!target) throw new AppError(404, 'User not found.', 'NOT_FOUND');
    if (!isActive && target.id === request.identity!.id && target.roles.some((role) => role.name === 'super_admin') && (await store.countActiveSuperAdmins()) <= 1) {
      throw new AppError(409, 'The final active super administrator cannot disable itself.', 'LAST_SUPER_ADMIN');
    }
    const user = await store.updateUser(target.id, { isActive });
    if (!isActive) await store.revokeUserSessions(target.id);
    await store.createAudit({ userId: request.identity!.id, action: isActive ? 'users.enable' : 'users.disable', entityType: 'User', entityId: user.id, description: isActive ? 'User enabled.' : 'User disabled.', ...request.context });
    response.json(toPublicUser(user));
  });
  router.post('/users/:id/disable', authenticated, requirePermission('users.disable'), validate(idParams, 'params'), setActive(false));
  router.post('/users/:id/enable', authenticated, requirePermission('users.disable'), validate(idParams, 'params'), setActive(true));

  router.post('/users/:id/reset-password', authenticated, requirePermission('users.update'), validate(idParams, 'params'), validate(resetPasswordSchema), asyncRoute(async (request, response) => {
    const targetId = String(request.params.id);
    await store.updateUser(targetId, { passwordHash: await hashPassword(request.body.newPassword, config.bcryptRounds) });
    await store.revokeUserSessions(targetId);
    await store.createAudit({ userId: request.identity!.id, action: 'users.reset_password', entityType: 'User', entityId: targetId, description: 'User password reset.', ...request.context });
    response.status(204).end();
  }));

  router.get('/roles', authenticated, requirePermission('roles.view'), asyncRoute(async (_request, response) => response.json(await store.listRoles())));
  router.get('/permissions', authenticated, requirePermission('roles.view'), asyncRoute(async (_request, response) => response.json(await store.listPermissions())));
  router.post('/roles', authenticated, requirePermission('roles.manage'), validate(roleCreateSchema), asyncRoute(async (request, response) => {
    const role = await store.createRole(request.body);
    await store.createAudit({ userId: request.identity!.id, action: 'roles.create', entityType: 'Role', entityId: role.id, description: 'Role created.', ...request.context });
    response.status(201).json(role);
  }));
  router.patch('/roles/:id', authenticated, requirePermission('roles.manage'), validate(idParams, 'params'), validate(roleUpdateSchema), asyncRoute(async (request, response) => {
    const role = await store.updateRole(String(request.params.id), request.body);
    await store.createAudit({ userId: request.identity!.id, action: 'roles.update', entityType: 'Role', entityId: role.id, description: 'Role updated.', ...request.context });
    response.json(role);
  }));
  router.put('/roles/:id/permissions', authenticated, requirePermission('roles.manage'), validate(idParams, 'params'), validate(permissionsSchema), asyncRoute(async (request, response) => {
    const role = await store.setRolePermissions(String(request.params.id), request.body.permissionIds);
    await store.createAudit({ userId: request.identity!.id, action: 'roles.permissions', entityType: 'Role', entityId: role.id, description: 'Role permissions updated.', ...request.context });
    response.json(role);
  }));

  router.get('/audit', authenticated, requirePermission('audit.view'), validate(paginationSchema, 'query'), asyncRoute(async (request, response) => {
    response.json(await store.listAudit(Number(request.query.page), Number(request.query.pageSize)));
  }));

  return router;
};
