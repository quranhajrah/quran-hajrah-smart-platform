import { loadConfig } from '../config.js';
import { LocalStorageProvider } from '../documents/storage.js';
import { PrismaDocumentStore } from '../documents/prisma-store.js';
import { PrismaIdentityStore } from '../identity/prisma-store.js';
import { PrismaKnowledgeStore } from './prisma-store.js';
import { InstitutionalKnowledgeService } from './service.js';

const run = async () => {
  const config = loadConfig();
  const service = new InstitutionalKnowledgeService(
    new PrismaKnowledgeStore(),
    new PrismaDocumentStore(),
    new LocalStorageProvider(config.documentStorageRoot),
    new PrismaIdentityStore(),
    config.documentMaxFileSizeBytes,
  );
  const result = await service.indexAll();
  console.log(
    JSON.stringify({
      event: 'knowledge_index_completed',
      total: result.total,
      indexed: result.indexed,
      failed: result.failed,
    }),
  );
  if (result.failed > 0) process.exitCode = 1;
};

void run().catch((error) => {
  console.error(
    JSON.stringify({
      event: 'knowledge_index_failed',
      error: error instanceof Error ? error.message : 'Unknown indexing error',
    }),
  );
  process.exitCode = 1;
});
