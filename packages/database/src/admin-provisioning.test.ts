import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { compare } from 'bcryptjs';
import { describe, expect, it, vi } from 'vitest';
import {
  generateTemporaryPassword,
  provisionSuperAdministrator,
  temporaryPasswordPolicy,
} from './admin-provisioning.js';

type TransactionFixture = {
  role: { findUnique: ReturnType<typeof vi.fn> };
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  userRole: { upsert: ReturnType<typeof vi.fn> };
  refreshToken: { updateMany: ReturnType<typeof vi.fn> };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

const databaseFixture = (existingUserId?: string) => {
  const roleId = randomUUID();
  const createdUserId = randomUUID();
  const transaction: TransactionFixture = {
    role: { findUnique: vi.fn().mockResolvedValue({ id: roleId }) },
    user: {
      findUnique: vi.fn().mockResolvedValue(existingUserId ? { id: existingUserId } : null),
      create: vi.fn().mockResolvedValue({ id: createdUserId }),
      update: vi.fn().mockResolvedValue({ id: existingUserId }),
    },
    userRole: { upsert: vi.fn().mockResolvedValue({}) },
    refreshToken: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: vi.fn(async (operation: (client: TransactionFixture) => Promise<unknown>) =>
      operation(transaction),
    ),
  } as unknown as PrismaClient;
  return { prisma, transaction, roleId, createdUserId };
};

const input = {
  email: 'ADMIN@QURAN-HAJRAH.COM',
  fullName: 'حسن محمد الزهراني',
  password: generateTemporaryPassword(),
};

describe('super administrator provisioning', () => {
  it('generates strong unique temporary passwords', () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generateTemporaryPassword()));
    expect(passwords.size).toBe(20);
    for (const password of passwords) {
      expect(password).toHaveLength(32);
      expect(temporaryPasswordPolicy(password)).toBe(true);
    }
  });

  it('creates an active super administrator and audit entry', async () => {
    const { prisma, transaction, createdUserId, roleId } = databaseFixture();
    const result = await provisionSuperAdministrator(prisma, input);

    expect(result).toEqual({ userId: createdUserId, outcome: 'created' });
    expect(transaction.user.create).toHaveBeenCalledOnce();
    const createData = transaction.user.create.mock.calls[0]![0].data;
    expect(createData).toMatchObject({
      email: 'admin@quran-hajrah.com',
      fullName: input.fullName,
      isActive: true,
      roles: { create: { roleId } },
    });
    expect(createData.passwordHash).not.toBe(input.password);
    expect(await compare(input.password, createData.passwordHash)).toBe(true);
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'users.bootstrap_super_admin',
        entityId: createdUserId,
        metadata: { outcome: 'created' },
      }),
    });
  });

  it('updates and promotes an existing user without creating a duplicate', async () => {
    const existingUserId = randomUUID();
    const { prisma, transaction, roleId } = databaseFixture(existingUserId);
    const result = await provisionSuperAdministrator(prisma, input);

    expect(result).toEqual({ userId: existingUserId, outcome: 'updated' });
    expect(transaction.user.create).not.toHaveBeenCalled();
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: existingUserId },
      data: expect.objectContaining({
        fullName: input.fullName,
        isActive: true,
      }),
    });
    expect(transaction.userRole.upsert).toHaveBeenCalledWith({
      where: { userId_roleId: { userId: existingUserId, roleId } },
      update: {},
      create: { userId: existingUserId, roleId },
    });
    expect(transaction.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: existingUserId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityId: existingUserId,
        metadata: { outcome: 'updated' },
      }),
    });
  });

  it('fails before writing when the super_admin seed role is missing', async () => {
    const { prisma, transaction } = databaseFixture();
    transaction.role.findUnique.mockResolvedValue(null);

    await expect(provisionSuperAdministrator(prisma, input)).rejects.toThrow('Run npm run db:seed');
    expect(transaction.user.create).not.toHaveBeenCalled();
    expect(transaction.user.update).not.toHaveBeenCalled();
  });
});
