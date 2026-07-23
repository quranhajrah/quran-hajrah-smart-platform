import { randomInt } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const passwordAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-';

export type SuperAdministratorInput = {
  email: string;
  fullName: string;
  password: string;
};

export type SuperAdministratorResult = {
  userId: string;
  outcome: 'created' | 'updated';
};

export const temporaryPasswordPolicy = (password: string) =>
  password.length >= 12 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);

export const generateTemporaryPassword = (length = 32) => {
  if (length < 12) throw new Error('Temporary passwords must contain at least 12 characters.');
  const characters = ['A', 'a', '7', '!'];
  while (characters.length < length) {
    characters.push(passwordAlphabet[randomInt(passwordAlphabet.length)]!);
  }
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex]!, characters[index]!];
  }
  return characters.join('');
};

export const validateSuperAdministratorInput = (input: SuperAdministratorInput) => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.email.length > 254) {
    throw new Error('ADMIN_EMAIL must be a valid email address.');
  }
  if (input.fullName.length < 2 || input.fullName.length > 120) {
    throw new Error('ADMIN_FULL_NAME must contain between 2 and 120 characters.');
  }
  if (!temporaryPasswordPolicy(input.password)) {
    throw new Error('The administrator password does not meet the minimum password policy.');
  }
};

export const provisionSuperAdministrator = async (
  prisma: PrismaClient,
  rawInput: SuperAdministratorInput,
): Promise<SuperAdministratorResult> => {
  const input = {
    email: rawInput.email.trim().toLowerCase(),
    fullName: rawInput.fullName.trim(),
    password: rawInput.password,
  };
  validateSuperAdministratorInput(input);
  const passwordHash = await hash(input.password, 12);

  return prisma.$transaction(async (transaction) => {
    const superAdmin = await transaction.role.findUnique({
      where: { name: 'super_admin' },
      select: { id: true },
    });
    if (!superAdmin) {
      throw new Error('Run npm run db:seed before creating the first administrator.');
    }

    const existing = await transaction.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    let userId: string;
    let outcome: SuperAdministratorResult['outcome'];
    if (existing) {
      userId = existing.id;
      outcome = 'updated';
      await transaction.user.update({
        where: { id: existing.id },
        data: {
          fullName: input.fullName,
          passwordHash,
          isActive: true,
        },
      });
      await transaction.userRole.upsert({
        where: {
          userId_roleId: {
            userId: existing.id,
            roleId: superAdmin.id,
          },
        },
        update: {},
        create: {
          userId: existing.id,
          roleId: superAdmin.id,
        },
      });
      await transaction.refreshToken.updateMany({
        where: { userId: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      outcome = 'created';
      const created = await transaction.user.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          passwordHash,
          isActive: true,
          roles: {
            create: {
              roleId: superAdmin.id,
            },
          },
        },
        select: { id: true },
      });
      userId = created.id;
    }

    await transaction.auditLog.create({
      data: {
        action: 'users.bootstrap_super_admin',
        entityType: 'User',
        entityId: userId,
        description:
          outcome === 'created'
            ? 'Initial super administrator created by the production provisioning command.'
            : 'Existing user promoted to active super administrator by the production provisioning command.',
        metadata: { outcome },
      },
    });

    return { userId, outcome };
  });
};
