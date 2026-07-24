import { database } from '@quran-hajrah/database';
import { PrismaDocumentStore } from '../documents/prisma-store.js';
import { PrismaIdentityStore } from '../identity/prisma-store.js';
import { PrismaExecutiveStore } from './prisma-store.js';
import { ExecutiveService } from './service.js';

const service = new ExecutiveService(
  new PrismaExecutiveStore(),
  new PrismaIdentityStore(),
  new PrismaDocumentStore(),
);

try {
  const result = await service.generateAlerts(null);
  console.log(`Executive alert generation completed: ${result.generated} candidates processed.`);
} catch (error) {
  console.error(
    `Executive alert generation failed: ${
      error instanceof Error ? error.message : 'Unknown error.'
    }`,
  );
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
