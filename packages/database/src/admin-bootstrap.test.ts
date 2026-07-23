import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  adminBootstrapSuccessMessage,
  redactAdminBootstrapError,
  resolveAdminBootstrapInput,
  runAdminBootstrap,
} from './admin-bootstrap.js';
import { generateTemporaryPassword } from './admin-provisioning.js';

const validEnvironment = {
  ADMIN_BOOTSTRAP_ENABLED: 'true',
  ADMIN_EMAIL: 'ADMIN@QURAN-HAJRAH.COM',
  ADMIN_FULL_NAME: 'حسن محمد الزهراني',
  ADMIN_TEMP_PASSWORD: generateTemporaryPassword(),
};

describe('production administrator bootstrap', () => {
  it.each([undefined, '', 'false', 'TRUE', 'true ', '1'])(
    'skips completely when ADMIN_BOOTSTRAP_ENABLED is %s',
    async (enabled) => {
      const database = { $transaction: vi.fn() } as unknown as PrismaClient;
      const result = await runAdminBootstrap(database, {
        ...validEnvironment,
        ADMIN_BOOTSTRAP_ENABLED: enabled,
      });

      expect(result).toEqual({ status: 'skipped' });
      expect(database.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each(['ADMIN_EMAIL', 'ADMIN_FULL_NAME', 'ADMIN_TEMP_PASSWORD'] as const)(
    'fails when %s is missing while bootstrap is enabled',
    (variable) => {
      const environment = { ...validEnvironment };
      delete environment[variable];

      expect(() => resolveAdminBootstrapInput(environment)).toThrow(variable);
    },
  );

  it.each([
    'short-A1!',
    'lowercase-only1!',
    'UPPERCASE-ONLY1!',
    'MissingNumber!',
    'MissingSpecial1A',
    'MissingSpecial1A ',
  ])('rejects an invalid temporary password', (password) => {
    expect(() =>
      resolveAdminBootstrapInput({
        ...validEnvironment,
        ADMIN_TEMP_PASSWORD: password,
      }),
    ).toThrow('password does not meet the minimum password policy');
  });

  it('normalizes the identity and accepts a strong password', () => {
    expect(resolveAdminBootstrapInput(validEnvironment)).toEqual({
      email: 'admin@quran-hajrah.com',
      fullName: 'حسن محمد الزهراني',
      password: validEnvironment.ADMIN_TEMP_PASSWORD,
    });
  });

  it('returns only a non-secret completion result', async () => {
    const transaction = {
      role: { findUnique: vi.fn().mockResolvedValue({ id: 'role-id' }) },
      user: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    transaction.user.create.mockResolvedValue({ id: 'user-id' });
    const database = {
      $transaction: vi.fn(async (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
      ),
    } as unknown as PrismaClient;

    const result = await runAdminBootstrap(database, validEnvironment);
    const message =
      result.status === 'completed' ? adminBootstrapSuccessMessage(result.outcome) : '';

    expect(result).toEqual({ status: 'completed', outcome: 'created' });
    expect(message).not.toContain(validEnvironment.ADMIN_TEMP_PASSWORD);
    expect(JSON.stringify(result)).not.toContain(validEnvironment.ADMIN_TEMP_PASSWORD);
  });

  it('redacts the temporary password from unexpected error messages', () => {
    const secret = validEnvironment.ADMIN_TEMP_PASSWORD;
    expect(redactAdminBootstrapError(new Error(`failure: ${secret}`), secret)).toBe(
      'failure: [REDACTED]',
    );
  });
});
