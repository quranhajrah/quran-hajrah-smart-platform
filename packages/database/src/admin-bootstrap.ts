import type { PrismaClient } from '@prisma/client';
import {
  provisionSuperAdministrator,
  validateSuperAdministratorInput,
  type SuperAdministratorInput,
  type SuperAdministratorResult,
} from './admin-provisioning.js';

export type AdminBootstrapResult =
  { status: 'skipped' } | { status: 'completed'; outcome: SuperAdministratorResult['outcome'] };

export const resolveAdminBootstrapInput = (
  environment: NodeJS.ProcessEnv,
): SuperAdministratorInput | null => {
  if (environment.ADMIN_BOOTSTRAP_ENABLED !== 'true') return null;

  const email = environment.ADMIN_EMAIL?.trim().toLowerCase();
  const fullName = environment.ADMIN_FULL_NAME?.trim();
  const password = environment.ADMIN_TEMP_PASSWORD;
  const missingVariables = [
    !email && 'ADMIN_EMAIL',
    !fullName && 'ADMIN_FULL_NAME',
    !password && 'ADMIN_TEMP_PASSWORD',
  ].filter(Boolean);

  if (missingVariables.length > 0) {
    throw new Error(
      `${missingVariables.join(', ')} must be set when ADMIN_BOOTSTRAP_ENABLED=true.`,
    );
  }

  const input = {
    email: email!,
    fullName: fullName!,
    password: password!,
  };
  validateSuperAdministratorInput(input);
  return input;
};

export const runAdminBootstrap = async (
  prisma: PrismaClient,
  environment: NodeJS.ProcessEnv,
): Promise<AdminBootstrapResult> => {
  const input = resolveAdminBootstrapInput(environment);
  if (!input) return { status: 'skipped' };

  const result = await provisionSuperAdministrator(prisma, input);
  return { status: 'completed', outcome: result.outcome };
};

export const adminBootstrapSuccessMessage = (
  outcome: SuperAdministratorResult['outcome'],
): string =>
  outcome === 'created'
    ? 'Production super administrator bootstrap completed: account created.'
    : 'Production super administrator bootstrap completed: existing account activated and promoted.';

export const redactAdminBootstrapError = (error: unknown, temporaryPassword?: string): string => {
  const message = error instanceof Error ? error.message : 'Unknown bootstrap error.';
  if (!temporaryPassword) return message;
  return message.split(temporaryPassword).join('[REDACTED]');
};
