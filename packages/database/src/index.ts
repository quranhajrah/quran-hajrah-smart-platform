import { PrismaClient } from '@prisma/client';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };
export const database = globalDatabase.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalDatabase.prisma = database;

export const initializePrisma = async () => {
  await database.$connect();
};

export const checkDatabaseConnection = async () => {
  await database.$queryRaw`SELECT 1`;
};

type MigrationRecord = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

export const checkPendingMigrations = async () => {
  const migrationsDirectory = fileURLToPath(new URL('../prisma/migrations/', import.meta.url));
  const localEntries = await readdir(migrationsDirectory, { withFileTypes: true });
  const localMigrations = localEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const records = await database.$queryRaw<MigrationRecord[]>`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
  `;
  const failed = records.filter((record) => record.finished_at === null && record.rolled_back_at === null);
  if (failed.length > 0) {
    throw new Error(`Failed database migrations: ${failed.map((record) => record.migration_name).join(', ')}.`);
  }
  const applied = new Set(records.filter((record) => record.finished_at !== null && record.rolled_back_at === null).map((record) => record.migration_name));
  const pending = localMigrations.filter((migration) => !applied.has(migration));
  if (pending.length > 0) throw new Error(`Pending database migrations: ${pending.join(', ')}.`);
};

export const disconnectDatabase = () => database.$disconnect();
