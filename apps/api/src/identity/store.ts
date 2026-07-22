import type { AuditEntry, IdentityUser, PublicRole, RefreshSession } from './types.js';

export type UserQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: 'active' | 'inactive';
  role?: string;
};

export interface IdentityStore {
  findUserByEmail(email: string): Promise<IdentityUser | null>;
  findUserById(id: string): Promise<IdentityUser | null>;
  touchLastLogin(id: string): Promise<void>;
  createSession(input: Omit<RefreshSession, 'id'>): Promise<RefreshSession>;
  findSession(tokenHash: string): Promise<RefreshSession | null>;
  revokeSession(id: string): Promise<void>;
  revokeUserSessions(userId: string): Promise<void>;
  listUsers(query: UserQuery): Promise<{ items: IdentityUser[]; total: number }>;
  createUser(input: {
    fullName: string;
    email: string;
    passwordHash: string;
    phone?: string;
    jobTitle?: string;
  }): Promise<IdentityUser>;
  updateUser(
    id: string,
    input: Partial<Pick<IdentityUser, 'fullName' | 'email' | 'phone' | 'jobTitle' | 'passwordHash' | 'isActive'>>,
  ): Promise<IdentityUser>;
  setUserRoles(userId: string, roleIds: string[], assignedBy: string): Promise<IdentityUser>;
  countActiveSuperAdmins(): Promise<number>;
  listRoles(): Promise<PublicRole[]>;
  listPermissions(): Promise<Array<{ id: string; code: string; displayName: string; module: string; description?: string | null }>>;
  createRole(input: { name: string; displayName: string; description?: string }): Promise<PublicRole>;
  updateRole(id: string, input: { displayName?: string; description?: string | null }): Promise<PublicRole>;
  setRolePermissions(id: string, permissionIds: string[]): Promise<PublicRole>;
  createAudit(entry: AuditEntry): Promise<void>;
  listAudit(page: number, pageSize: number): Promise<{ items: unknown[]; total: number }>;
}
