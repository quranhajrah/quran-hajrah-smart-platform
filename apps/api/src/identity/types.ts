export type RequestMeta = { ipAddress?: string; userAgent?: string };

export type PublicRole = {
  id: string;
  name: string;
  displayName: string;
  description?: string | null;
  isSystem: boolean;
  permissions: string[];
};

export type IdentityUser = {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  phone?: string | null;
  jobTitle?: string | null;
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  roles: PublicRole[];
};

export type PublicUser = Omit<IdentityUser, 'passwordHash'>;

export type RefreshSession = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
};

export type AuditEntry = RequestMeta & {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  description: string;
  metadata?: Record<string, unknown>;
};

export const toPublicUser = (user: IdentityUser): PublicUser => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  jobTitle: user.jobTitle,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  roles: user.roles,
});
export const permissionCodes = (user: IdentityUser) => [
  ...new Set(user.roles.flatMap((role) => role.permissions)),
];
